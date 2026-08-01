const { test, expect, loginAs, newAuthenticatedContext, withTestDb } = require('../../../fixtures/meldren');
const { postForm, row } = require('../../../support/phase2');

test.describe('Phase 2 saved board views', () => {
    test('P2-19 personal board columns persist across refresh and login', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaOwner);
        expect((await postForm(page, '/api/board_views/savePersonal', {
            viewName: 'E2E Alpha Board View', showTemplate: '0', showTargetDate: '1', showOwner: '1', showProgress: '1', showStatus: '1', showRisk: '0'
        })).status()).toBe(302);
        let effective = await page.request.get('/api/board_views/effective');
        let body = await effective.json();
        expect(JSON.stringify(body)).toContain('E2E Alpha Board View');
        expect(body.columns.find(column => column.fieldKey === 'templateName').isVisible).toBe(0);
        await page.getByTestId('sign-out').click(); await page.waitForURL(/login/); await loginAs(page, users.alphaOwner);
        effective = await page.request.get('/api/board_views/effective'); body = await effective.json();
        expect(JSON.stringify(body)).toContain('E2E Alpha Board View');
        test.info().annotations.push({ type: 'limitation', description: 'Current board APIs persist columns but expose no filter or sort persistence controls.' });
    });

    test('P2-20 personal board views remain separate between same-tenant users', async ({ browser, users }) => {
        const a = await newAuthenticatedContext(browser, users.alphaOwner);
        const b = await newAuthenticatedContext(browser, users.alphaAdmin);
        try {
            await postForm(a.page, '/api/board_views/savePersonal', { viewName: 'E2E Owner Board', showTemplate: '0', showTargetDate: '1', showOwner: '1', showProgress: '1', showStatus: '1', showRisk: '0' });
            await postForm(b.page, '/api/board_views/savePersonal', { viewName: 'E2E Admin Board', showTemplate: '1', showTargetDate: '0', showOwner: '0', showProgress: '1', showStatus: '1', showRisk: '1' });
            const owner = await (await a.page.request.get('/api/board_views/effective')).json();
            const admin = await (await b.page.request.get('/api/board_views/effective')).json();
            expect(JSON.stringify(owner)).toContain('E2E Owner Board'); expect(JSON.stringify(owner)).not.toContain('E2E Admin Board');
            expect(JSON.stringify(admin)).toContain('E2E Admin Board'); expect(JSON.stringify(admin)).not.toContain('E2E Owner Board');
        } finally { await a.context.close(); await b.context.close(); }
    });

    test('P2-21 personal view overrides a tenant default without modifying it', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaMember);
        await withTestDb(async db => {
            const [view] = await db.execute("INSERT INTO tbl_board_views (tenantId,userId,viewName,viewType,isDefault) VALUES (?,NULL,'E2E Tenant Default Board','tenant',1)", [testData.tenants.alpha]);
            await db.execute("INSERT INTO tbl_board_view_columns (boardViewId,fieldKey,columnLabel,isVisible,sortOrder) VALUES (?,'workflowName','Workflow',1,10)", [view.insertId]);
        });
        expect(JSON.stringify(await (await page.request.get('/api/board_views/effective')).json())).toContain('E2E Tenant Default Board');
        await postForm(page, '/api/board_views/savePersonal', { viewName: 'E2E Member Override', showTemplate: '1', showTargetDate: '1', showOwner: '0', showProgress: '1', showStatus: '1', showRisk: '0' });
        expect(JSON.stringify(await (await page.request.get('/api/board_views/effective')).json())).toContain('E2E Member Override');
        expect((await row("SELECT viewName FROM tbl_board_views WHERE tenantId=? AND userId IS NULL AND isDefault=1", [testData.tenants.alpha])).viewName).toBe('E2E Tenant Default Board');
    });
});

