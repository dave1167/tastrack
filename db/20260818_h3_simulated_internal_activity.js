// Phase H3: tenant-scoped simulated actors and traceable internal scenario activity.
exports.up = async function (knex) {
  if (!await knex.schema.hasColumn('tbl_user_tenants', 'actorType')) {
    await knex.schema.alterTable('tbl_user_tenants', table => table.string('actorType', 20).notNullable().defaultTo('human'));
    await knex.raw('CREATE INDEX idx_user_tenants_actor ON tbl_user_tenants (tenantId,actorType,isActive)');
  }

  if (!await knex.schema.hasTable('tbl_scenario_actor_mappings')) {
    await knex.schema.createTable('tbl_scenario_actor_mappings', table => {
      table.bigIncrements('id');
      table.integer('tenantId').unsigned().notNullable();
      table.bigInteger('scenarioInstanceId').unsigned().notNullable();
      table.string('actorKey', 80).notNullable();
      table.integer('userId').unsigned().notNullable();
      table.string('roleLabel', 120).nullable();
      table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
      table.unique(['tenantId','scenarioInstanceId','actorKey'], 'uq_scenario_actor_key');
      table.unique(['tenantId','scenarioInstanceId','userId'], 'uq_scenario_actor_user');
      table.foreign('tenantId').references('tbl_tenants.id').onDelete('CASCADE');
      table.foreign('scenarioInstanceId').references('tbl_scenario_instances.id').onDelete('CASCADE');
      table.foreign('userId').references('tbl_users.id').onDelete('RESTRICT');
    });
  }

  if (!await knex.schema.hasTable('tbl_scenario_resource_mappings')) {
    await knex.schema.createTable('tbl_scenario_resource_mappings', table => {
      table.bigIncrements('id');
      table.integer('tenantId').unsigned().notNullable();
      table.bigInteger('scenarioInstanceId').unsigned().notNullable();
      table.string('resourceType', 40).notNullable();
      table.string('resourceKey', 80).notNullable();
      table.bigInteger('resourceId').unsigned().notNullable();
      table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
      table.unique(['tenantId','scenarioInstanceId','resourceType','resourceKey'], 'uq_scenario_resource_key');
      table.foreign('tenantId').references('tbl_tenants.id').onDelete('CASCADE');
      table.foreign('scenarioInstanceId').references('tbl_scenario_instances.id').onDelete('CASCADE');
    });
  }

  for (const tableName of ['tbl_chat_messages','tbl_notifications','tbl_activity_log']) {
    if (!await knex.schema.hasColumn(tableName, 'scenarioInstanceId')) await knex.schema.alterTable(tableName, table => table.bigInteger('scenarioInstanceId').unsigned().nullable());
    if (!await knex.schema.hasColumn(tableName, 'scenarioExecutionId')) await knex.schema.alterTable(tableName, table => table.bigInteger('scenarioExecutionId').unsigned().nullable());
  }
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_scenario_execution ON tbl_chat_messages (tenantId,scenarioExecutionId)');
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_scenario_execution ON tbl_notifications (tenantId,scenarioExecutionId)');
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_scenario_execution ON tbl_activity_log (tenantId,scenarioExecutionId)');

  await knex.raw("INSERT INTO tbl_scenario_packs (scenarioCode,versionNumber,scenarioName,description,status) VALUES ('TEST_INTERNAL_ACTIVITY_V1',1,'Internal activity technical scenario','Neutral H3 proof using real tasks, chat, notifications and audit history.','published') ON DUPLICATE KEY UPDATE scenarioName=VALUES(scenarioName),description=VALUES(description),status='published',modifiedDate=CURRENT_TIMESTAMP");
  await knex.raw(`INSERT INTO tbl_scenario_steps (scenarioPackId,stepKey,sequenceNumber,triggerType,actionType,configurationJson,isActive)
    SELECT p.id,s.stepKey,s.sequenceNumber,s.triggerType,s.actionType,s.configurationJson,1
    FROM tbl_scenario_packs p JOIN (
      SELECT 'colleague_working' stepKey,1 sequenceNumber,'manual_continue' triggerType,'narrative_show' actionType,JSON_OBJECT('narrative','A colleague is working on one of your tasks.') configurationJson
      UNION ALL SELECT 'task_completed',2,'manual_continue','task_complete',JSON_OBJECT('narrative','Sam Taylor is completing the technical review task.','actorKey','technical_coordinator','taskKey','review_task')
      UNION ALL SELECT 'colleague_message',3,'manual_continue','chat_message_send',JSON_OBJECT('narrative','Alex Morgan has an update for you.','actorKey','operations_coordinator','recipientKey','prospect','taskKey','review_task','message','The task has been completed. Please review the update.','notify',true)
      UNION ALL SELECT 'review_message',4,'user_action','wait_chat_read',JSON_OBJECT('narrative','Open Messages, read Alex Morgan’s update, then continue.','actorKey','operations_coordinator')
      UNION ALL SELECT 'complete',5,'manual_continue','narrative_show',JSON_OBJECT('narrative','The internal activity test is complete.')
    ) s WHERE p.scenarioCode='TEST_INTERNAL_ACTIVITY_V1' AND p.versionNumber=1
    ON DUPLICATE KEY UPDATE triggerType=VALUES(triggerType),actionType=VALUES(actionType),configurationJson=VALUES(configurationJson),isActive=1,modifiedDate=CURRENT_TIMESTAMP`);
};

exports.down = async function (knex) {
  await knex('tbl_scenario_steps').whereIn('scenarioPackId', knex('tbl_scenario_packs').select('id').where({scenarioCode:'TEST_INTERNAL_ACTIVITY_V1'})).del();
  await knex('tbl_scenario_packs').where({scenarioCode:'TEST_INTERNAL_ACTIVITY_V1'}).del();
  for (const tableName of ['tbl_chat_messages','tbl_notifications','tbl_activity_log']) {
    for (const column of ['scenarioExecutionId','scenarioInstanceId']) if (await knex.schema.hasColumn(tableName,column)) await knex.schema.alterTable(tableName, table => table.dropColumn(column));
  }
  await knex.schema.dropTableIfExists('tbl_scenario_resource_mappings');
  await knex.schema.dropTableIfExists('tbl_scenario_actor_mappings');
  if (await knex.schema.hasColumn('tbl_user_tenants','actorType')) await knex.schema.alterTable('tbl_user_tenants', table => table.dropColumn('actorType'));
};
