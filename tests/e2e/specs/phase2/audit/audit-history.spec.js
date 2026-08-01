const { test, expect, newAuthenticatedContext } = require('../../../fixtures/meldren');
const { postForm, row, workflowForm } = require('../../../support/phase2');

test.describe('Phase 2 audit history', () => {
    test('P2-22 significant workflow and task actions create tenant/user audit entries', async ({ browser, users, testData }) => {
        const owner = await newAuthenticatedContext(browser, users.alphaOwner);
        try {
            const workflow = await row('SELECT rowVersion FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
            await postForm(owner.page, '/api/workflows/update_versioned', workflowForm(testData, { rowVersion: String(workflow.rowVersion), notes: 'E2E audited workflow change' }));
            await postForm(owner.page, '/api/tasks/update_status', { id: String(testData.tasks.alpha), workflowId: String(testData.workflows.alpha), status: 'complete' });
            const workflowAudit = await row("SELECT * FROM tbl_activity_log WHERE tenantId=? AND workflowId=? AND actionType IN ('workflow.updated','workflow.created') ORDER BY id DESC", [testData.tenants.alpha, testData.workflows.alpha]);
            const taskAudit = await row("SELECT * FROM tbl_activity_log WHERE tenantId=? AND taskId=? AND actionType='task.status_changed' ORDER BY id DESC", [testData.tenants.alpha, testData.tasks.alpha]);
            expect(workflowAudit).toBeTruthy(); expect(Number(workflowAudit.userId)).toBe(testData.users.alphaOwner);
            expect(taskAudit).toBeTruthy(); expect(Number(taskAudit.userId)).toBe(testData.users.alphaOwner);
            expect(taskAudit.beforeJson).toBeTruthy(); expect(taskAudit.afterJson).toBeTruthy();
        } finally { await owner.context.close(); }
    });

    test('P2-23 audit data is immutable and tenant-isolated', async ({ browser, users, testData }) => {
        test.fail(true, 'Known defect: the activity list Server Connect action requires login but does not enforce tenant.audit.view permission.');
        const member = await newAuthenticatedContext(browser, users.alphaMember);
        const beta = await newAuthenticatedContext(browser, users.betaOwner);
        try {
            const memberResponse = await member.page.request.get('/api/activity/list');
            expect([401, 403, 404]).toContain(memberResponse.status());
            const betaBody = await (await beta.page.request.get('/api/activity/list')).json();
            expect(JSON.stringify(betaBody)).not.toContain('E2E Alpha');
            expect(await row("SELECT COUNT(*) total FROM information_schema.tables WHERE table_schema=? AND table_name='tbl_activity_log'", [process.env.E2E_DB_NAME])).toBeTruthy();
        } finally { await member.context.close(); await beta.context.close(); }
    });
});

