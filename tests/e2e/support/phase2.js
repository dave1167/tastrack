const { expect, withTestDb } = require('../fixtures/meldren');

async function postForm(page, url, form) {
    const csrf = await page.locator('input[name="CSRFToken"]').first().inputValue().catch(() => '');
    return page.request.post(url, { form: csrf ? { ...form, CSRFToken: csrf } : form, maxRedirects: 0 });
}

async function row(sql, params = []) {
    return withTestDb(async db => {
        const [rows] = await db.execute(sql, params);
        return rows[0] || null;
    });
}

async function rows(sql, params = []) {
    return withTestDb(async db => {
        const [result] = await db.execute(sql, params);
        return result;
    });
}

async function count(sql, params = []) {
    const result = await row(sql, params);
    return Number(result ? Object.values(result)[0] : 0);
}

function workflowForm(testData, values = {}) {
    return {
        id: String(testData.workflows.alpha),
        rowVersion: '1',
        workflowName: 'E2E Alpha Event',
        referenceCode: 'E2E-ALPHA',
        notes: 'Tenant Alpha workflow notes',
        eventStatusId: String(testData.statuses.alpha),
        ownerTeamId: String(testData.teams.alpha),
        workflowTypeId: String(testData.workflowTypes.alpha),
        contractingEntityId: '',
        locationId: String(testData.locations.alpha),
        spaceId: String(testData.spaces.alpha),
        configurationId: String(testData.configurations.alpha),
        startDate: '2026-09-10',
        targetDate: '2026-10-10',
        ...values
    };
}

function taskForm(testData, taskId, values = {}) {
    return {
        id: String(taskId),
        rowVersion: '1',
        taskName: taskId === testData.tasks.alphaTwo ? 'E2E Alpha Task Two' : 'E2E Alpha Task',
        description: 'Phase 2 task description',
        status: 'not_started',
        priority: 'normal',
        isRequired: '1',
        assignment: 'team:' + testData.teams.alpha,
        assignedUserId: String(testData.users.alphaMember),
        dueDate: '2026-10-01 12:00:00',
        locationMode: 'inherit',
        locationId: '',
        spaceId: '',
        configurationId: '',
        ...values
    };
}

async function expectTenantRow(sql, params, tenantId) {
    const result = await row(sql, params);
    expect(result).toBeTruthy();
    expect(Number(result.tenantId)).toBe(Number(tenantId));
    return result;
}

module.exports = { postForm, row, rows, count, workflowForm, taskForm, expectTenantRow };
