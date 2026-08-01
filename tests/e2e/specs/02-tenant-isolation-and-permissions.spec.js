const {
    test, expect, loginAs, newAuthenticatedContext, responseHasNoRecord,
    expectPageAccessDenied, withTestDb
} = require('../fixtures/meldren');

async function apiJson(page, url) {
    const response = await page.request.get(url);
    expect(response.ok(), 'GET ' + url + ' returned ' + response.status()).toBeTruthy();
    return response.json();
}

test.describe('Tenant isolation and permissions', () => {
    test('5. tenant lists, searches and dropdowns remain isolated', async ({ browser, users }) => {
        const alpha = await newAuthenticatedContext(browser, users.alphaOwner);
        const beta = await newAuthenticatedContext(browser, users.betaOwner);
        try {
            const alphaWorkflows = await apiJson(alpha.page, '/api/workflows/list');
            const betaWorkflows = await apiJson(beta.page, '/api/workflows/list');
            expect(JSON.stringify(alphaWorkflows)).toContain('E2E Alpha Event');
            expect(responseHasNoRecord(alphaWorkflows, 'E2E Beta Event')).toBeTruthy();
            expect(JSON.stringify(betaWorkflows)).toContain('E2E Beta Event');
            expect(responseHasNoRecord(betaWorkflows, 'E2E Alpha Event')).toBeTruthy();

            await alpha.page.goto('/workflows');
            await expect(alpha.page.locator('#workflowBoard tbody tr')).toHaveCount(1);
            await expect(alpha.page.getByText('E2E Beta Event', { exact: true })).toHaveCount(0);
            await alpha.page.getByLabel('Search event overview').fill('E2E Beta Event');
            await expect(alpha.page.getByText('E2E Beta Event', { exact: true })).toHaveCount(0);

            for (const [url, ownValue, foreignValue] of [
                ['/api/locations/options', 'E2E Alpha Location', 'E2E Beta Location'],
                ['/api/teams/list_all_teams', 'E2E Alpha Team', 'E2E Beta Team'],
                ['/api/tenant/users/team_options', 'E2E Alpha Team', 'E2E Beta Team']
            ]) {
                const body = await apiJson(alpha.page, url);
                expect(JSON.stringify(body), url + ' should contain own tenant data').toContain(ownValue);
                expect(responseHasNoRecord(body, foreignValue), url + ' leaked another tenant').toBeTruthy();
            }
            const dashboard = await apiJson(alpha.page, '/api/dashboard/overview');
            expect(responseHasNoRecord(dashboard, 'E2E Beta Event')).toBeTruthy();
        } finally {
            await alpha.context.close();
            await beta.context.close();
        }
    });

    test('6. direct UI and Server Connect access cannot cross tenants', async ({ browser, users, testData }) => {
        const alpha = await newAuthenticatedContext(browser, users.alphaOwner);
        const beta = await newAuthenticatedContext(browser, users.betaOwner);
        try {
            await alpha.page.goto('/workflows/view?id=' + testData.workflows.beta);
            await expect(alpha.page.getByText('E2E Beta Event', { exact: true })).toHaveCount(0);

            const detail = await alpha.page.request.get('/api/workflows/get?id=' + testData.workflows.beta);
            expect(detail.ok()).toBeTruthy();
            expect(responseHasNoRecord(await detail.json(), 'E2E Beta Event')).toBeTruthy();

            const attemptedName = 'E2E Beta Event Cross-Tenant Attempt';
            const update = await alpha.page.request.post('/api/workflows/update_versioned', {
                form: {
                    id: String(testData.workflows.beta),
                    rowVersion: '1',
                    workflowName: attemptedName,
                    referenceCode: 'E2E-BETA',
                    notes: '',
                    eventStatusId: String(testData.statuses.alpha),
                    ownerTeamId: '',
                    workflowTypeId: '',
                    contractingEntityId: '',
                    locationId: '',
                    spaceId: '',
                    configurationId: '',
                    startDate: '',
                    targetDate: '',
                    showDate: '',
                    showTime: ''
                }
            });
            expect([401, 403, 404]).toContain(update.status());

            test.info().annotations.push({ type: 'note', description: 'No workflow delete/archive endpoint exists in this build, so no destructive cross-tenant request was issued.' });
            const betaDetail = await apiJson(beta.page, '/api/workflows/get?id=' + testData.workflows.beta);
            expect(JSON.stringify(betaDetail)).toContain('E2E Beta Event');
            expect(JSON.stringify(betaDetail)).not.toContain(attemptedName);
        } finally {
            await alpha.context.close();
            await beta.context.close();
        }
    });

    test('7. ordinary member is refused tenant administration in UI and API', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaMember);
        await expect(page.locator('a[href="/administration"]')).toBeHidden();
        await expect(page.locator('a[href="/configuration"]')).toBeHidden();
        for (const url of ['/users/all_users', '/users/create_user', '/configuration', '/settings']) {
            await expectPageAccessDenied(page, url);
        }
        const roles = await page.request.get('/api/tenant/users/role_options_v2');
        expect([401, 403, 404]).toContain(roles.status());
        const saveRoles = await page.request.post('/api/tenant/users/update_roles', {
            form: { userId: String(testData.users.alphaAdmin), 'roleIds[]': '2' }
        });
        expect([401, 403, 404]).toContain(saveRoles.status());
    });

    test('8. tenant owner can update an idempotent E2E user role', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaOwner);
        await page.goto('/users/edit_user?userid=' + testData.users.alphaAdmin);
        await expect(page.getByRole('heading', { name: /manage user roles/i })).toBeVisible();
        await expect(page.locator('#edit_role_2')).toBeChecked();
        await page.locator('#edit_role_3').check();
        await Promise.all([
            page.waitForURL(/\/users\/all_users\?roles_updated=1/),
            page.getByRole('button', { name: /^save roles$/i }).click()
        ]);
        await page.goto('/users/edit_user?userid=' + testData.users.alphaAdmin);
        await expect(page.locator('#edit_role_2')).toBeChecked();
        await expect(page.locator('#edit_role_3')).toBeChecked();
        const usersList = await apiJson(page, '/api/tenant/users/list_v2');
        expect(JSON.stringify(usersList)).toContain(users.alphaAdmin.email);
    });

    test('9. viewer can read but cannot edit, delete or archive', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaViewer);
        const view = await page.request.get('/api/workflows/get?id=' + testData.workflows.alpha);
        expect(view.ok()).toBeTruthy();
        expect(JSON.stringify(await view.json())).toContain('E2E Alpha Event');
        await expectPageAccessDenied(page, '/workflows/edit?id=' + testData.workflows.alpha);

        const update = await page.request.post('/api/workflows/update_versioned', {
            form: {
                id: String(testData.workflows.alpha),
                rowVersion: '1',
                workflowName: 'E2E Alpha Event Viewer Attempt',
                referenceCode: 'E2E-ALPHA',
                notes: '',
                eventStatusId: String(testData.statuses.alpha),
                ownerTeamId: String(testData.teams.alpha),
                workflowTypeId: String(testData.workflowTypes.alpha),
                locationId: String(testData.locations.alpha),
                startDate: '',
                targetDate: ''
            }
        });
        const after = await withTestDb(async db => {
            const [rows] = await db.execute('SELECT workflowName,rowVersion FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
            if (rows[0] && rows[0].workflowName !== 'E2E Alpha Event') {
                await db.execute("UPDATE tbl_workflows SET workflowName='E2E Alpha Event',rowVersion=1 WHERE id=?", [testData.workflows.alpha]);
            }
            return rows[0];
        });
        expect([401, 403, 404]).toContain(update.status());
        expect(after.workflowName).toBe('E2E Alpha Event');
        test.info().annotations.push({ type: 'note', description: 'No workflow delete/archive endpoint exists in this build.' });
    });
});
