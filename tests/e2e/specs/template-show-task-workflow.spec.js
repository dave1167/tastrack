const { test, expect, loginAs, withTestDb } = require('../fixtures/meldren');

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const templateName = `E2E Browser Template ${runId}`;
const showName = `E2E Browser Show ${runId}`;
const phases = ['Enquiry', 'Contract', 'Delivery', 'Settlement'];
const questions = [
    { phase: 0, name: `Venue confirmed ${runId}`, type: 'yes_no' },
    { phase: 0, name: `Planning progress ${runId}`, type: 'task_status' },
    { phase: 1, name: `Contract route ${runId}`, type: 'radio', options: ['Standard', 'Enhanced'] },
    { phase: 1, name: `Delivery format ${runId}`, type: 'dropdown_single', options: ['In person', 'Hybrid'] },
    { phase: 2, name: `Safety checks ${runId}`, type: 'checkbox_multi', options: ['Risk assessment', 'Insurance'] },
    { phase: 3, name: `Settlement note ${runId}`, type: 'text_long' }
];

async function databaseRow(sql, params = []) {
    return withTestDb(async db => (await db.execute(sql, params))[0][0]);
}

async function addPhase(page, templateId, phase, index) {
    await page.goto(`/workflow_templates/template_stages?id=${templateId}`);
    await page.locator('button[data-bs-target="#addPhasePanel"]').first().click();
    const form = page.locator('#addPhasePanel form');
    await form.locator('[name="stageName"]').fill(`${phase} ${runId}`);
    await form.locator('[name="description"]').fill(`Browser-created ${phase} phase`);
    await form.locator('[name="requiresAllTasksComplete"]').selectOption('1');
    await Promise.all([
        page.waitForURL(url => url.pathname.endsWith('/template_stages')),
        form.locator('button[type="submit"]').click()
    ]);
    const row = await databaseRow('SELECT id FROM tbl_template_stages WHERE templateId=? AND stageName=?', [templateId, `${phase} ${runId}`]);
    expect(row, `phase ${index + 1} persisted`).toBeTruthy();
    return row.id;
}

async function addQuestion(page, templateId, stageId, question, order) {
    await page.goto(`/workflow_templates/template_tasks?templateId=${templateId}&stageId=${stageId}`);
    const form = page.locator('#frmAddTaskQuestion');
    await expect(form.locator('[name="answerType"]')).toBeEnabled();
    await form.locator('[name="templateStageId"]').selectOption(String(stageId));
    await form.locator('[name="sortOrder"]').fill(String(order));
    await form.locator('[name="taskName"]').fill(question.name);
    await form.locator('[name="answerType"]').selectOption(question.type);
    const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/task_questions/save')),
        form.getByRole('button', { name: 'Add Question' }).click()
    ]);
    expect(response.ok()).toBeTruthy();
    const saved = await databaseRow('SELECT id FROM tbl_template_tasks WHERE templateId=? AND taskName=? AND status=\'active\'', [templateId, question.name]);
    expect(saved).toBeTruthy();
    if (question.options) {
        await page.goto(`/workflow_templates/template_tasks?templateId=${templateId}&stageId=${stageId}&questionId=${saved.id}`);
        const optionForm = page.locator('#selectedQuestion form[action="/api/task_questions/saveOption"]');
        for (const [index, label] of question.options.entries()) {
            await optionForm.locator('[name="optionLabel"]').fill(label);
            await optionForm.locator('[name="displayOrder"]').fill(String((index + 1) * 10));
            const [optionResponse] = await Promise.all([
                page.waitForResponse(r => r.url().includes('/api/task_questions/saveOption')),
                optionForm.getByRole('button', { name: 'Add' }).click()
            ]);
            expect(optionResponse.ok()).toBeTruthy();
        }
    }
}

async function assignTask(page, taskId, teamId, userId) {
    await page.goto(`/tasks/edit?id=${taskId}&source=workflow`);
    const form = page.locator('#frmTaskEdit');
    if (await form.locator('#taskAssignment').inputValue() === `team:${teamId}`) {
        await form.locator('#taskAssignment').selectOption('unassigned:');
    }
    const [membersResponse] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/tasks/team_member_options') && r.url().includes(`teamid=${teamId}`)),
        form.locator('#taskAssignment').selectOption(`team:${teamId}`)
    ]);
    expect(membersResponse.ok()).toBeTruthy();
    await expect(form.locator('#taskAssignedUser')).toBeEnabled();
    await expect(form.locator(`#taskAssignedUser option[value="${userId}"]`)).toHaveCount(1);
    await form.locator('#taskAssignedUser').selectOption(String(userId));
    const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/tasks/update')),
        form.getByRole('button', { name: 'Update Task' }).click()
    ]);
    expect(response.ok()).toBeTruthy();
}

async function answerTask(page, task, answer) {
    await page.goto(`/tasks/edit?id=${task.id}`);
    const form = page.locator('#frmTaskAnswer');
    if (task.answerTypeSnapshot === 'yes_no') await form.locator('[name="answerBoolean"]').selectOption('1');
    if (task.answerTypeSnapshot === 'task_status') await form.locator('[name="answerStatus"]').selectOption('complete');
    if (task.answerTypeSnapshot === 'radio') await form.getByRole('radio', { name: 'Enhanced' }).check();
    if (task.answerTypeSnapshot === 'dropdown_single') await form.locator('[name="answerOptionValue"]').selectOption({ label: 'Hybrid' });
    if (task.answerTypeSnapshot === 'checkbox_multi') {
        await form.getByRole('checkbox', { name: 'Risk assessment' }).check();
        await form.getByRole('checkbox', { name: 'Insurance' }).check();
    }
    if (task.answerTypeSnapshot === 'text_long') await form.locator('textarea[name="answerText"]').fill(`Completed by browser test ${runId}`);
    const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/task_answers/save')),
        form.getByRole('button', { name: 'Save & Complete' }).click()
    ]);
    expect(response.ok()).toBeTruthy();
}

