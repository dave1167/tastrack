const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..');

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(root, '.wappler', 'targets', 'Development', 'app', 'modules', 'connections', 'db.json'), 'utf8')).options.connection;
  assert(['localhost', '127.0.0.1', '::1'].includes(config.host), 'H1 tests may only use a local development database.');
  assert(!/prod|production|live/i.test(config.database), 'H1 tests refuse a production-looking database.');
  const db = await mysql.createConnection(config);
  await db.beginTransaction();
  try {
    const suffix = Date.now();
    const insertTenant = async (name, slug, type, status) => {
      const [result] = await db.execute("INSERT INTO tbl_tenants (tenantName,tenantSlug,status,timezone,locale,defaultCurrency,billingEmail,isActive,tenantType,lifecycleStatus) VALUES (?,?,1,'Europe/London','en-GB','GBP',?,1,?,?)", [name, slug, `${slug}@example.test`, type, status]);
      return result.insertId;
    };
    const live = await insertTenant('H1 Live', `h1-live-${suffix}`, 'live', 'active');
    const demoA = await insertTenant('H1 Demo A', `h1-demo-a-${suffix}`, 'demo', 'active');
    const demoB = await insertTenant('H1 Demo B', `h1-demo-b-${suffix}`, 'demo', 'active');
    const trial = await insertTenant('H1 Trial', `h1-trial-${suffix}`, 'trial', 'active');
    const readOnlyTrial = await insertTenant('H1 Read Only Trial', `h1-trial-ro-${suffix}`, 'trial', 'read_only');
    const [defaultLiveResult] = await db.execute("INSERT INTO tbl_tenants (tenantName,tenantSlug,status,timezone,locale,defaultCurrency,billingEmail,isActive) VALUES (?,?,1,'Europe/London','en-GB','GBP',?,1)", ['H1 Default Live', `h1-default-${suffix}`, `h1-default-${suffix}@example.test`]);
    const [defaultRows] = await db.execute('SELECT tenantType,lifecycleStatus FROM tbl_tenants WHERE id=?', [defaultLiveResult.insertId]);
    assert.deepStrictEqual(defaultRows[0], {tenantType: 'live', lifecycleStatus: 'active'});

    const canWrite = async tenantId => {
      const [rows] = await db.execute("SELECT CAST(isActive=1 AND lifecycleStatus='active' AND (accessEndDate IS NULL OR accessEndDate>CURRENT_TIMESTAMP) AS UNSIGNED) canWrite FROM tbl_tenants WHERE id=?", [tenantId]);
      return Number(rows[0].canWrite);
    };
    assert.equal(await canWrite(live), 1);
    assert.equal(await canWrite(trial), 1);
    assert.equal(await canWrite(readOnlyTrial), 0);

    const [packs] = await db.execute("SELECT id FROM tbl_scenario_packs WHERE scenarioCode='TEST_DEMO_V1' AND versionNumber=1");
    assert.equal(packs.length, 1);
    const packId = packs[0].id;
    const [steps] = await db.execute('SELECT id,sequenceNumber FROM tbl_scenario_steps WHERE scenarioPackId=? ORDER BY sequenceNumber', [packId]);
    assert.equal(steps.length, 3);
    const createInstance = async tenantId => (await db.execute("INSERT INTO tbl_scenario_instances (tenantId,scenarioPackId,currentStepId,status,guideMode) VALUES (?,?,?,'ready','guided')", [tenantId, packId, steps[0].id]))[0].insertId;
    const instanceA = await createInstance(demoA);
    const instanceB = await createInstance(demoB);

    async function advance(tenantId, instanceId, expectedStepId) {
      const [context] = await db.execute("SELECT i.id,i.currentStepId,s.sequenceNumber FROM tbl_scenario_instances i INNER JOIN tbl_tenants t ON t.id=i.tenantId AND t.tenantType='demo' AND t.lifecycleStatus='active' INNER JOIN tbl_scenario_steps s ON s.id=i.currentStepId WHERE i.id=? AND i.tenantId=? AND i.currentStepId=?", [instanceId, tenantId, expectedStepId]);
      if (!context.length) return false;
      const row = context[0];
      await db.execute("INSERT INTO tbl_scenario_executions (tenantId,scenarioInstanceId,scenarioStepId,idempotencyKey,executionStatus,executedDate) VALUES (?,?,?,?,'completed',CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)", [tenantId, instanceId, expectedStepId, `${instanceId}:${expectedStepId}`]);
      const next = steps.find(step => step.sequenceNumber === row.sequenceNumber + 1);
      await db.execute("UPDATE tbl_scenario_instances SET currentStepId=?,status=?,completedDate=? WHERE id=? AND tenantId=? AND currentStepId=?", [next ? next.id : expectedStepId, next ? 'active' : 'completed', next ? null : new Date(), instanceId, tenantId, expectedStepId]);
      return true;
    }

    assert.equal(await advance(demoA, instanceA, steps[0].id), true);
    assert.equal(await advance(demoB, instanceB, steps[0].id), true);
    assert.equal(await advance(demoB, instanceB, steps[1].id), true);
    assert.equal(await advance(demoB, instanceB, steps[2].id), true);
    const [states] = await db.execute('SELECT tenantId,currentStepId,status FROM tbl_scenario_instances WHERE id IN (?,?) ORDER BY tenantId', [instanceA, instanceB]);
    const stateA = states.find(row => row.tenantId === demoA);
    const stateB = states.find(row => row.tenantId === demoB);
    assert.equal(stateA.currentStepId, steps[1].id);
    assert.equal(stateA.status, 'active');
    assert.equal(stateB.status, 'completed');

    assert.equal(await advance(demoA, instanceB, steps[2].id), false, 'Demo A must not modify Demo B by supplied instance ID.');
    const [crossRead] = await db.execute('SELECT id FROM tbl_scenario_instances WHERE id=? AND tenantId=?', [instanceB, demoA]);
    assert.equal(crossRead.length, 0, 'Demo A must not read Demo B by supplied instance ID.');

    await db.execute("INSERT INTO tbl_scenario_executions (tenantId,scenarioInstanceId,scenarioStepId,idempotencyKey,executionStatus) VALUES (?,?,?,?,'completed') ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)", [demoA, instanceA, steps[0].id, `${instanceA}:${steps[0].id}`]);
    const [executionCount] = await db.execute('SELECT COUNT(*) count FROM tbl_scenario_executions WHERE tenantId=? AND idempotencyKey=?', [demoA, `${instanceA}:${steps[0].id}`]);
    assert.equal(Number(executionCount[0].count), 1, 'Repeated execution must remain a single row.');

    await db.execute("UPDATE tbl_tenants SET lifecycleStatus='expired' WHERE id=?", [demoA]);
    assert.equal(await canWrite(demoA), 0);
    assert.equal(await canWrite(demoB), 1);
    assert.equal(await canWrite(live), 1);
    assert.equal(await advance(demoA, instanceA, steps[1].id), false);
    await db.execute("UPDATE tbl_tenants SET lifecycleStatus='active',accessEndDate=DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 7 DAY) WHERE id=?", [demoA]);
    assert.equal(await canWrite(demoA), 1);

    const adminApi = fs.readFileSync(path.join(root, 'app', 'api', 'platform', 'tenantLifecycle', 'update.json'), 'utf8');
    assert(adminApi.includes('isPlatformAdmin=1'), 'Lifecycle update must require a platform administrator.');
    const workflowCreate = fs.readFileSync(path.join(root, 'app', 'api', 'workflows', 'create.json'), 'utf8');
    assert(workflowCreate.includes('TENANT_READ_ONLY'), 'Representative workflow write must enforce lifecycle status.');
    console.log('H1 lifecycle/scenario integration tests passed.');
  } finally {
    await db.rollback();
    await db.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
