exports.up = async function (knex) {
  await knex.schema.createTable('tbl_email_oauth_states', table => {
    table.increments('id'); table.integer('tenantId').unsigned().notNullable(); table.integer('userId').unsigned().notNullable(); table.integer('emailConnectionId').unsigned().nullable();
    table.string('stateHash',64).notNullable(); table.string('sessionHash',64).notNullable(); table.text('codeVerifierCiphertext').notNullable(); table.string('codeVerifierIv',24).notNullable(); table.string('codeVerifierAuthTag',24).notNullable(); table.integer('keyVersion').unsigned().notNullable();
    table.dateTime('expiresDate').notNullable(); table.dateTime('usedDate').nullable(); table.dateTime('createdDate').notNullable().defaultTo(knex.fn.now());
    table.foreign('tenantId','fk_email_oauth_states_tenant').references('tbl_tenants.id').onDelete('CASCADE'); table.foreign('userId','fk_email_oauth_states_user').references('tbl_users.id').onDelete('CASCADE'); table.foreign('emailConnectionId','fk_email_oauth_states_connection').references('tbl_email_connections.id').onDelete('SET NULL');
    table.unique(['stateHash'],'uq_email_oauth_states_hash'); table.index(['tenantId','userId','expiresDate'],'idx_email_oauth_states_context');
  });
  const [moduleId] = await knex('tbl_modules').insert({moduleCode:'EMAIL_INTEGRATION',moduleName:'Email Integration',moduleDescription:'Connect an existing shared workflow mailbox to Metipath communications.',moduleCategory:'COMMUNICATIONS',isCore:0,isBillable:1,isActive:1,currencyCode:'GBP',displayOrder:220}).onConflict('moduleCode').merge(['moduleName','moduleDescription','moduleCategory','isBillable','isActive','displayOrder']);
  const permissions=[['email.integration.view','View workflow mailbox connection'],['email.integration.manage','Connect, reconnect, disconnect and configure a workflow mailbox']];
  for(const [code,name] of permissions) await knex('tbl_permissions').insert({permissionCode:code,permissionKey:code,permissionName:name,permissionScope:'tenant',permissionGroup:'communications',isSensitive:1,isAssignable:1,isActive:1,createdDate:knex.fn.now(),modifiedDate:knex.fn.now()}).onConflict('permissionCode').merge(['permissionName','isActive']);
  const roleIds=await knex('tbl_roles').select('id').whereIn('roleKey',['owner','admin']).orWhereIn('roleCode',['OWNER','ADMIN']);
  const permissionIds=await knex('tbl_permissions').select('id').whereIn('permissionCode',permissions.map(p=>p[0]));
  for(const role of roleIds) for(const permission of permissionIds) await knex('tbl_role_permissions').insert({roleId:role.id,permissionId:permission.id,createdDate:knex.fn.now()}).onConflict(['roleId','permissionId']).ignore();
};
exports.down = async function (knex) { await knex.schema.dropTableIfExists('tbl_email_oauth_states'); };
