const fs = require('fs');
const mysql = require('mysql2/promise');
const { test: base, expect } = require('@playwright/test');
const { statePath } = require('../setup/seed-test-data');
const { databaseConnection } = require('../support/environment');

function loadTestData() {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function testUsers() {
    const password = process.env.E2E_USER_PASSWORD;
    return {
        alphaOwner: { email: process.env.E2E_OWNER_ALPHA_EMAIL, password, firstName: 'Alice', tenant: 'E2E Tenant Alpha' },
        alphaAdmin: { email: process.env.E2E_ADMIN_ALPHA_EMAIL, password, firstName: 'Aaron', tenant: 'E2E Tenant Alpha' },
        alphaMember: { email: process.env.E2E_MEMBER_ALPHA_EMAIL, password, firstName: 'Amelia', tenant: 'E2E Tenant Alpha' },
        alphaViewer: { email: process.env.E2E_VIEWER_ALPHA_EMAIL, password, firstName: 'Avery', tenant: 'E2E Tenant Alpha' },
        alphaInactive: { email: process.env.E2E_INACTIVE_ALPHA_EMAIL, password, firstName: 'Imogen', tenant: 'E2E Tenant Alpha' },
        betaOwner: { email: process.env.E2E_OWNER_BETA_EMAIL, password, firstName: 'Beatrice', tenant: 'E2E Tenant Beta' },
        betaMember: { email: process.env.E2E_MEMBER_BETA_EMAIL, password, firstName: 'Benjamin', tenant: 'E2E Tenant Beta' }
    };
}

async function loginAs(page, user) {
    const submit = async () => {
        await page.goto('/login/login');
        await page.getByTestId('login-email').fill(user.email);
        await page.getByTestId('login-password').fill(user.password);
        await Promise.all([
            page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 }),
            page.getByRole('button', { name: /^sign in$/i }).click()
        ]);
    };
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            await submit();
            lastError = null;
            break;
        } catch (error) {
            lastError = error;
            if (!new URL(page.url()).pathname.startsWith('/login')) throw error;
        }
    }
    if (lastError) throw lastError;
    await expect(page.getByTestId('authenticated-user'), 'authenticated user indicator for ' + user.email).toContainText(user.firstName);
}

async function newAuthenticatedContext(browser, user) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, user);
    return { context, page };
}

async function getSessionContext(page) {
    const response = await page.request.get('/api/security/sessionContext');
    return { response, body: response.ok() ? await response.json() : null };
}

function responseHasNoRecord(body, recordName) {
    return !JSON.stringify(body || {}).includes(recordName);
}

async function expectPageAccessDenied(page, url) {
    const response = await page.goto(url);
    const pathname = new URL(page.url()).pathname;
    expect(
        [401, 403, 404].includes(response ? response.status() : 0) ||
        ['/login/login', '/unauthorised'].includes(pathname),
        'expected page access to be refused for ' + url + ', received ' + pathname
    ).toBeTruthy();
}

async function withTestDb(callback) {
    const connection = await mysql.createConnection(databaseConnection(process.env.E2E_DB_NAME));
    try {
        return await callback(connection);
    } finally {
        await connection.end();
    }
}

const test = base.extend({
    testData: async ({}, use) => use(loadTestData()),
    users: async ({}, use) => use(testUsers())
});

module.exports = {
    test,
    expect,
    loginAs,
    newAuthenticatedContext,
    getSessionContext,
    responseHasNoRecord,
    expectPageAccessDenied,
    withTestDb
};
