const { test, expect, loginAs, withTestDb } = require('../fixtures/meldren');

test('configured Record Form is the live Commercial source of truth', async ({ page, users, testData }) => {
  await loginAs(page, users.alphaOwner);
  const response=await page.goto(`/workflows/view?id=${testData.workflows.alpha}&section=commercial`);
  expect(response.status()).toBeLessThan(400);
  await expect(page.locator('#eventCommercialTermsSection')).toBeVisible();
  const contract=page.locator('[data-field-key="contract_type"] select:visible');
  await expect(contract).toBeVisible(); await contract.selectOption('revenue_split');
  await expect(page.locator('[data-field-key="venue_percentage"]')).toBeVisible();
  await expect(page.locator('[data-field-key="promoter_percentage"]')).toBeVisible();
  await page.locator('[data-field-key="venue_percentage"] input:visible').fill('20');
  await page.locator('[data-field-key="promoter_percentage"] input:visible').fill('80');
  await page.locator('[data-field-key="ticket_prices"] .repeatable-add').click();
  const row=page.locator('[data-field-key="ticket_prices"] tbody tr').first(); await row.locator('input').nth(0).fill('Adult'); await row.locator('input').nth(1).fill('25'); await row.locator('input').nth(2).fill('300');
  const savedResponse=page.waitForResponse(r=>r.url().includes('/api/forms/saveRecord'));
  await page.getByRole('button',{name:'Save Commercial Information'}).click();
  const saved=await savedResponse; expect(saved.ok(),`${await saved.text()}\nPOST: ${saved.request().postData()}`).toBeTruthy();
  await page.reload(); await expect(page.locator('[data-field-key="venue_percentage"] input:visible')).toHaveValue(/^20(?:\.0+)?$/); await expect(page.locator('[data-field-key="promoter_percentage"] input:visible')).toHaveValue(/^80(?:\.0+)?$/); await expect(page.locator('[data-field-key="ticket_prices"] tbody tr')).toHaveCount(1);
  await withTestDb(async db=>{const [rows]=await db.execute('SELECT COUNT(*) valueCount FROM tbl_record_form_values WHERE tenantId=? AND workflowId=?',[testData.tenants.alpha,testData.workflows.alpha]);expect(Number(rows[0].valueCount)).toBeGreaterThanOrEqual(4);});
});

test('tenant owner can open Forms administration',async({page,users})=>{await loginAs(page,users.alphaOwner);await page.goto('/forms');await expect(page.getByRole('heading',{name:'Record Forms'})).toBeVisible();await expect(page.getByRole('button',{name:/Create Record Form/i})).toBeVisible();});

test('published Form Designer creates and opens an immutable new version',async({page,users})=>{
  await loginAs(page,users.alphaOwner);
  await page.goto('/forms');
  const publishedRow=page.locator('#formsList tr').filter({has:page.locator('.badge.bg-success')}).first();
  await publishedRow.getByRole('link',{name:'Edit / Preview'}).click();
  await expect(page.getByText(/version 1/i)).toBeVisible();
  const responsePromise=page.waitForResponse(response=>response.url().includes('/api/forms/newVersion'));
  await page.getByRole('button',{name:'Create New Version'}).click();
  const response=await responsePromise;
  expect(response.ok(),`new-version endpoint returned ${response.status()}`).toBeTruthy();
  await page.waitForURL(/\/forms\/designer\?id=\d+/);
  await expect(page.getByText(/version 2/i)).toBeVisible();
  await expect(page.getByRole('button',{name:'Publish'})).toBeVisible();
});

test('Create Record Form modal opens its designer and Add Section persists',async({page,users,testData})=>{
  await loginAs(page,users.alphaOwner);
  await page.goto('/forms');
  await page.getByRole('button',{name:'Create Record Form'}).click();
  const modal=page.locator('#createFormModal');
  await modal.locator('[name="formName"]').fill('E2E Record Form Designer');
  await modal.locator('[name="formDescription"]').fill('Created through the browser modal');
  const responsePromise=page.waitForResponse(response=>response.url().includes('/api/forms/saveTemplate'));
  await modal.getByRole('button',{name:'Create',exact:true}).click();
  const response=await responsePromise;
  expect(response.ok(),`create-form endpoint returned ${response.status()}`).toBeTruthy();
  await page.waitForURL(/\/forms\/designer\?id=\d+/);
  await expect(page.getByRole('heading',{name:'E2E Record Form Designer'})).toBeVisible();
  await expect(page.getByText(/record form, version 1/i)).toBeVisible();
  await page.getByLabel('Section name').fill('Event Details');
  const sectionResponse=page.waitForResponse(response=>response.url().includes('/api/forms/saveSection'));
  await page.getByRole('button',{name:'Add Section'}).click();
  const saved=await sectionResponse;
  expect(saved.ok(),`save-section endpoint returned ${saved.status()}: ${await saved.text()}`).toBeTruthy();
  await expect(page.locator('main form[action="/api/forms/saveSection"] [name="sectionName"]')).toHaveValue('Event Details');
  const fieldForm=page.locator('main form[action="/api/forms/saveField"]');
  await fieldForm.locator('[name="fieldLabel"]').fill('Choose an audience');
  await fieldForm.locator('[name="fieldType"]').selectOption('radio');
  const fieldResponse=page.waitForResponse(response=>response.url().includes('/api/forms/saveField'));
  await fieldForm.getByRole('button',{name:'Add Question'}).click();
  const fieldSaved=await fieldResponse;
  expect(fieldSaved.ok(),`save-field endpoint returned ${fieldSaved.status()}: ${await fieldSaved.text()}`).toBeTruthy();
  await page.getByRole('button',{name:/Choose an audience/}).click();
  const choiceForm=page.locator('#frmAddAnswerChoice');
  await choiceForm.locator('[name="optionLabel"]').fill('General Public');
  const choiceResponse=page.waitForResponse(response=>response.url().includes('/api/forms/saveOption'));
  await choiceForm.getByRole('button',{name:'Add Choice'}).click();
  const choiceSaved=await choiceResponse;
  expect(choiceSaved.ok(),`save-option endpoint returned ${choiceSaved.status()}: ${await choiceSaved.text()}`).toBeTruthy();
  await expect(page.locator('#selectedOptions').getByText('General Public')).toBeVisible();
  await withTestDb(async db=>{const [rows]=await db.execute("SELECT f.formType,f.status,s.sectionKey,s.sectionName,q.fieldType,JSON_VALID(q.validationJson) validationValid,JSON_VALID(q.settingsJson) settingsValid,o.optionLabel,o.optionValue FROM tbl_form_templates f JOIN tbl_form_sections s ON s.formTemplateId=f.id AND s.tenantId=f.tenantId JOIN tbl_form_fields q ON q.formSectionId=s.id AND q.tenantId=s.tenantId JOIN tbl_form_field_options o ON o.formFieldId=q.id AND o.tenantId=q.tenantId WHERE f.tenantId=? AND f.formName='E2E Record Form Designer'",[testData.tenants.alpha]);expect(rows).toEqual([expect.objectContaining({formType:'record',status:'draft',sectionKey:'event_details',sectionName:'Event Details',fieldType:'radio',validationValid:1,settingsValid:1,optionLabel:'General Public',optionValue:'general_public'})]);});
});
