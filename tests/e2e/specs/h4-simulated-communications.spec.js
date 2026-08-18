const {test,expect,loginAs,withTestDb}=require('../fixtures/meldren');

test('H4 uses the genuine unmatched allocation UI and inherits the linked thread',async({page,users,testData})=>{
 let instanceId;
 try{
  instanceId=await withTestDb(async db=>{
   await db.execute("UPDATE tbl_tenants SET tenantType='demo',lifecycleStatus='active',accessStartDate=NULL,accessEndDate=NULL WHERE id=?",[testData.tenants.alpha]);
   const [[pack]]=await db.execute("SELECT id FROM tbl_scenario_packs WHERE scenarioCode='TEST_EXTERNAL_COMMUNICATION_V1' AND versionNumber=1");
   const [[step]]=await db.execute('SELECT id FROM tbl_scenario_steps WHERE scenarioPackId=? ORDER BY sequenceNumber LIMIT 1',[pack.id]);
   const [insert]=await db.execute("INSERT INTO tbl_scenario_instances (tenantId,scenarioPackId,currentStepId,status,guideMode,simulatedDateTime) VALUES (?,?,?,'ready','guided','2026-08-18 10:30:00')",[testData.tenants.alpha,pack.id,step.id]);
   return insert.insertId;
  });
  await loginAs(page,users.alphaOwner);
  await page.goto('/demo/test-scenario');
  await expect(page.getByRole('heading',{name:'External communication technical scenario'})).toBeVisible();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByText('A new email has arrived from an external contact.')).toBeVisible();
  await page.getByRole('button',{name:'Receive email'}).click();
  await expect(page.getByText('Open Communications and allocate the new email')).toBeVisible();

  await page.goto('/communications/mailbox');
  await expect(page.getByRole('heading',{name:'Updated information'})).toBeVisible();
  await expect(page.getByText('Jordan Reed')).toBeVisible();
  await page.getByRole('article').filter({hasText:'Updated information'}).hover();
  await expect(page.getByText('I have updated the information we discussed.')).toBeVisible();
  const suggestion=page.locator('.border.rounded.p-3').filter({hasText:'Suggested event'});
  await expect(suggestion).toContainText('E2E Alpha Event');
  await Promise.all([
   page.waitForResponse(response=>response.url().includes('/api/communications/assign')&&response.request().method()==='POST'),
   suggestion.getByRole('button',{name:'Assign to Event'}).click()
  ]);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Updated information'})).toHaveCount(0);

  await page.goto('/demo/test-scenario');
  await page.getByRole('button',{name:'I have allocated the email'}).click();
  await expect(page.getByText('The communication is now linked')).toBeVisible();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByText('Jordan Reed has sent a second message')).toBeVisible();
  await page.getByRole('button',{name:'Receive follow-up'}).click();
  await expect(page.getByText('recognised the existing thread')).toBeVisible();
  const proof=await withTestDb(async db=>{
   const [rows]=await db.execute("SELECT id,threadId,matchStatus,status,subjectCiphertext,bodyTextCiphertext FROM tbl_communications WHERE tenantId=? AND scenarioInstanceId=? ORDER BY id",[testData.tenants.alpha,instanceId]);
   const [links]=await db.execute("SELECT communicationId,entityId FROM tbl_communication_links WHERE tenantId=? AND communicationId IN (?,?) AND entityType='workflow'",[testData.tenants.alpha,rows[0].id,rows[1].id]);
   return{rows,links};
  });
  expect(proof.rows).toHaveLength(2);expect(proof.rows[0].threadId).toBe(proof.rows[1].threadId);expect(proof.rows[1].matchStatus).toBe('linked');expect(proof.rows[1].status).toBe('matched');expect(proof.rows.every(row=>row.subjectCiphertext&&row.bodyTextCiphertext)).toBeTruthy();expect(proof.links).toHaveLength(2);expect(new Set(proof.links.map(link=>link.entityId)).size).toBe(1);
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('button',{name:'Complete scenario'}).click();
  await expect(page.getByText('Scenario complete.')).toBeVisible();
 }finally{
  await withTestDb(db=>db.execute("UPDATE tbl_tenants SET tenantType='live',lifecycleStatus='active',accessEndDate=NULL WHERE id=?",[testData.tenants.alpha]));
 }
});
