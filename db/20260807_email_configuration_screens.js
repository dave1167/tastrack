// Wappler/Knex migration for multi-mailbox administration display metadata.
exports.up=async function(knex){
  await knex.schema.alterTable('tbl_email_connections',table=>{
    table.string('providerDisplayName',80).nullable().after('provider');
  });
};
exports.down=async function(knex){
  await knex.schema.alterTable('tbl_email_connections',table=>table.dropColumn('providerDisplayName'));
};
