const { test, expect, loginAs, newAuthenticatedContext } = require('../../../fixtures/meldren');
const { postForm, row, taskForm } = require('../../../support/phase2');

test.describe('Phase 2 task lifecycle', () => {
    test('P2-7 task creation preserves tenant, workflow, phase and assignment', async ({ browser, users, testData }) => {
        const alpha = await newAuthenticatedContext(browser, users.alphaOwner);
        const beta = await newAuthenticatedContext(browser, users.betaOwner);
        try {
            const response = await postForm(alpha.page, '/api/workflows/create_task', {
                workflowId: String(testData.workflows.alpha), workflowStageId: String(testData.workflowStages.alpha),
                taskName: 'E2E Phase 2 Created Task', description: 'Created through normal Server Connect', priority: 'high',
                isRequired: '1', assignment: 'team:' + testData.teams.alpha, assignedUserId: '', dueDate: '2026-10-15 12:00:00'
            });
            expect(response.status()).toBe(302);
            const created = await row("SELECT * FROM tbl_tasks WHERE taskName='E2E Phase 2 Created Task'");
            expect(Number(created.tenantId)).toBe(testData.tenants.alpha);
            expect(Number(created.workflowId)).toBe(testData.workflows.alpha);
            expect(Number(created.workflowStageId)).toBe(testData.workflowStages.alpha);
            expect(Number(created.assignedToTeamId)).toBe(testData.teams.alpha);
            const betaResult = await beta.page.request.get('/api/tasks/get?id=' + created.id);
            expect(JSON.stringify(await betaResult.json())).not.toContain('E2E Phase 2 Created Task');
        } finally { await alpha.context.close(); await beta.context.close(); }
    });

    test('P2-8 supported task statuses persist and unauthorised status changes are refused', async ({ browser, users, testData }) => {
        const owner = await newAuthenticatedContext(browser, users.alphaOwner);
        const viewer = await newAuthenticatedContext(browser, users.alphaViewer);
        try {
            for (const status of ['in_progress', 'complete']) {
                const response = await postForm(owner.page, '/api/tasks/update_status', { id: String(testData.tasks.alpha), workflowId: String(testData.workflows.alpha), status });
                expect(response.status()).toBe(302);
                expect((await row('SELECT status FROM tbl_tasks WHERE id=?', [testData.tasks.alpha])).status).toBe(status);
            }
            const completed = await row('SELECT completedDate,completedByUserId FROM tbl_tasks WHERE id=?', [testData.tasks.alpha]);
            expect(completed.completedDate).toBeTruthy();
            expect(Number(completed.completedByUserId)).toBe(testData.users.alphaOwner);
            const denied = await postForm(viewer.page, '/api/tasks/update_status', { id: String(testData.tasks.alpha), workflowId: String(testData.workflows.alpha), status: 'not_started' });
            expect(denied.status()).toBeGreaterThanOrEqual(400);
            expect((await row('SELECT status FROM tbl_tasks WHERE id=?', [testData.tasks.alpha])).status).toBe('complete');
        } finally { await owner.context.close(); await viewer.context.close(); }
    });

    test('P2-9 authorised task edits persist while viewer reassignment is refused', async ({ browser, users, testData }) => {
        const owner = await newAuthenticatedContext(browser, users.alphaOwner);
        const viewer = await newAuthenticatedContext(browser, users.alphaViewer);
        try {
            const current = await row('SELECT rowVersion FROM tbl_tasks WHERE id=?', [testData.tasks.alpha]);
            const response = await postForm(owner.page, '/api/tasks/update', taskForm(testData, testData.tasks.alpha, {
                rowVersion: String(current.rowVersion), taskName: 'E2E Alpha Task Edited', description: 'Edited task notes', priority: 'urgent', dueDate: '2026-11-01 09:30:00'
            }));
            expect(response.status()).toBe(200);
            const saved = await row('SELECT * FROM tbl_tasks WHERE id=?', [testData.tasks.alpha]);
            expect(saved.taskName).toBe('E2E Alpha Task Edited');
            expect(saved.priority).toBe('urgent');
            const denied = await postForm(viewer.page, '/api/tasks/update', taskForm(testData, testData.tasks.alpha, {
                rowVersion: String(saved.rowVersion), taskName: 'Viewer illegal edit', assignedUserId: String(testData.users.alphaViewer)
            }));
            expect(denied.status()).toBe(403);
            expect((await row('SELECT taskName FROM tbl_tasks WHERE id=?', [testData.tasks.alpha])).taskName).toBe('E2E Alpha Task Edited');
        } finally { await owner.context.close(); await viewer.context.close(); }
    });

    test('P2-15 separate users can update different tasks without cross-over', async ({ browser, users, testData }) => {
        const owner = await newAuthenticatedContext(browser, users.alphaOwner);
        const admin = await newAuthenticatedContext(browser, users.alphaAdmin);
        try {
            const firstVersion = await row('SELECT rowVersion FROM tbl_tasks WHERE id=?', [testData.tasks.alpha]);
            const secondVersion = await row('SELECT rowVersion FROM tbl_tasks WHERE id=?', [testData.tasks.alphaTwo]);
            const [a, b] = await Promise.all([
                postForm(owner.page, '/api/tasks/update', taskForm(testData, testData.tasks.alpha, { rowVersion: String(firstVersion.rowVersion), taskName: 'E2E Parallel Task A' })),
                postForm(admin.page, '/api/tasks/update', taskForm(testData, testData.tasks.alphaTwo, { rowVersion: String(secondVersion.rowVersion), taskName: 'E2E Parallel Task B', isRequired: '0', assignedUserId: String(testData.users.alphaAdmin) }))
            ]);
            expect(a.status()).toBe(200); expect(b.status()).toBe(200);
            const first = await row('SELECT taskName FROM tbl_tasks WHERE id=?', [testData.tasks.alpha]);
            const second = await row('SELECT taskName FROM tbl_tasks WHERE id=?', [testData.tasks.alphaTwo]);
            expect(first.taskName).toBe('E2E Parallel Task A'); expect(second.taskName).toBe('E2E Parallel Task B');
        } finally { await owner.context.close(); await admin.context.close(); }
    });
});
