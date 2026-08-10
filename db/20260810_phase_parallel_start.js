exports.up = async function (knex) {
  const templateHasFlag = await knex.schema.hasColumn('tbl_template_stages', 'allowNextStageEarlyStart');
  const workflowHasFlag = await knex.schema.hasColumn('tbl_workflow_stages', 'allowNextStageEarlyStart');
  if (!templateHasFlag) {
    await knex.schema.alterTable('tbl_template_stages', table => {
      table.boolean('allowNextStageEarlyStart').notNullable().defaultTo(false);
    });
  }
  if (!workflowHasFlag) {
    await knex.schema.alterTable('tbl_workflow_stages', table => {
      table.boolean('allowNextStageEarlyStart').notNullable().defaultTo(false);
    });
  }
};

exports.down = async function () {
  // Retain workflow policy configuration to avoid data loss.
};
