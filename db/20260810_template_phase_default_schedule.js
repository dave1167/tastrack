exports.up = async function (knex) {
  const hasType = await knex.schema.hasColumn('tbl_template_stages', 'defaultDueOffsetType');
  const hasDays = await knex.schema.hasColumn('tbl_template_stages', 'defaultDueOffsetDays');
  const hasRelation = await knex.schema.hasColumn('tbl_template_stages', 'defaultDueRelation');
  if (!hasType || !hasDays || !hasRelation) {
    await knex.schema.alterTable('tbl_template_stages', table => {
      if (!hasType) table.string('defaultDueOffsetType', 40).nullable();
      if (!hasDays) table.integer('defaultDueOffsetDays').unsigned().nullable();
      if (!hasRelation) table.string('defaultDueRelation', 10).nullable();
    });
  }
};

exports.down = async function () {
  // Scheduling defaults are retained to avoid losing tenant configuration.
};
