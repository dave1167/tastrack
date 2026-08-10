exports.up = async function (knex) {
  const hasTeam = await knex.schema.hasColumn('tbl_template_tasks', 'defaultTeamId');
  const hasUser = await knex.schema.hasColumn('tbl_template_tasks', 'defaultUserId');
  if (!hasTeam || !hasUser) {
    await knex.schema.alterTable('tbl_template_tasks', table => {
      if (!hasTeam) table.integer('defaultTeamId').unsigned().nullable().index();
      if (!hasUser) table.integer('defaultUserId').unsigned().nullable().index();
    });
  }
  await knex.raw("UPDATE tbl_template_tasks SET defaultTeamId=defaultOwnerId WHERE defaultOwnerType='team' AND defaultOwnerId IS NOT NULL AND defaultTeamId IS NULL");
  await knex.raw("UPDATE tbl_template_tasks SET defaultUserId=defaultOwnerId WHERE defaultOwnerType='specific_user' AND defaultOwnerId IS NOT NULL AND defaultUserId IS NULL");
};

exports.down = async function () {
  // Allocation defaults are retained to avoid losing tenant configuration.
};
