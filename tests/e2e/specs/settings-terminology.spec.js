const { test, expect, loginAs, withTestDb } = require('../fixtures/meldren');

test('tenant owner can save general terminology', async ({ page, users, testData }) => {
    await loginAs(page, users.alphaOwner);
    await page.goto('/settings');
    const terminologyResponse = await page.request.get('/api/settings/terminology');
    const terminologyBody = await terminologyResponse.json();
    expect(terminologyBody.query && terminologyBody.query[0], JSON.stringify(terminologyBody)).toBeTruthy();
    await expect(page.locator('#workflowPlural')).not.toHaveValue('');
    await expect(page.getByRole('heading', { name: 'Terminology', exact: true }).first()).toBeVisible();
    await page.locator('#workflowSingular').fill('Test Record');
    await page.locator('form[action="/api/settings/update_terminology"] button[type="submit"]').click();
    await page.waitForURL(/\/settings\?saved=1/);
    await expect(page.getByText('Terminology saved')).toBeVisible();
    await withTestDb(async db => {
        const [rows] = await db.execute("SELECT singularLabel FROM tbl_tenant_terminology WHERE tenantId=? AND termKey='workflow'", [testData.tenants.alpha]);
        expect(rows[0].singularLabel).toBe('Test Record');
    });
});
