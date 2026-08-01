const { test, expect, loginAs } = require('../fixtures/meldren');

test('10. principal Meldren pages pass a basic authenticated smoke check', async ({ page, users }) => {
    await loginAs(page, users.alphaOwner);
    const pages = [
        ['/', /dashboard/i],
        ['/workflows', /overview/i],
        ['/tasks', /inbox/i],
        ['/teams/teams', /teams/i],
        ['/users/all_users', /users/i],
        ['/locations', /locations/i],
        ['/settings', /terminology|settings/i],
        ['/configuration', /configuration/i]
    ];
    for (const [url, heading] of pages) {
        await test.step('owner opens ' + url, async () => {
            const response = await page.goto(url);
            expect(response.status(), url + ' response').toBeLessThan(400);
            await expect(page).not.toHaveURL(/\/login\/login/);
            await expect(page.locator('body')).not.toContainText(/Internal Server Error|ER_[A-Z_]+|\[object Object\]/);
            await expect(page.locator('main')).toContainText(heading);
            await expect(page.locator('main')).toBeVisible();
        });
    }
});
