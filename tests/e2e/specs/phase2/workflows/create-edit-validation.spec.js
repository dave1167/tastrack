const { test, expect, loginAs, newAuthenticatedContext } = require('../../../fixtures/meldren');
const { postForm, row, count, workflowForm } = require('../../../support/phase2');

test.describe('Phase 2 workflows: creation, editing and validation', () => {
    test('P2-1 authorised owner creates a tenant-isolated workflow with persisted values', async ({ browser, users, testData }) => {
        const alpha = await newAuthenticatedContext(browser, users.alphaOwner);
        const beta = await newAuthenticatedContext(browser, users.betaOwner);
        const name = 'E2E Workflow Alpha Created';
        try {
            const response = await postForm(alpha.page, '/api/workflows/create', {
                templateId: String(testData.templates.alpha), workflowName: name, referenceCode: 'E2E-P2-CREATE',
                notes: 'Representative Phase 2 optional notes', eventStatusId: String(testData.statuses.alpha),
                ownerTeamId: String(testData.teams.alpha), startDate: '2026-09-01', targetDate: '2026-10-01',
                workflowTypeId: String(testData.workflowTypes.alpha), locationId: String(testData.locations.alpha),
                spaceId: String(testData.spaces.alpha), configurationId: String(testData.configurations.alpha), contractingEntityId: ''
            });
            expect(response.status()).toBe(302);
            const created = await row('SELECT * FROM tbl_workflows WHERE workflowName=?', [name]);
            expect(created).toMatchObject({ tenantId: testData.tenants.alpha, referenceCode: 'E2E-P2-CREATE', notes: 'Representative Phase 2 optional notes' });
            expect(Number(created.ownerTeamId)).toBe(testData.teams.alpha);
            expect(Number(created.locationId)).toBe(testData.locations.alpha);
            await alpha.page.goto('/workflows/view?id=' + created.id);
            await expect(alpha.page.locator('main')).toContainText(name);
            await alpha.page.reload();
            await expect(alpha.page.locator('main')).toContainText(name);
            const betaDetail = await beta.page.request.get('/api/workflows/get?id=' + created.id);
            expect(JSON.stringify(await betaDetail.json())).not.toContain(name);
        } finally {
            await alpha.context.close(); await beta.context.close();
        }
    });

    test('P2-2 workflow edits persist and increment row version without losing untouched data', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaOwner);
        const before = await row('SELECT * FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
        const response = await postForm(page, '/api/workflows/update_versioned', workflowForm(testData, {
            rowVersion: String(before.rowVersion), workflowName: 'E2E Alpha Event Edited', notes: 'Edited Phase 2 notes',
            startDate: '2026-09-12', targetDate: '2026-10-12'
        }));
        expect(response.status()).toBe(200);
        const after = await row('SELECT * FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
        expect(after.workflowName).toBe('E2E Alpha Event Edited');
        expect(after.notes).toBe('Edited Phase 2 notes');
        expect(Number(after.rowVersion)).toBe(Number(before.rowVersion) + 1);
        expect(Number(after.eventStatusId)).toBe(Number(before.eventStatusId));
        expect(Number(after.ownerTeamId)).toBe(Number(before.ownerTeamId));
        await page.reload();
        const detail = await page.request.get('/api/workflows/get?id=' + testData.workflows.alpha);
        expect(JSON.stringify(await detail.json())).toContain('E2E Alpha Event Edited');
    });

    test('P2-3 required fields are blocked by browser validation and direct submission', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaOwner);
        await page.goto('/workflows/create');
        expect(await page.locator('form[action="/api/workflows/create"]').evaluate(form => form.checkValidity())).toBeFalsy();
        const before = await count("SELECT COUNT(*) total FROM tbl_workflows WHERE referenceCode='E2E-P2-INVALID'");
        const response = await postForm(page, '/api/workflows/create', {
            templateId: String(testData.templates.alpha), workflowName: '', referenceCode: 'E2E-P2-INVALID',
            eventStatusId: String(testData.statuses.alpha), ownerTeamId: String(testData.teams.alpha),
            startDate: '2026-09-01', targetDate: '2026-10-01'
        });
        expect(response.status()).toBeGreaterThanOrEqual(400);
        expect(await count("SELECT COUNT(*) total FROM tbl_workflows WHERE referenceCode='E2E-P2-INVALID'")).toBe(before);
    });

    test('P2-4 invalid workflow date combinations are rejected', async () => {
        test.skip(true, 'The current workflow specification has required dates but no defined ordering/range rules; end-before-start validation requires a product decision.');
    });

    test('P2-5 duplicate submission creates only one workflow', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaOwner);
        const form = {
            templateId: String(testData.templates.alpha), workflowName: 'E2E Duplicate Workflow', referenceCode: 'E2E-P2-DUP',
            eventStatusId: String(testData.statuses.alpha), ownerTeamId: String(testData.teams.alpha),
            startDate: '2026-09-01', targetDate: '2026-10-01'
        };
        await Promise.all([postForm(page, '/api/workflows/create', form), postForm(page, '/api/workflows/create', form)]);
        expect(await count("SELECT COUNT(*) total FROM tbl_workflows WHERE tenantId=? AND referenceCode='E2E-P2-DUP'", [testData.tenants.alpha])).toBe(1);
    });

    test('P2-6 cancelling an edit leaves persisted values unchanged', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaOwner);
        const before = await row('SELECT workflowName,notes,rowVersion FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
        await page.goto('/workflows/edit?id=' + testData.workflows.alpha);
        await page.locator('[name="workflowName"]').fill('E2E Unsaved Workflow Name');
        await page.getByRole('link', { name: /cancel/i }).click();
        const after = await row('SELECT workflowName,notes,rowVersion FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
        expect(after).toEqual(before);
        test.info().annotations.push({ type: 'usability', description: 'The workflow editor does not currently warn before discarding unsaved changes.' });
    });
});
