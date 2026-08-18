// Phase H4: encrypted, tenant-scoped simulated incoming communications.
exports.up=async function(knex){
  for(const tableName of ['tbl_communication_threads','tbl_communications']){
    if(!await knex.schema.hasColumn(tableName,'scenarioInstanceId'))await knex.schema.alterTable(tableName,table=>table.bigInteger('scenarioInstanceId').unsigned().nullable());
    if(!await knex.schema.hasColumn(tableName,'scenarioExecutionId'))await knex.schema.alterTable(tableName,table=>table.bigInteger('scenarioExecutionId').unsigned().nullable());
    await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${tableName}_scenario ON ${tableName} (tenantId,scenarioInstanceId,scenarioExecutionId)`);
  }
  await knex.raw("INSERT INTO tbl_scenario_packs (scenarioCode,versionNumber,scenarioName,description,status) VALUES ('TEST_EXTERNAL_COMMUNICATION_V1',1,'External communication technical scenario','Neutral H4 proof using genuine encrypted communications, unmatched allocation and thread auto-linking.','published') ON DUPLICATE KEY UPDATE scenarioName=VALUES(scenarioName),description=VALUES(description),status='published',modifiedDate=CURRENT_TIMESTAMP");
  await knex.raw(`INSERT INTO tbl_scenario_steps (scenarioPackId,stepKey,sequenceNumber,triggerType,actionType,configurationJson,isActive)
    SELECT p.id,s.stepKey,s.sequenceNumber,s.triggerType,s.actionType,s.configurationJson,1 FROM tbl_scenario_packs p JOIN (
      SELECT 'external_message_pending' stepKey,1 sequenceNumber,'manual_continue' triggerType,'narrative_show' actionType,JSON_OBJECT('narrative','An external message will arrive shortly.','buttonLabel','Continue') configurationJson
      UNION ALL SELECT 'incoming_email',2,'manual_continue','communication_receive',JSON_OBJECT('narrative','A new email has arrived from an external contact. Metipath has suggested a record, but the message is not allocated yet.','messageKey','external_email_1','threadKey','external_thread_1','subject','Updated information','body','I have updated the information we discussed. Please attach this message to the appropriate record.','buttonLabel','Receive email')
      UNION ALL SELECT 'allocate_email',3,'user_action','wait_communication_linked',JSON_OBJECT('narrative','Open Communications and allocate the new email to the suggested record, then return here.','messageKey','external_email_1','buttonLabel','I have allocated the email')
      UNION ALL SELECT 'allocation_confirmed',4,'manual_continue','narrative_show',JSON_OBJECT('narrative','The communication is now linked through the normal Metipath allocation workflow.','buttonLabel','Continue')
      UNION ALL SELECT 'thread_reply',5,'manual_continue','communication_receive',JSON_OBJECT('narrative','Jordan Reed has sent a second message in the same conversation.','messageKey','external_email_2','threadKey','external_thread_1','subject','Re: Updated information','body','Thank you. This is a further update for the same record.','buttonLabel','Receive follow-up')
      UNION ALL SELECT 'thread_link_proof',6,'manual_continue','narrative_show',JSON_OBJECT('narrative','Metipath recognised the existing thread and linked the follow-up to the same record automatically.','buttonLabel','Continue')
      UNION ALL SELECT 'complete',7,'manual_continue','narrative_show',JSON_OBJECT('narrative','The external communication test is complete.','buttonLabel','Complete scenario')
    )s WHERE p.scenarioCode='TEST_EXTERNAL_COMMUNICATION_V1' AND p.versionNumber=1
    ON DUPLICATE KEY UPDATE triggerType=VALUES(triggerType),actionType=VALUES(actionType),configurationJson=VALUES(configurationJson),isActive=1,modifiedDate=CURRENT_TIMESTAMP`);
};

exports.down=async function(knex){
  await knex('tbl_scenario_steps').whereIn('scenarioPackId',knex('tbl_scenario_packs').select('id').where({scenarioCode:'TEST_EXTERNAL_COMMUNICATION_V1'})).del();
  await knex('tbl_scenario_packs').where({scenarioCode:'TEST_EXTERNAL_COMMUNICATION_V1'}).del();
  for(const tableName of ['tbl_communications','tbl_communication_threads'])for(const column of ['scenarioExecutionId','scenarioInstanceId'])if(await knex.schema.hasColumn(tableName,column))await knex.schema.alterTable(tableName,table=>table.dropColumn(column));
};
