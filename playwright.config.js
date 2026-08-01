const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { loadAndValidateTestEnvironment } = require('./tests/e2e/support/environment');

loadAndValidateTestEnvironment();

module.exports = defineConfig({
    testDir: path.join(__dirname, 'tests', 'e2e', 'specs'),
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    timeout: 45_000,
    expect: { timeout: 8_000 },
    reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
    use: {
        baseURL: process.env.E2E_BASE_URL,
        actionTimeout: 10_000,
        navigationTimeout: 20_000,
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        ...devices['Desktop Chrome']
    },
    outputDir: 'test-results'
});
