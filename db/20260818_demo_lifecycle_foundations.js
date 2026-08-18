// Phase H1: tenant lifecycle and tenant-isolated scenario-state foundations.
exports.up = async function (knex) {
  const addTenantColumn = async (name, define) => {
    if (!await knex.schema.hasColumn('tbl_tenants', name)) {
      await knex.schema.alterTable('tbl_tenants', table => define(table));
    }
  };

  await addTenantColumn('tenantType', table => table.string('tenantType', 20).notNullable().defaultTo('live'));
  await addTenantColumn('lifecycleStatus', table => table.string('lifecycleStatus', 20).notNullable().defaultTo('active'));
  await addTenantColumn('accessStartDate', table => table.dateTime('accessStartDate').nullable());
  await addTenantColumn('accessEndDate', table => table.dateTime('accessEndDate').nullable());
  await addTenantColumn('retentionEndDate', table => table.dateTime('retentionEndDate').nullable());
  await addTenantColumn('cleanupEligibleDate', table => table.dateTime('cleanupEligibleDate').nullable());
  await addTenantColumn('convertedToLiveDate', table => table.dateTime('convertedToLiveDate').nullable());
  await addTenantColumn('lifecycleModifiedDate', table => table.dateTime('lifecycleModifiedDate').notNullable().defaultTo(knex.fn.now()));

  await knex.raw("UPDATE tbl_tenants SET tenantType='live' WHERE tenantType IS NULL OR tenantType NOT IN ('live','demo','trial')");
  await knex.raw("UPDATE tbl_tenants SET lifecycleStatus='active' WHERE lifecycleStatus IS NULL OR lifecycleStatus NOT IN ('active','expired','read_only','suspended','closed')");
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tenants_lifecycle ON tbl_tenants (tenantType,lifecycleStatus,accessEndDate)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tenants_cleanup ON tbl_tenants (lifecycleStatus,cleanupEligibleDate)');

  if (!await knex.schema.hasTable('tbl_tenant_lifecycle_history')) {
    await knex.schema.createTable('tbl_tenant_lifecycle_history', table => {
      table.bigIncrements('id');
      table.integer('tenantId').unsigned().notNullable();
      table.string('previousTenantType', 20).nullable();
      table.string('newTenantType', 20).notNullable();
      table.string('previousLifecycleStatus', 20).nullable();
      table.string('newLifecycleStatus', 20).notNullable();
      table.dateTime('previousAccessEndDate').nullable();
      table.dateTime('newAccessEndDate').nullable();
      table.string('actionCode', 80).notNullable();
      table.string('reason', 500).nullable();
      table.integer('changedByUserId').unsigned().nullable();
      table.dateTime('changedDate').notNullable().defaultTo(knex.fn.now());
      table.foreign('tenantId', 'fk_tenant_lifecycle_history_tenant').references('tbl_tenants.id').onDelete('CASCADE');
      table.foreign('changedByUserId', 'fk_tenant_lifecycle_history_user').references('tbl_users.id').onDelete('SET NULL');
      table.index(['tenantId', 'changedDate'], 'idx_tenant_lifecycle_history_tenant');
    });
  }

  if (!await knex.schema.hasTable('tbl_scenario_packs')) {
    await knex.schema.createTable('tbl_scenario_packs', table => {
      table.increments('id');
      table.string('scenarioCode', 80).notNullable();
      table.integer('versionNumber').unsigned().notNullable().defaultTo(1);
      table.string('scenarioName', 180).notNullable();
      table.text('description').nullable();
      table.string('status', 20).notNullable().defaultTo('draft');
      table.integer('createdByUserId').unsigned().nullable();
      table.integer('modifiedByUserId').unsigned().nullable();
      table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
      table.dateTime('modifiedDate').notNullable().defaultTo(knex.fn.now());
      table.unique(['scenarioCode', 'versionNumber'], 'uq_scenario_packs_code_version');
      table.index(['status', 'scenarioCode'], 'idx_scenario_packs_status');
      table.foreign('createdByUserId', 'fk_scenario_packs_created_user').references('tbl_users.id').onDelete('SET NULL');
      table.foreign('modifiedByUserId', 'fk_scenario_packs_modified_user').references('tbl_users.id').onDelete('SET NULL');
    });
  }

  if (!await knex.schema.hasTable('tbl_scenario_steps')) {
    await knex.schema.createTable('tbl_scenario_steps', table => {
      table.increments('id');
      table.integer('scenarioPackId').unsigned().notNullable();
      table.string('stepKey', 80).notNullable();
      table.integer('sequenceNumber').unsigned().notNullable();
      table.string('triggerType', 40).notNullable().defaultTo('manual_continue');
      table.string('actionType', 40).notNullable().defaultTo('narrative_show');
      table.text('configurationJson', 'longtext').nullable();
      table.integer('prerequisiteStepId').unsigned().nullable();
      table.integer('simulatedOffsetSeconds').unsigned().nullable();
      table.boolean('isActive').notNullable().defaultTo(true);
      table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
      table.dateTime('modifiedDate').notNullable().defaultTo(knex.fn.now());
      table.foreign('scenarioPackId', 'fk_scenario_steps_pack').references('tbl_scenario_packs.id').onDelete('CASCADE');
      table.foreign('prerequisiteStepId', 'fk_scenario_steps_prerequisite').references('tbl_scenario_steps.id').onDelete('SET NULL');
      table.unique(['scenarioPackId', 'stepKey'], 'uq_scenario_steps_pack_key');
      table.unique(['scenarioPackId', 'sequenceNumber'], 'uq_scenario_steps_pack_sequence');
    });
  }

  if (!await knex.schema.hasTable('tbl_scenario_instances')) {
    await knex.schema.createTable('tbl_scenario_instances', table => {
      table.bigIncrements('id');
      table.integer('tenantId').unsigned().notNullable();
      table.integer('scenarioPackId').unsigned().notNullable();
      table.integer('currentStepId').unsigned().nullable();
      table.string('status', 20).notNullable().defaultTo('ready');
      table.string('guideMode', 20).notNullable().defaultTo('guided');
      table.dateTime('simulatedDateTime').nullable();
      table.dateTime('startedDate').nullable();
      table.dateTime('pausedDate').nullable();
      table.dateTime('resumedDate').nullable();
      table.dateTime('completedDate').nullable();
      table.dateTime('nextActionDate').nullable();
      table.integer('revisionNumber').unsigned().notNullable().defaultTo(1);
      table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
      table.dateTime('modifiedDate').notNullable().defaultTo(knex.fn.now());
      table.foreign('tenantId', 'fk_scenario_instances_tenant').references('tbl_tenants.id').onDelete('CASCADE');
      table.foreign('scenarioPackId', 'fk_scenario_instances_pack').references('tbl_scenario_packs.id').onDelete('RESTRICT');
      table.foreign('currentStepId', 'fk_scenario_instances_current_step').references('tbl_scenario_steps.id').onDelete('SET NULL');
      table.unique(['tenantId', 'id'], 'uq_scenario_instances_tenant_id');
      table.index(['tenantId', 'status'], 'idx_scenario_instances_tenant_status');
    });
  }

  if (!await knex.schema.hasTable('tbl_scenario_executions')) {
    await knex.schema.createTable('tbl_scenario_executions', table => {
      table.bigIncrements('id');
      table.integer('tenantId').unsigned().notNullable();
      table.bigInteger('scenarioInstanceId').unsigned().notNullable();
      table.integer('scenarioStepId').unsigned().notNullable();
      table.string('idempotencyKey', 180).notNullable();
      table.string('executionStatus', 20).notNullable().defaultTo('claimed');
      table.integer('attemptCount').unsigned().notNullable().defaultTo(1);
      table.dateTime('claimedDate').notNullable().defaultTo(knex.fn.now());
      table.dateTime('executedDate').nullable();
      table.text('resultJson', 'longtext').nullable();
      table.string('errorCode', 100).nullable();
      table.text('errorMessage').nullable();
      table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
      table.dateTime('modifiedDate').notNullable().defaultTo(knex.fn.now());
      table.foreign('tenantId', 'fk_scenario_executions_tenant').references('tbl_tenants.id').onDelete('CASCADE');
      table.foreign('scenarioInstanceId', 'fk_scenario_executions_instance').references('tbl_scenario_instances.id').onDelete('CASCADE');
      table.foreign('scenarioStepId', 'fk_scenario_executions_step').references('tbl_scenario_steps.id').onDelete('RESTRICT');
      table.unique(['tenantId', 'idempotencyKey'], 'uq_scenario_executions_tenant_key');
      table.index(['tenantId', 'scenarioInstanceId', 'executionStatus'], 'idx_scenario_executions_instance');
    });
  }

  await knex.raw("INSERT INTO tbl_scenario_packs (scenarioCode,versionNumber,scenarioName,description,status) VALUES ('TEST_DEMO_V1',1,'Metipath demo test scenario','Neutral narrative-only technical scenario for Phase H1.','published') ON DUPLICATE KEY UPDATE scenarioName=VALUES(scenarioName),description=VALUES(description),status='published',modifiedDate=CURRENT_TIMESTAMP");
  await knex.raw("INSERT INTO tbl_scenario_steps (scenarioPackId,stepKey,sequenceNumber,triggerType,actionType,configurationJson,isActive) SELECT p.id,s.stepKey,s.sequenceNumber,'manual_continue','narrative_show',s.configurationJson,1 FROM tbl_scenario_packs p JOIN (SELECT 'welcome' stepKey,1 sequenceNumber,JSON_OBJECT('narrative','Welcome to the Metipath demo test scenario.') configurationJson UNION ALL SELECT 'second',2,JSON_OBJECT('narrative','This is the second demo step.') UNION ALL SELECT 'complete',3,JSON_OBJECT('narrative','Scenario complete.')) s WHERE p.scenarioCode='TEST_DEMO_V1' AND p.versionNumber=1 ON DUPLICATE KEY UPDATE configurationJson=VALUES(configurationJson),isActive=1,modifiedDate=CURRENT_TIMESTAMP");
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tbl_scenario_executions');
  await knex.schema.dropTableIfExists('tbl_scenario_instances');
  await knex.schema.dropTableIfExists('tbl_scenario_steps');
  await knex.schema.dropTableIfExists('tbl_scenario_packs');
  await knex.schema.dropTableIfExists('tbl_tenant_lifecycle_history');
  for (const index of ['idx_tenants_cleanup','idx_tenants_lifecycle']) await knex.raw(`DROP INDEX IF EXISTS ${index} ON tbl_tenants`);
  await knex.schema.alterTable('tbl_tenants', table => table.dropColumns('tenantType','lifecycleStatus','accessStartDate','accessEndDate','retentionEndDate','cleanupEligibleDate','convertedToLiveDate','lifecycleModifiedDate'));
};
