const { test, expect, newAuthenticatedContext } = require('../../../fixtures/meldren');
const { postForm, row, workflowForm } = require('../../../support/phase2');

test.describe('Phase 2 workflow optimistic locking', () => {
    test('P2-13 a stale workflow update is rejected without overwriting the first save', async ({ browser, users, testData }) => {
        const a = await newAuthenticatedContext(browser, users.alphaOwner);
        const b = await newAuthenticatedContext(browser, users.alphaAdmin);
        try {
            const original = await row('SELECT * FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
            const first = await postForm(a.page, '/api/workflows/update_versioned', workflowForm(testData, {
                rowVersion: String(original.rowVersion), workflowName: 'E2E Concurrent Winner', notes: original.notes || ''
            }));
            expect(first.status()).toBe(200);
            const stale = await postForm(b.page, '/api/workflows/update_versioned', workflowForm(testData, {
                rowVersion: String(original.rowVersion), workflowName: original.workflowName, notes: 'E2E stale losing notes'
            }));
            expect(stale.status()).toBe(409);
            expect(await stale.text()).toMatch(/another user|changed|latest|version/i);
            const final = await row('SELECT workflowName,notes,rowVersion FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
            expect(final.workflowName).toBe('E2E Concurrent Winner');
            expect(final.notes).not.toBe('E2E stale losing notes');
        } finally { await a.context.close(); await b.context.close(); }
    });

    test('P2-14 reloading the latest version permits a safe retry', async ({ browser, users, testData }) => {
        const a = await newAuthenticatedContext(browser, users.alphaOwner);
        const b = await newAuthenticatedContext(browser, users.alphaAdmin);
        try {
            const original = await row('SELECT * FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
            await postForm(a.page, '/api/workflows/update_versioned', workflowForm(testData, { rowVersion: String(original.rowVersion), workflowName: 'E2E Retry Winner' }));
            const stale = await postForm(b.page, '/api/workflows/update_versioned', workflowForm(testData, { rowVersion: String(original.rowVersion), notes: 'stale' }));
            expect(stale.status()).toBe(409);
            const latest = await row('SELECT * FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
            const retry = await postForm(b.page, '/api/workflows/update_versioned', workflowForm(testData, {
                rowVersion: String(latest.rowVersion), workflowName: latest.workflowName, notes: 'E2E safe retry notes'
            }));
            expect(retry.status()).toBe(200);
            const final = await row('SELECT workflowName,notes FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
            expect(final).toMatchObject({ workflowName: 'E2E Retry Winner', notes: 'E2E safe retry notes' });
        } finally { await a.context.close(); await b.context.close(); }
    });
});
