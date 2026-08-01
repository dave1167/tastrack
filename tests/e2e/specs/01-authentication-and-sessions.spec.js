const {
    test, expect, loginAs, newAuthenticatedContext, getSessionContext,
    expectPageAccessDenied, withTestDb
} = require('../fixtures/meldren');

test.describe('Authentication and isolated sessions', () => {
    test('1. successful login persists after refresh', async ({ page, users }) => {
        await loginAs(page, users.alphaOwner);
        await expect(page).toHaveURL(/\/$/);
        const session = await getSessionContext(page);
        expect(session.response.ok()).toBeTruthy();
        expect(session.body.TENANT_NAME).toBe('E2E Tenant Alpha');
        await page.reload();
        await expect(page.getByTestId('authenticated-user')).toContainText(users.alphaOwner.firstName);
    });

    test('2. invalid credentials and inactive users are refused', async ({ page, users }) => {
        await page.goto('/login/login');
        const invalid = await page.request.post('/api/login/login', {
            form: { username: users.alphaOwner.email, password: 'definitely-wrong' }
        });
        expect([401, 403]).toContain(invalid.status());
        expect(await invalid.text()).not.toMatch(/stack|sql|select|passwordHash/i);
        expect((await getSessionContext(page)).response.ok()).toBeFalsy();

        const inactive = await page.request.post('/api/login/login', {
            form: { username: users.alphaInactive.email, password: users.alphaInactive.password },
            maxRedirects: 0
        });
        expect([302, 401, 403]).toContain(inactive.status());
        if (inactive.status() === 302) expect(inactive.headers().location).toBe('/unauthorised');
        expect(await inactive.text()).not.toMatch(/stack|sql|select|passwordHash/i);
        expect((await getSessionContext(page)).response.ok()).toBeFalsy();
    });

    test('3. logout clears access, including browser back and Server Connect', async ({ page, users }) => {
        await loginAs(page, users.alphaOwner);
        await page.getByTestId('sign-out').click();
        await page.waitForURL(/\/login\/login/);
        expect((await getSessionContext(page)).response.ok()).toBeFalsy();
        await page.goBack();
        await page.reload();
        await expect(page).toHaveURL(/\/login\/login/);
        await expectPageAccessDenied(page, '/workflows');
        const protectedApi = await page.request.get('/api/workflows/list');
        expect([401, 403]).toContain(protectedApi.status());
    });

    test('4. simultaneous Alpha and Beta sessions remain separate', async ({ browser, users }) => {
        const alpha = await newAuthenticatedContext(browser, users.alphaOwner);
        const beta = await newAuthenticatedContext(browser, users.betaOwner);
        try {
            const alphaSession = await getSessionContext(alpha.page);
            const betaSession = await getSessionContext(beta.page);
            expect(alphaSession.body.TENANT_NAME).toBe('E2E Tenant Alpha');
            expect(betaSession.body.TENANT_NAME).toBe('E2E Tenant Beta');
            expect(JSON.stringify(alphaSession.body)).not.toContain(users.betaOwner.firstName);
            expect(JSON.stringify(betaSession.body)).not.toContain(users.alphaOwner.firstName);

            const activeSessions = await withTestDb(async db => {
                const [rows] = await db.query('SELECT sess FROM sessions WHERE expired>CURRENT_TIMESTAMP');
                return rows.filter(row => {
                    const value = String(row.sess);
                    return value.includes(String(alphaSession.body.USER_ID)) || value.includes(String(betaSession.body.USER_ID));
                }).length;
            });
            expect(activeSessions).toBeGreaterThanOrEqual(2);

            await alpha.page.getByTestId('sign-out').click();
            await alpha.page.waitForURL(/\/login\/login/);
            const betaStillActive = await getSessionContext(beta.page);
            expect(betaStillActive.response.ok()).toBeTruthy();
            expect(betaStillActive.body.TENANT_NAME).toBe('E2E Tenant Beta');
        } finally {
            await alpha.context.close();
            await beta.context.close();
        }
    });
});
