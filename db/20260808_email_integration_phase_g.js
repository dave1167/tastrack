// Wappler/Knex Phase G foundations: mailbox governance, participants, webhook idempotency and suggestions.
exports.up=async function(knex){
  await knex.schema.alterTable('tbl_email_connections',table=>{
    table.string('mailboxType',30).notNullable().defaultTo('shared');
    table.integer('owningTeamId').unsigned().nullable();
    table.string('accessMode',30).notNullable().defaultTo('record');
    table.boolean('isSensitive').notNullable().defaultTo(false);
    table.integer('updatedByUserId').unsigned().nullable();
    table.integer('unmatchedRetentionDays').unsigned().notNullable().defaultTo(30);
    table.foreign('owningTeamId','fk_email_connections_team').references('tbl_teams.id').onDelete('SET NULL');
    table.foreign('updatedByUserId','fk_email_connections_updated_user').references('tbl_users.id').onDelete('SET NULL');
    table.index(['tenantId','owningTeamId','accessMode'],'idx_email_connections_access');
  });
  await knex.schema.createTable('tbl_communication_participants',table=>{
    table.increments('id');table.integer('tenantId').unsigned().notNullable();table.integer('communicationId').unsigned().notNullable();table.string('participantType',20).notNullable();
    table.text('emailCiphertext').notNullable();table.string('emailIv',24).notNullable();table.string('emailAuthTag',24).notNullable();table.string('emailHash',64).notNullable();
    table.text('nameCiphertext').nullable();table.string('nameIv',24).nullable();table.string('nameAuthTag',24).nullable();table.integer('keyVersion').unsigned().notNullable().defaultTo(1);
    table.foreign('tenantId','fk_comm_participants_tenant').references('tbl_tenants.id').onDelete('CASCADE');table.foreign('communicationId','fk_comm_participants_comm').references('tbl_communications.id').onDelete('CASCADE');
    table.index(['tenantId','emailHash'],'idx_comm_participants_email');table.index(['communicationId','participantType'],'idx_comm_participants_type');
  });
  await knex.schema.createTable('tbl_email_webhook_events',table=>{
    table.increments('id');table.string('provider',30).notNullable().defaultTo('nylas');table.string('externalEventId',255).notNullable();table.string('eventType',100).notNullable();table.string('grantIdHash',64).nullable();table.string('status',30).notNullable().defaultTo('received');table.integer('attemptCount').unsigned().notNullable().defaultTo(1);table.text('errorCode').nullable();table.dateTime('processedDate').nullable();table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());table.dateTime('modifiedDate').notNullable().defaultTo(knex.fn.now());table.unique(['provider','externalEventId'],'uq_email_webhook_event');table.index(['status','createdDate'],'idx_email_webhook_status');
  });
  await knex.schema.createTable('tbl_communication_match_suggestions',table=>{
    table.increments('id');table.integer('tenantId').unsigned().notNullable();table.integer('communicationId').unsigned().notNullable();table.string('entityType',80).notNullable();table.integer('entityId').unsigned().notNullable();table.string('reasonCode',80).notNullable();table.decimal('confidence',5,4).notNullable();table.string('status',20).notNullable().defaultTo('suggested');table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
    table.foreign('tenantId','fk_comm_suggestions_tenant').references('tbl_tenants.id').onDelete('CASCADE');table.foreign('communicationId','fk_comm_suggestions_comm').references('tbl_communications.id').onDelete('CASCADE');table.unique(['communicationId','entityType','entityId'],'uq_comm_suggestion_entity');table.index(['tenantId','status','confidence'],'idx_comm_suggestions_queue');
  });
  await knex.schema.createTable('tbl_communication_attachment_metadata',table=>{
    table.increments('id');table.integer('tenantId').unsigned().notNullable();table.integer('communicationId').unsigned().notNullable();table.string('providerAttachmentId',255).nullable();table.text('fileNameCiphertext').nullable();table.string('fileNameIv',24).nullable();table.string('fileNameAuthTag',24).nullable();table.integer('keyVersion').unsigned().notNullable().defaultTo(1);table.string('mimeType',255).nullable();table.bigInteger('fileSize').unsigned().nullable();table.string('storageProvider',40).nullable();table.string('storageKey',500).nullable();table.string('status',30).notNullable().defaultTo('metadata_only');table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());table.dateTime('deletedDate').nullable();
    table.foreign('tenantId','fk_comm_attach_meta_tenant').references('tbl_tenants.id').onDelete('CASCADE');table.foreign('communicationId','fk_comm_attach_meta_comm').references('tbl_communications.id').onDelete('CASCADE');table.unique(['communicationId','providerAttachmentId'],'uq_comm_attach_meta_provider');
  });
  const permissions=[['email.communications.view','View record-linked communications',0],['email.communications.manage','Assign or ignore communications',1],['email.communications.sensitive','View sensitive mailbox communications',1]];
  for(const [code,name,sensitive] of permissions)await knex('tbl_permissions').insert({permissionCode:code,permissionKey:code,permissionName:name,permissionScope:'tenant',permissionGroup:'communications',isSensitive:sensitive,isAssignable:1,isActive:1,createdDate:knex.fn.now(),modifiedDate:knex.fn.now()}).onConflict('permissionCode').merge(['permissionName','isActive']);
  const viewPermission=await knex('tbl_permissions').where({permissionCode:'email.communications.view'}).first('id'),workflowView=await knex('tbl_permissions').where({permissionCode:'workflows.view'}).first('id');
  if(viewPermission&&workflowView){const roles=await knex('tbl_role_permissions').where({permissionId:workflowView.id}).select('roleId');for(const role of roles)await knex('tbl_role_permissions').insert({roleId:role.roleId,permissionId:viewPermission.id,createdDate:knex.fn.now()}).onConflict(['roleId','permissionId']).ignore()}
  const adminRoles=await knex('tbl_roles').whereIn('roleKey',['owner','admin']).orWhereIn('roleCode',['OWNER','ADMIN']).select('id'),adminPermissions=await knex('tbl_permissions').whereIn('permissionCode',['email.communications.manage','email.communications.sensitive']).select('id');
  for(const role of adminRoles)for(const permission of adminPermissions)await knex('tbl_role_permissions').insert({roleId:role.id,permissionId:permission.id,createdDate:knex.fn.now()}).onConflict(['roleId','permissionId']).ignore();
};
exports.down=async function(knex){await knex.schema.dropTableIfExists('tbl_communication_attachment_metadata');await knex.schema.dropTableIfExists('tbl_communication_match_suggestions');await knex.schema.dropTableIfExists('tbl_email_webhook_events');await knex.schema.dropTableIfExists('tbl_communication_participants');await knex.schema.alterTable('tbl_email_connections',table=>{table.dropForeign('owningTeamId','fk_email_connections_team');table.dropForeign('updatedByUserId','fk_email_connections_updated_user');table.dropIndex(['tenantId','owningTeamId','accessMode'],'idx_email_connections_access');table.dropColumns('mailboxType','owningTeamId','accessMode','isSensitive','updatedByUserId','unmatchedRetentionDays')})};