test('admin builds a template and show, two users complete its six independent task snapshots', async ({ browser, page, users, testData }) => {
    test.setTimeout(180_000);
    await loginAs(page, users.alphaOwner);

    await page.goto('/workflow_templates/create_workflow_template');
    const templateForm = page.locator('form[action="/api/templates/create"]');
    await templateForm.locator('[name="templateName"]').fill(templateName);
    await templateForm.locator('[name="templateKey"]').fill(`browser-${runId}`);
    await templateForm.locator('[name="description"]').fill('Created entirely through the browser regression journey.');
    await templateForm.locator('[name="status"]').selectOption('published');
    await Promise.all([page.waitForURL('/templates'), templateForm.getByRole('button', { name: 'Create Template' }).click()]);
    const template = await databaseRow('SELECT id,status FROM tbl_workflow_templates WHERE tenantId=? AND templateName=?', [testData.tenants.alpha, templateName]);
    expect(template.status).toBe('published');

    const stageIds = [];
    for (const [index, phase] of phases.entries()) stageIds.push(await addPhase(page, template.id, phase, index));
    for (const [index, question] of questions.entries()) await addQuestion(page, template.id, stageIds[question.phase], question, (index + 1) * 10);

    await page.goto(`/workflow_templates/template_structure?id=${template.id}`);
    await expect(page.locator('#phaseCount')).toHaveText('4');
    await expect(page.locator('#taskCount')).toHaveText('6');

    await page.goto('/workflows/create');
    const showForm = page.locator('form[action="/api/workflows/create"]');
    await showForm.locator('[name="templateId"]').selectOption(String(template.id));
    await showForm.locator('[name="workflowName"]').fill(showName);
    await showForm.locator('[name="ownerTeamId"]').selectOption(String(testData.teams.alpha));
    await showForm.locator('[name="eventStatusId"]').selectOption(String(testData.statuses.alpha));
    await showForm.locator('[name="startDate"]').fill('2026-08-11');
    await showForm.locator('[name="targetDate"]').fill('2026-09-11');
    await Promise.all([page.waitForURL(url => url.pathname === '/workflows/view'), showForm.getByRole('button', { name: /Create/i }).click()]);
    const workflowId = Number(new URL(page.url()).searchParams.get('id'));
    const tasks = await withTestDb(async db => (await db.execute('SELECT id,taskName,answerTypeSnapshot,assignedToUserId FROM tbl_tasks WHERE workflowId=? ORDER BY taskDisplayOrder,id', [workflowId]))[0]);
    expect(tasks).toHaveLength(6);

    for (const [index, task] of tasks.entries()) await assignTask(page, task.id, testData.teams.alpha, index < 3 ? testData.users.alphaAdmin : testData.users.alphaMember);

    const adminSession = await browser.newContext();
    const adminPage = await adminSession.newPage();
    await loginAs(adminPage, users.alphaAdmin);
    for (const task of tasks.slice(0, 3)) await answerTask(adminPage, task);
    await adminSession.close();

    const memberSession = await browser.newContext();
    const memberPage = await memberSession.newPage();
    await loginAs(memberPage, users.alphaMember);
    for (const task of tasks.slice(3)) await answerTask(memberPage, task);
    await memberSession.close();

    await page.goto(`/workflows/view?id=${workflowId}&section=tasks`);
    for (let stageIndex = 0; stageIndex < 3; stageIndex += 1) {
        await page.locator('button[data-bs-target="#approveStageModal"]:visible').first().click();
        const progressionForm = page.locator('#approveStageModal form');
        const [progressionResponse] = await Promise.all([
            page.waitForResponse(r => r.url().includes('/api/workflow/approveStageProgression')),
            progressionForm.locator('button[type="submit"]').click()
        ]);
        expect(progressionResponse.ok()).toBeTruthy();
        await page.reload();
    }
    await page.locator('button[data-bs-target="#completeFinalStageModal"]:visible').first().click();
    const completionForm = page.locator('#completeFinalStageModal form');
    const [completionResponse] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/workflow/completeFinalStage')),
        completionForm.locator('button[type="submit"]').click()
    ]);
    expect(completionResponse.ok()).toBeTruthy();
    await page.reload();
    const result = await withTestDb(async db => {
        const [taskRows] = await db.execute('SELECT status,assignedToUserId FROM tbl_tasks WHERE workflowId=? ORDER BY id', [workflowId]);
        const [templateRows] = await db.execute('SELECT COUNT(*) taskCount FROM tbl_template_tasks WHERE templateId=? AND status=\'active\'', [template.id]);
        const [workflowRows] = await db.execute('SELECT status,currentStageId,completedDate FROM tbl_workflows WHERE id=?', [workflowId]);
        return { taskRows, templateCount: Number(templateRows[0].taskCount), workflow: workflowRows[0] };
    });
    expect(result.taskRows.filter(row => row.status === 'complete')).toHaveLength(6);
    expect(new Set(result.taskRows.map(row => Number(row.assignedToUserId)))).toEqual(new Set([testData.users.alphaAdmin, testData.users.alphaMember]));
    expect(result.templateCount).toBe(6);
    expect(result.workflow.status).toBe('complete');
    expect(result.workflow.currentStageId).toBeNull();
    expect(result.workflow.completedDate).toBeTruthy();
});
