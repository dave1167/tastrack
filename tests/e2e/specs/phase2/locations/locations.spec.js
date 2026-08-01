const { test, expect, loginAs, newAuthenticatedContext, withTestDb } = require('../../../fixtures/meldren');
const { postForm, row } = require('../../../support/phase2');

test.describe('Phase 2 locations, spaces and configurations', () => {
    test('P2-16 owner creates a tenant-isolated location whose values persist', async ({ browser, users, testData }) => {
        const alpha = await newAuthenticatedContext(browser, users.alphaOwner);
        const beta = await newAuthenticatedContext(browser, users.betaOwner);
        try {
            const response = await postForm(alpha.page, '/api/locations/create', {
                locationName: 'E2E Phase 2 Location', locationType: 'Venue', addressLine1: '1 Test Street',
                townCity: 'Alpha Town', postcode: 'E2E 2AA', country: 'United Kingdom'
            });
            expect(response.status()).toBe(302);
            const created = await row("SELECT * FROM tbl_locations WHERE locationName='E2E Phase 2 Location'");
            expect(Number(created.tenantId)).toBe(testData.tenants.alpha);
            expect(created.postcode).toBe('E2E 2AA');
            await alpha.page.goto('/locations'); await alpha.page.reload();
            await expect(alpha.page.locator('main')).toContainText('E2E Phase 2 Location');
            const betaOptions = await beta.page.request.get('/api/locations/options');
            expect(JSON.stringify(await betaOptions.json())).not.toContain('E2E Phase 2 Location');
        } finally { await alpha.context.close(); await beta.context.close(); }
    });

    test('P2-17 spaces and configurations can be created and assigned to a workflow', async ({ page, users, testData }) => {
        await loginAs(page, users.alphaOwner);
        await postForm(page, '/api/locations/create', { locationName: 'E2E Configurable Location', locationType: 'Venue', townCity: 'Alpha Town', country: 'United Kingdom' });
        const location = await row("SELECT * FROM tbl_locations WHERE locationName='E2E Configurable Location'");
        expect((await postForm(page, '/api/locations/createSpace', { locationId: String(location.id), spaceName: 'E2E Studio', spaceType: 'Studio', defaultCapacity: '120' })).status()).toBe(302);
        const space = await row("SELECT * FROM tbl_spaces WHERE spaceName='E2E Studio'");
        expect((await postForm(page, '/api/locations/createConfiguration', { spaceId: String(space.id), configurationName: 'E2E Standing', seatedCapacity: '0', standingCapacity: '110', maximumTotalCapacity: '110' })).status()).toBe(302);
        const configuration = await row("SELECT * FROM tbl_space_configurations WHERE configurationName='E2E Standing'");
        const workflow = await row('SELECT * FROM tbl_workflows WHERE id=?', [testData.workflows.alpha]);
        const response = await postForm(page, '/api/workflows/update_versioned', {
            id: String(workflow.id), rowVersion: String(workflow.rowVersion), workflowName: workflow.workflowName,
            referenceCode: workflow.referenceCode, notes: workflow.notes || '', eventStatusId: String(workflow.eventStatusId),
            ownerTeamId: String(workflow.ownerTeamId), workflowTypeId: String(workflow.workflowTypeId), contractingEntityId: '',
            locationId: String(location.id), spaceId: String(space.id), configurationId: String(configuration.id),
            startDate: new Date(workflow.startDate).toISOString().slice(0, 10), targetDate: new Date(workflow.targetDate).toISOString().slice(0, 10)
        });
        expect(response.status()).toBe(200);
        const saved = await row('SELECT locationId,spaceId,configurationId FROM tbl_workflows WHERE id=?', [workflow.id]);
        expect(Number(saved.locationId)).toBe(location.id); expect(Number(saved.spaceId)).toBe(space.id); expect(Number(saved.configurationId)).toBe(configuration.id);
    });

    test('P2-18 inactive locations remain historical but cannot be newly assigned', async ({ page, users, testData }) => {
        test.fail(true, 'Known defect: workflow update permits direct assignment of an inactive location.');
        await loginAs(page, users.alphaOwner);
        const workflowId = await withTestDb(async db => {
            const [created] = await db.execute("INSERT INTO tbl_workflows (tenantId,workflowTypeId,eventStatusId,workflowName,referenceCode,status,ownerUserId,ownerTeamId,locationId,startDate,targetDate,createdByUserId,modifiedByUserId,rowVersion) VALUES (?,?,?,'E2E Disabled Location Workflow','E2E-DISABLED-LOCATION','active',?,?,?,CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 10 DAY),?,?,1)", [testData.tenants.alpha, testData.workflowTypes.alpha, testData.statuses.alpha, testData.users.alphaOwner, testData.teams.alpha, testData.locations.alpha, testData.users.alphaOwner, testData.users.alphaOwner]);
            return created.insertId;
        });
        await withTestDb(db => db.execute('UPDATE tbl_locations SET isActive=0 WHERE id=?', [testData.locations.alpha]));
        const existing = await page.request.get('/api/workflows/get?id=' + workflowId);
        expect(JSON.stringify(await existing.json())).toContain('E2E Alpha Location');
        const options = await page.request.get('/api/locations/options');
        expect(JSON.stringify(await options.json())).not.toContain('E2E Alpha Location');
        const workflow = await row('SELECT * FROM tbl_workflows WHERE id=?', [workflowId]);
        await withTestDb(db => db.execute('UPDATE tbl_workflows SET locationId=NULL,spaceId=NULL,configurationId=NULL,rowVersion=rowVersion+1 WHERE id=?', [workflow.id]));
        const fresh = await row('SELECT * FROM tbl_workflows WHERE id=?', [workflow.id]);
        await postForm(page, '/api/workflows/update_versioned', {
            id: String(fresh.id), rowVersion: String(fresh.rowVersion), workflowName: fresh.workflowName, referenceCode: fresh.referenceCode,
            notes: fresh.notes || '', eventStatusId: String(fresh.eventStatusId), ownerTeamId: String(fresh.ownerTeamId), workflowTypeId: String(fresh.workflowTypeId),
            contractingEntityId: '', locationId: String(testData.locations.alpha), spaceId: '', configurationId: '',
            startDate: new Date(fresh.startDate).toISOString().slice(0, 10), targetDate: new Date(fresh.targetDate).toISOString().slice(0, 10)
        });
        expect((await row('SELECT locationId FROM tbl_workflows WHERE id=?', [fresh.id])).locationId).toBeNull();
    });
});
