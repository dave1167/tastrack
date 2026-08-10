// Task Template -> Stage/Phase -> Template Task Question -> instantiated Task -> typed Answer.
// Reuses the existing workflow template/task architecture; no parallel task-template system.
exports.up=async function up(k){
  const add=async(table,column,callback)=>{if(await k.schema.hasTable(table)&&!await k.schema.hasColumn(table,column))await k.schema.alterTable(table,callback)};
  await add('tbl_template_tasks','answerType',t=>t.string('answerType',30).notNullable().defaultTo('yes_no'));
  await add('tbl_template_tasks','showStartDate',t=>t.boolean('showStartDate').notNullable().defaultTo(false));
  await add('tbl_template_tasks','showDeadline',t=>t.boolean('showDeadline').notNullable().defaultTo(true));
  await add('tbl_template_tasks','showFinishDate',t=>t.boolean('showFinishDate').notNullable().defaultTo(false));
  await add('tbl_template_tasks','allowNotes',t=>t.boolean('allowNotes').notNullable().defaultTo(false));
  await add('tbl_template_tasks','attachmentRequirement',t=>t.string('attachmentRequirement',20).notNullable().defaultTo('none'));
  await add('tbl_template_tasks','defaultAnswerValue',t=>t.text('defaultAnswerValue'));
  await add('tbl_template_tasks','createdByUserId',t=>t.integer('createdByUserId').unsigned());
  await add('tbl_template_tasks','modifiedByUserId',t=>t.integer('modifiedByUserId').unsigned());

  if(!await k.schema.hasTable('tbl_template_task_options'))await k.schema.createTable('tbl_template_task_options',t=>{
    t.increments('id');t.integer('tenantId').unsigned().notNullable();t.integer('templateTaskId').unsigned().notNullable();
    t.string('optionValue',120).notNullable();t.string('optionLabel',180).notNullable();t.integer('displayOrder').notNullable().defaultTo(10);t.boolean('isActive').notNullable().defaultTo(true);
    t.integer('createdByUserId').unsigned();t.integer('modifiedByUserId').unsigned();t.dateTime('createdDate').notNullable().defaultTo(k.fn.now());t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now());
    t.unique(['tenantId','templateTaskId','optionValue'],'uq_template_task_option_value');t.index(['tenantId','templateTaskId','isActive','displayOrder'],'idx_template_task_options');
  });

  for(const [column,callback]of[
    ['sourceTemplateId',t=>t.integer('sourceTemplateId').unsigned()],['sourceTemplateStageId',t=>t.integer('sourceTemplateStageId').unsigned()],['phaseNameSnapshot',t=>t.string('phaseNameSnapshot',140)],['questionTextSnapshot',t=>t.string('questionTextSnapshot',180)],['helpTextSnapshot',t=>t.text('helpTextSnapshot')],['answerTypeSnapshot',t=>t.string('answerTypeSnapshot',30)],['requiredSnapshot',t=>t.boolean('requiredSnapshot').notNullable().defaultTo(false)],['showStartDate',t=>t.boolean('showStartDate').notNullable().defaultTo(false)],['showDeadline',t=>t.boolean('showDeadline').notNullable().defaultTo(true)],['showFinishDate',t=>t.boolean('showFinishDate').notNullable().defaultTo(false)],['allowNotes',t=>t.boolean('allowNotes').notNullable().defaultTo(false)],['attachmentRequirement',t=>t.string('attachmentRequirement',20).notNullable().defaultTo('none')],['phaseDisplayOrder',t=>t.integer('phaseDisplayOrder').notNullable().defaultTo(10)],['taskDisplayOrder',t=>t.integer('taskDisplayOrder').notNullable().defaultTo(10)],['answerOptionsSnapshot',t=>t.json('answerOptionsSnapshot')]
  ])await add('tbl_tasks',column,t=>callback(t));

  if(!await k.schema.hasTable('tbl_task_answers'))await k.schema.createTable('tbl_task_answers',t=>{
    t.bigIncrements('id');t.integer('tenantId').unsigned().notNullable();t.integer('taskId').unsigned().notNullable();t.integer('sourceTemplateTaskId').unsigned();
    t.boolean('answerBoolean');t.string('answerStatus',30);t.text('answerText');t.integer('answerOptionId').unsigned();t.string('answerOptionValue',120);t.json('answerJson');t.text('notes');
    t.integer('answeredByUserId').unsigned();t.dateTime('answeredDate');t.integer('modifiedByUserId').unsigned();t.dateTime('createdDate').notNullable().defaultTo(k.fn.now());t.dateTime('modifiedDate').notNullable().defaultTo(k.fn.now());
    t.unique(['tenantId','taskId'],'uq_task_current_answer');t.index(['tenantId','sourceTemplateTaskId'],'idx_task_answer_source');
  });

  // Existing definitions become simple yes/no questions unless they already carried a supported response type.
  await k.raw("UPDATE tbl_template_tasks SET answerType=CASE responseType WHEN 'yes_no' THEN 'yes_no' WHEN 'text' THEN 'text_short' WHEN 'long_text' THEN 'text_long' ELSE 'yes_no' END WHERE answerType IS NULL OR answerType='' ");
  await k.raw("UPDATE tbl_template_tasks SET defaultAnswerValue='not_started' WHERE answerType='task_status' AND (defaultAnswerValue IS NULL OR defaultAnswerValue='')");
  await k.raw("UPDATE tbl_tasks SET sourceTemplateId=(SELECT tt.templateId FROM tbl_template_tasks tt WHERE tt.id=tbl_tasks.sourceTemplateTaskId AND tt.tenantId=tbl_tasks.tenantId),sourceTemplateStageId=(SELECT tt.templateStageId FROM tbl_template_tasks tt WHERE tt.id=tbl_tasks.sourceTemplateTaskId AND tt.tenantId=tbl_tasks.tenantId),questionTextSnapshot=COALESCE(questionTextSnapshot,taskName),helpTextSnapshot=COALESCE(helpTextSnapshot,description),answerTypeSnapshot=COALESCE(answerTypeSnapshot,CASE responseType WHEN 'yes_no' THEN 'yes_no' WHEN 'text' THEN 'text_short' WHEN 'long_text' THEN 'text_long' ELSE 'yes_no' END),requiredSnapshot=isRequired WHERE sourceTemplateTaskId IS NOT NULL");

  for(const [key,singular,plural]of[
    ['task_status_not_started','Not Started','Not Started'],['task_status_on_hold','On Hold','On Hold'],['task_status_complete','Complete','Complete'],['task_start_date','Start Date','Start Dates'],['task_due_date','Due Date','Due Dates'],['task_finish_date','Finish Date','Finish Dates'],['task_notes','Notes','Notes'],['task_attachment','Attachment','Attachments'],['task_evidence','Evidence','Evidence'],['task_required','Required','Required'],['task_assigned_to','Assigned To','Assigned To'],['task_template','Task Template','Task Templates']
  ])await k.raw("INSERT INTO tbl_tenant_terminology(tenantId,termKey,singularLabel,pluralLabel) SELECT id,?,?,? FROM tbl_tenants ON DUPLICATE KEY UPDATE termKey=termKey",[key,singular,plural]);
};

exports.down=async function down(k){
  await k.schema.dropTableIfExists('tbl_task_answers');await k.schema.dropTableIfExists('tbl_template_task_options');
};
