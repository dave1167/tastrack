// Wappler/Knex schema migration for the generic Metipath communications layer.
// Apply through Wappler Database Manager's migration runner.
exports.up = async function (knex) {
  await knex.schema.createTable('tbl_email_connections', table => {
    table.increments('id');
    table.integer('tenantId').unsigned().notNullable();
    table.integer('connectedByUserId').unsigned().nullable();
    table.string('provider', 40).notNullable();
    table.text('mailboxAddressCiphertext').notNullable();
    table.string('mailboxAddressIv', 24).notNullable();
    table.string('mailboxAddressAuthTag', 24).notNullable();
    table.string('mailboxAddressHash', 64).notNullable();
    table.text('displayNameCiphertext').nullable();
    table.string('displayNameIv', 24).nullable();
    table.string('displayNameAuthTag', 24).nullable();
    table.integer('keyVersion').unsigned().notNullable().defaultTo(1);
    table.string('nylasGrantId', 255).nullable();
    table.string('connectionStatus', 40).notNullable().defaultTo('pending');
    table.string('connectionType', 40).notNullable().defaultTo('hosted_oauth');
    table.string('purpose', 80).nullable();
    table.string('defaultEntityType', 80).nullable();
    table.boolean('isActive').notNullable().defaultTo(true);
    table.dateTime('lastSuccessfulSyncDate').nullable();
    table.dateTime('lastWebhookDate').nullable();
    table.dateTime('lastErrorDate').nullable();
    table.string('lastErrorCode', 100).nullable();
    table.text('lastErrorMessage').nullable();
    table.dateTime('disconnectedDate').nullable();
    table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
    table.dateTime('modifiedDate').notNullable().defaultTo(knex.fn.now());
    table.foreign('tenantId', 'fk_email_connections_tenant').references('tbl_tenants.id').onDelete('CASCADE');
    table.foreign('connectedByUserId', 'fk_email_connections_user').references('tbl_users.id').onDelete('SET NULL');
    table.unique(['tenantId', 'id'], 'uq_email_connections_tenant_id');
    table.index(['tenantId', 'isActive', 'connectionStatus'], 'idx_email_connections_tenant_status');
    table.index(['tenantId', 'mailboxAddressHash'], 'idx_email_connections_mailbox_hash');
    table.index(['nylasGrantId'], 'idx_email_connections_grant');
  });

  await knex.schema.createTable('tbl_communication_threads', table => {
    table.increments('id');
    table.integer('tenantId').unsigned().notNullable();
    table.string('sourceType', 40).notNullable();
    table.integer('sourceConnectionId').unsigned().nullable();
    table.string('externalThreadId', 255).nullable();
    table.string('status', 40).notNullable().defaultTo('observed');
    table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
    table.dateTime('modifiedDate').notNullable().defaultTo(knex.fn.now());
    table.foreign('tenantId', 'fk_comm_threads_tenant').references('tbl_tenants.id').onDelete('CASCADE');
    table.unique(['tenantId', 'id'], 'uq_comm_threads_tenant_id');
    table.unique(['sourceConnectionId', 'externalThreadId'], 'uq_comm_threads_source_external');
    table.index(['tenantId', 'status', 'modifiedDate'], 'idx_comm_threads_tenant_status');
  });

  await knex.schema.createTable('tbl_communications', table => {
    table.increments('id');
    table.integer('tenantId').unsigned().notNullable();
    table.string('communicationType', 40).notNullable();
    table.string('direction', 20).notNullable();
    table.string('sourceType', 40).notNullable();
    table.integer('sourceConnectionId').unsigned().nullable();
    table.integer('threadId').unsigned().nullable();
    table.dateTime('occurredDate').notNullable();
    table.string('matchStatus', 40).notNullable().defaultTo('unmatched');
    table.string('status', 40).notNullable().defaultTo('observed');
    table.integer('matchedByUserId').unsigned().nullable();
    table.dateTime('matchedDate').nullable();
    table.boolean('isForwarded').notNullable().defaultTo(false);
    table.text('subjectCiphertext').nullable();
    table.string('subjectIv', 24).nullable();
    table.string('subjectAuthTag', 24).nullable();
    table.text('bodyTextCiphertext', 'mediumtext').nullable();
    table.string('bodyTextIv', 24).nullable();
    table.string('bodyTextAuthTag', 24).nullable();
    table.text('bodyHtmlCiphertext', 'mediumtext').nullable();
    table.string('bodyHtmlIv', 24).nullable();
    table.string('bodyHtmlAuthTag', 24).nullable();
    table.text('senderCiphertext').nullable();
    table.string('senderIv', 24).nullable();
    table.string('senderAuthTag', 24).nullable();
    table.text('recipientsCiphertext').nullable();
    table.string('recipientsIv', 24).nullable();
    table.string('recipientsAuthTag', 24).nullable();
    table.text('ccCiphertext').nullable();
    table.string('ccIv', 24).nullable();
    table.string('ccAuthTag', 24).nullable();
    table.text('bccCiphertext').nullable();
    table.string('bccIv', 24).nullable();
    table.string('bccAuthTag', 24).nullable();
    table.integer('encryptionVersion').unsigned().notNullable().defaultTo(1);
    table.integer('keyVersion').unsigned().notNullable().defaultTo(1);
    table.integer('createdByUserId').unsigned().nullable();
    table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
    table.dateTime('modifiedDate').notNullable().defaultTo(knex.fn.now());
    table.dateTime('deletedDate').nullable();
    table.foreign('tenantId', 'fk_communications_tenant').references('tbl_tenants.id').onDelete('CASCADE');
    table.foreign('threadId', 'fk_communications_thread').references('tbl_communication_threads.id').onDelete('SET NULL');
    table.foreign('matchedByUserId', 'fk_communications_matched_user').references('tbl_users.id').onDelete('SET NULL');
    table.foreign('createdByUserId', 'fk_communications_created_user').references('tbl_users.id').onDelete('SET NULL');
    table.unique(['tenantId', 'id'], 'uq_communications_tenant_id');
    table.index(['tenantId', 'status', 'occurredDate'], 'idx_communications_tenant_status_date');
    table.index(['tenantId', 'matchStatus', 'occurredDate'], 'idx_communications_tenant_match_date');
    table.index(['tenantId', 'threadId', 'occurredDate'], 'idx_communications_tenant_thread_date');
  });

  await knex.schema.createTable('tbl_communication_email_metadata', table => {
    table.increments('id');
    table.integer('tenantId').unsigned().notNullable();
    table.integer('communicationId').unsigned().notNullable();
    table.integer('emailConnectionId').unsigned().notNullable();
    table.string('nylasMessageId', 255).notNullable();
    table.text('originalSenderCiphertext').nullable();
    table.string('originalSenderIv', 24).nullable();
    table.string('originalSenderAuthTag', 24).nullable();
    table.integer('keyVersion').unsigned().notNullable().defaultTo(1);
    table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
    table.foreign('tenantId', 'fk_comm_email_meta_tenant').references('tbl_tenants.id').onDelete('CASCADE');
    table.foreign('communicationId', 'fk_comm_email_meta_communication').references('tbl_communications.id').onDelete('CASCADE');
    table.foreign('emailConnectionId', 'fk_comm_email_meta_connection').references('tbl_email_connections.id').onDelete('CASCADE');
    table.unique(['communicationId'], 'uq_comm_email_meta_communication');
    table.unique(['emailConnectionId', 'nylasMessageId'], 'uq_comm_email_meta_nylas_message');
    table.index(['tenantId', 'nylasMessageId'], 'idx_comm_email_meta_tenant_message');
  });

  for (const [name, parent, parentColumn] of [
    ['tbl_communication_links', 'tbl_communications', 'communicationId'],
    ['tbl_communication_thread_links', 'tbl_communication_threads', 'threadId']
  ]) {
    await knex.schema.createTable(name, table => {
      table.increments('id');
      table.integer('tenantId').unsigned().notNullable();
      table.integer(parentColumn).unsigned().notNullable();
      table.string('entityType', 80).notNullable();
      table.integer('entityId').unsigned().notNullable();
      table.string('relationshipType', 80).nullable();
      table.integer('createdByUserId').unsigned().nullable();
      table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
      table.foreign('tenantId', `fk_${name}_tenant`).references('tbl_tenants.id').onDelete('CASCADE');
      table.foreign(parentColumn, `fk_${name}_parent`).references(`${parent}.id`).onDelete('CASCADE');
      table.foreign('createdByUserId', `fk_${name}_user`).references('tbl_users.id').onDelete('SET NULL');
      table.unique([parentColumn, 'entityType', 'entityId'], `uq_${name}_entity`);
      table.index(['tenantId', 'entityType', 'entityId'], `idx_${name}_entity`);
    });
  }

  await knex.schema.alterTable('tbl_documents', table => {
    table.text('originalFileNameCiphertext').nullable();
    table.string('originalFileNameIv', 24).nullable();
    table.string('originalFileNameAuthTag', 24).nullable();
    table.string('checksumSha256', 64).nullable();
    table.integer('encryptionVersion').unsigned().nullable();
    table.integer('keyVersion').unsigned().nullable();
    table.dateTime('deletedDate').nullable();
    table.index(['tenantId', 'checksumSha256'], 'idx_documents_tenant_checksum');
  });

  await knex.schema.createTable('tbl_document_links', table => {
    table.increments('id'); table.integer('tenantId').unsigned().notNullable(); table.integer('documentId').unsigned().notNullable();
    table.string('entityType', 80).notNullable(); table.integer('entityId').unsigned().notNullable(); table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
    table.foreign('tenantId', 'fk_document_links_tenant').references('tbl_tenants.id').onDelete('CASCADE');
    table.foreign('documentId', 'fk_document_links_document').references('tbl_documents.id').onDelete('CASCADE');
    table.unique(['documentId', 'entityType', 'entityId'], 'uq_document_links_entity');
    table.index(['tenantId', 'entityType', 'entityId'], 'idx_document_links_entity');
  });

  await knex.schema.createTable('tbl_communication_attachments', table => {
    table.increments('id'); table.integer('tenantId').unsigned().notNullable(); table.integer('communicationId').unsigned().notNullable(); table.integer('documentId').unsigned().notNullable();
    table.string('nylasAttachmentId', 255).nullable(); table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
    table.foreign('tenantId', 'fk_comm_attachments_tenant').references('tbl_tenants.id').onDelete('CASCADE');
    table.foreign('communicationId', 'fk_comm_attachments_communication').references('tbl_communications.id').onDelete('CASCADE');
    table.foreign('documentId', 'fk_comm_attachments_document').references('tbl_documents.id').onDelete('CASCADE');
    table.unique(['communicationId', 'documentId'], 'uq_comm_attachments_document');
    table.unique(['communicationId', 'nylasAttachmentId'], 'uq_comm_attachments_nylas');
    table.index(['tenantId', 'documentId'], 'idx_comm_attachments_tenant_document');
  });
};

exports.down = async function (knex) {
  for (const name of ['tbl_communication_attachments','tbl_document_links','tbl_communication_thread_links','tbl_communication_links','tbl_communication_email_metadata','tbl_communications','tbl_communication_threads','tbl_email_connections']) await knex.schema.dropTableIfExists(name);
  await knex.schema.alterTable('tbl_documents', table => {
    table.dropIndex(['tenantId','checksumSha256'], 'idx_documents_tenant_checksum');
    table.dropColumns('originalFileNameCiphertext','originalFileNameIv','originalFileNameAuthTag','checksumSha256','encryptionVersion','keyVersion','deletedDate');
  });
};
