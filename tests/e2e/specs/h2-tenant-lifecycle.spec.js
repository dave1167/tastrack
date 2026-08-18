const {test, expect, loginAs, newAuthenticatedContext, withTestDb} = require('../fixtures/meldren');
const {postForm} = require('../support/phase2');

test.describe('H2 tenant lifecycle enforcement', () => {
  test('read-only tenant can review but cannot mutate, without affecting another tenant', async ({browser, users, testData}) => {
    const alpha = await newAuthenticatedContext(browser, users.alphaOwner);
    try {
      await withTestDb(db => db.execute("UPDATE tbl_tenants SET tenantType='trial',lifecycleStatus='read_only',accessEndDate=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 DAY) WHERE id=?", [testData.tenants.alpha]));

      const readable = await alpha.page.request.get('/api/workflows/get?id=' + testData.workflows.alpha);
      expect(readable.ok()).toBeTruthy();
      expect(JSON.stringify(await readable.json())).toContain('E2E Alpha Event');

      const write = await postForm(alpha.page, '/api/workflows/update_versioned', {
        id: String(testData.workflows.alpha), rowVersion: '1', workflowName: 'H2 blocked mutation', referenceCode: 'E2E-ALPHA',
        notes: '', eventStatusId: String(testData.statuses.alpha), ownerTeamId: String(testData.teams.alpha),
        workflowTypeId: String(testData.workflowTypes.alpha), locationId: String(testData.locations.alpha), startDate: '', targetDate: ''
      });
      expect(write.status()).toBe(403);
      expect(await write.json()).toMatchObject({success: false, errorCode: 'TENANT_READ_ONLY'});

      await alpha.page.goto('/workflows');
      await expect(alpha.page.getByTestId('tenant-lifecycle-banner')).toBeVisible();
      await expect(alpha.page.getByTestId('tenant-lifecycle-banner')).toContainText('trial has ended');

      const [rows] = await withTestDb(db => db.execute('SELECT w.workflowName,t.lifecycleStatus FROM tbl_workflows w INNER JOIN tbl_tenants t ON t.id=w.tenantId WHERE w.id IN (?,?) ORDER BY w.id', [testData.workflows.alpha, testData.workflows.beta]));
      expect(rows.map(row => row.workflowName)).toContain('E2E Alpha Event');
      expect(rows.map(row => row.workflowName)).toContain('E2E Beta Event');
      expect(rows.find(row => row.workflowName === 'E2E Beta Event').lifecycleStatus).toBe('active');
    } finally {
      await withTestDb(db => db.execute("UPDATE tbl_tenants SET tenantType='live',lifecycleStatus='active',accessEndDate=NULL WHERE id=?", [testData.tenants.alpha]));
      await alpha.context.close();
    }
  });

  test('suspended tenant is refused a normal tenant login', async ({page, users, testData}) => {
    try {
      await withTestDb(db => db.execute("UPDATE tbl_tenants SET lifecycleStatus='suspended' WHERE id=?", [testData.tenants.alpha]));
      await page.goto('/login/login');
      await page.getByTestId('login-email').fill(users.alphaOwner.email);
      await page.getByTestId('login-password').fill(users.alphaOwner.password);
      await page.getByRole('button', {name: /^sign in$/i}).click();
      await page.waitForLoadState('networkidle');
      expect(['/login', '/login/login', '/unauthorised']).toContain(new URL(page.url()).pathname);
    } finally {
      await withTestDb(db => db.execute("UPDATE tbl_tenants SET lifecycleStatus='active' WHERE id=?", [testData.tenants.alpha]));
    }
  });
});
