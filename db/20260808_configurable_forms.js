// Generic Record/Task form schema. Refresh the db connection in Wappler Database Manager after applying.
exports.up = async function up(k) {
  const create = async (name, builder) => { if (!await k.schema.hasTable(name)) await k.schema.createTable(name, builder); };

  await create('tbl_form_templates', t => {
    t.increments('id'); t.integer('tenantId').unsigned().notNullable();
    t.enu('formType', ['record', 'task']).notNullable(); t.string('formName', 160).notNullable();
    t.text('formDescription'); t.integer('version').unsigned().notNullable().defaultTo(1);
    t.enu('status', ['draft', 'published', 'archived']).notNullable().defaultTo('draft');
    t.boolean('isActive').notNullable().defaultTo(true); t.boolean('isSystemTemplate').notNullable().defaultTo(false);
    t.integer('parentFormTemplateId').unsigned(); t.integer('createdByUserId').unsigned(); t.integer('modifiedByUserId').unsigned();
    t.dateTime('publishedDate'); t.dateTime('createdDate').notNullable().defaultTo(k.fn.now()); t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now());
    t.unique(['tenantId', 'formName', 'version'], 'uq_form_template_version');
    t.index(['tenantId', 'formType', 'status', 'isActive'], 'idx_form_template_lookup');
  });
  await create('tbl_form_sections', t => {
    t.increments('id'); t.integer('tenantId').unsigned().notNullable(); t.integer('formTemplateId').unsigned().notNullable();
    t.string('sectionKey', 100).notNullable(); t.string('sectionName', 160).notNullable(); t.text('sectionDescription');
    t.string('displayLocation', 80).defaultTo('details'); t.integer('displayOrder').notNullable().defaultTo(100);
    t.boolean('isCollapsible').notNullable().defaultTo(false); t.boolean('isDefaultExpanded').notNullable().defaultTo(true); t.boolean('isActive').notNullable().defaultTo(true);
    t.dateTime('createdDate').notNullable().defaultTo(k.fn.now()); t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now());
    t.unique(['tenantId', 'formTemplateId', 'sectionKey'], 'uq_form_section_key'); t.index(['tenantId', 'formTemplateId', 'isActive', 'displayOrder'], 'idx_form_section_order');
  });
  await create('tbl_form_fields', t => {
    t.increments('id'); t.integer('tenantId').unsigned().notNullable(); t.integer('formTemplateId').unsigned().notNullable(); t.integer('formSectionId').unsigned().notNullable();
    t.string('fieldKey', 120).notNullable(); t.string('fieldLabel', 160).notNullable(); t.string('fieldType', 40).notNullable();
    t.text('helpText'); t.string('placeholderText', 255); t.integer('displayOrder').notNullable().defaultTo(100); t.integer('columnWidth').notNullable().defaultTo(6);
    t.boolean('isRequired').notNullable().defaultTo(false); t.boolean('isReadOnly').notNullable().defaultTo(false); t.boolean('isHidden').notNullable().defaultTo(false);
    t.text('defaultValue'); t.json('validationJson'); t.json('settingsJson'); t.boolean('isActive').notNullable().defaultTo(true);
    t.integer('createdByUserId').unsigned(); t.integer('modifiedByUserId').unsigned(); t.dateTime('createdDate').notNullable().defaultTo(k.fn.now()); t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now());
    t.unique(['tenantId', 'formTemplateId', 'fieldKey'], 'uq_form_field_key'); t.index(['tenantId', 'formTemplateId', 'formSectionId', 'isActive', 'displayOrder'], 'idx_form_field_order'); t.index(['tenantId', 'fieldType'], 'idx_form_field_type');
  });
  await create('tbl_form_field_options', t => {
    t.increments('id'); t.integer('tenantId').unsigned().notNullable(); t.integer('formFieldId').unsigned().notNullable(); t.string('optionValue', 120).notNullable(); t.string('optionLabel', 160).notNullable();
    t.integer('displayOrder').notNullable().defaultTo(100); t.boolean('isActive').notNullable().defaultTo(true); t.dateTime('createdDate').notNullable().defaultTo(k.fn.now()); t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now());
    t.unique(['tenantId', 'formFieldId', 'optionValue'], 'uq_form_field_option'); t.index(['tenantId', 'formFieldId', 'isActive', 'displayOrder'], 'idx_form_option_order');
  });
  await create('tbl_form_field_conditions', t => {
    t.increments('id'); t.integer('tenantId').unsigned().notNullable(); t.integer('formFieldId').unsigned().notNullable(); t.integer('controllingFieldId').unsigned().notNullable();
    t.string('operator', 30).notNullable(); t.text('comparisonValue'); t.string('conditionAction', 30).notNullable();
    t.dateTime('createdDate').notNullable().defaultTo(k.fn.now()); t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now()); t.index(['tenantId', 'formFieldId'], 'idx_form_condition_target'); t.index(['tenantId', 'controllingFieldId'], 'idx_form_condition_controller');
  });
  await create('tbl_form_repeatable_columns', t => {
    t.increments('id'); t.integer('tenantId').unsigned().notNullable(); t.integer('formFieldId').unsigned().notNullable(); t.string('columnKey', 120).notNullable(); t.string('columnLabel', 160).notNullable();
    t.string('columnType', 30).notNullable(); t.boolean('isRequired').notNullable().defaultTo(false); t.integer('displayOrder').notNullable().defaultTo(100); t.json('settingsJson'); t.boolean('isActive').notNullable().defaultTo(true);
    t.unique(['tenantId', 'formFieldId', 'columnKey'], 'uq_form_repeatable_column'); t.index(['tenantId', 'formFieldId', 'isActive', 'displayOrder'], 'idx_repeatable_column_order');
  });
  await create('tbl_record_form_values', t => {
    t.bigIncrements('id'); t.integer('tenantId').unsigned().notNullable(); t.integer('workflowId').unsigned().notNullable(); t.integer('formTemplateId').unsigned().notNullable(); t.integer('formTemplateVersion').unsigned().notNullable(); t.integer('formFieldId').unsigned().notNullable();
    t.text('valueText'); t.bigInteger('valueNumber'); t.decimal('valueDecimal', 18, 6); t.date('valueDate'); t.dateTime('valueDateTime'); t.time('valueTime'); t.boolean('valueBoolean'); t.json('valueJson');
    t.integer('createdByUserId').unsigned(); t.integer('modifiedByUserId').unsigned(); t.dateTime('createdDate').notNullable().defaultTo(k.fn.now()); t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now());
    t.unique(['tenantId', 'workflowId', 'formFieldId'], 'uq_record_form_current_value'); t.index(['tenantId', 'workflowId', 'formTemplateId'], 'idx_record_form_values'); t.index(['tenantId', 'formFieldId', 'valueDecimal'], 'idx_record_form_decimal');
  });
  await create('tbl_task_form_responses', t => {
    t.bigIncrements('id'); t.integer('tenantId').unsigned().notNullable(); t.integer('taskId').unsigned().notNullable(); t.integer('formTemplateId').unsigned().notNullable(); t.integer('formTemplateVersion').unsigned().notNullable();
    t.enu('status', ['not_started', 'in_progress', 'complete']).notNullable().defaultTo('not_started'); t.dateTime('startedDate'); t.integer('startedByUserId').unsigned(); t.dateTime('completedDate'); t.integer('completedByUserId').unsigned();
    t.dateTime('createdDate').notNullable().defaultTo(k.fn.now()); t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now()); t.unique(['tenantId', 'taskId'], 'uq_task_form_response'); t.index(['tenantId', 'formTemplateId', 'status'], 'idx_task_form_response_status');
  });
  await create('tbl_task_form_values', t => {
    t.bigIncrements('id'); t.integer('tenantId').unsigned().notNullable(); t.bigInteger('taskFormResponseId').unsigned().notNullable(); t.integer('formFieldId').unsigned().notNullable();
    t.text('valueText'); t.bigInteger('valueNumber'); t.decimal('valueDecimal', 18, 6); t.date('valueDate'); t.dateTime('valueDateTime'); t.time('valueTime'); t.boolean('valueBoolean'); t.json('valueJson');
    t.integer('createdByUserId').unsigned(); t.integer('modifiedByUserId').unsigned(); t.dateTime('createdDate').notNullable().defaultTo(k.fn.now()); t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now());
    t.unique(['tenantId', 'taskFormResponseId', 'formFieldId'], 'uq_task_form_current_value'); t.index(['tenantId', 'taskFormResponseId', 'formFieldId'], 'idx_task_form_values');
  });

  for (const [table, column] of [['tbl_workflow_templates', 'recordFormTemplateId'], ['tbl_template_tasks', 'taskFormTemplateId'], ['tbl_tasks', 'taskFormTemplateId']]) {
    if (await k.schema.hasTable(table) && !await k.schema.hasColumn(table, column)) await k.schema.alterTable(table, t => t.integer(column).unsigned().nullable());
  }
  if (await k.schema.hasTable('tbl_template_tasks') && !await k.schema.hasColumn('tbl_template_tasks', 'formCompletionPolicy')) await k.schema.alterTable('tbl_template_tasks', t => t.string('formCompletionPolicy', 40).notNullable().defaultTo('require_before_completion'));
  if (await k.schema.hasTable('tbl_tasks') && !await k.schema.hasColumn('tbl_tasks', 'formCompletionPolicy')) await k.schema.alterTable('tbl_tasks', t => t.string('formCompletionPolicy', 40).notNullable().defaultTo('require_before_completion'));

  await k.raw("INSERT INTO tbl_permissions(permissionCode,permissionKey,permissionName,permissionDescription,permissionScope,permissionGroup,isSensitive,isAssignable,description,isActive) VALUES ('forms.manage','forms.manage','Manage forms','Create, edit, publish and archive configurable forms.','tenant','configuration',1,1,'Manage tenant Record and Task forms.',1) ON DUPLICATE KEY UPDATE permissionName=VALUES(permissionName),isActive=1");
  await k.raw("INSERT IGNORE INTO tbl_role_permissions(roleId,permissionId) SELECT r.id,p.id FROM tbl_roles r JOIN tbl_permissions p ON p.permissionCode='forms.manage' WHERE r.roleKey IN ('owner','admin')");
};

exports.down = async function down(k) {
  for (const table of ['tbl_task_form_values','tbl_task_form_responses','tbl_record_form_values','tbl_form_repeatable_columns','tbl_form_field_conditions','tbl_form_field_options','tbl_form_fields','tbl_form_sections','tbl_form_templates']) await k.schema.dropTableIfExists(table);
};
