const FIELD_TYPES = new Set(['single_line_text','long_text','number','currency','percentage','date','datetime','time','yes_no','checkbox','dropdown','radio','multi_select','email','telephone','url','user_lookup','team_lookup','contact_lookup','organisation_lookup','location_lookup','document','attachment','repeatable_table','calculated','read_only_display']);
const SELECT_TYPES = new Set(['dropdown','radio','multi_select']);
const NUMBER_TYPES = new Set(['number','currency','percentage']);
const JSON_TYPES = new Set(['multi_select','repeatable_table','document','attachment']);
const CONDITION_OPERATORS = new Set(['equals','not_equals','contains','greater_than','less_than','is_empty','is_not_empty']);
const CONDITION_ACTIONS = new Set(['show','hide','require','make_optional']);
const TRUTHY = new Set(['1','true','yes','on']);

function fail(app, status, message, errors) {
  if (app.res && !app.res.headersSent) app.res.status(status).json({success:false,message,errors});
  throw Object.assign(new Error(message), {status, errors});
}
const bool = value => TRUTHY.has(String(value).toLowerCase());
const clean = (value, max = 65535) => String(value == null ? '' : value).trim().slice(0, max);
const key = value => clean(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
function json(value, fallback = {}) { if (value == null || value === '') return fallback; if (typeof value === 'object') return value; try { return JSON.parse(value); } catch (_) { return fallback; } }

async function permission(db, tenantId, userId, code) {
  return !!await db('tbl_user_tenants as ut')
    .join('tbl_user_tenant_roles as utr', function joinRole(){ this.on('utr.tenantId','ut.tenantId').andOn('utr.userId','ut.userId').andOnVal('utr.isActive',1); })
    .join('tbl_roles as r','r.id','utr.roleId').join('tbl_role_permissions as rp','rp.roleId','r.id').join('tbl_permissions as p','p.id','rp.permissionId')
    .where({'ut.tenantId':tenantId,'ut.userId':userId,'ut.isActive':1,'ut.membershipStatus':'active','r.isActive':1,'p.permissionCode':code,'p.isActive':1}).first('rp.id');
}
async function context(app, manage = false) {
  const tenantId = Number(app.req.session?.TENANT_ID), userId = Number(app.req.session?.USER_ID), db = app.getDbConnection('db');
  if (!tenantId || !userId) fail(app, 401, 'Authentication required.');
  const member = await db('tbl_user_tenants').where({tenantId,userId,isActive:1,membershipStatus:'active'}).first('id');
  if (!member) fail(app, 403, 'Tenant access denied.');
  if (manage && !await permission(db,tenantId,userId,'forms.manage')) fail(app,403,'You do not have permission to manage forms.');
  return {tenantId,userId,db};
}
async function ownedForm(c, app, id, type) {
  const q = c.db('tbl_form_templates').where({id:Number(id)||0,tenantId:c.tenantId,isActive:1}); if (type) q.where({formType:type});
  const row = await q.first(); if (!row) fail(app,404,'Form not found.'); return row;
}
async function definition(c, form) {
  const sections = await c.db('tbl_form_sections').where({tenantId:c.tenantId,formTemplateId:form.id,isActive:1}).orderBy('displayOrder').orderBy('id');
  const fields = await c.db('tbl_form_fields').where({tenantId:c.tenantId,formTemplateId:form.id,isActive:1}).orderBy('displayOrder').orderBy('id');
  const ids = fields.map(f=>f.id);
  const options = ids.length ? await c.db('tbl_form_field_options').where({tenantId:c.tenantId,isActive:1}).whereIn('formFieldId',ids).orderBy('displayOrder').orderBy('id') : [];
  const conditions = ids.length ? await c.db('tbl_form_field_conditions').where({tenantId:c.tenantId}).whereIn('formFieldId',ids).orderBy('id') : [];
  const repeatableColumns = ids.length ? await c.db('tbl_form_repeatable_columns').where({tenantId:c.tenantId,isActive:1}).whereIn('formFieldId',ids).orderBy('displayOrder').orderBy('id') : [];
  for (const field of fields) {
    field.validation = json(field.validationJson,{}); field.settings = json(field.settingsJson,{});
    field.options = options.filter(o=>o.formFieldId===field.id); field.conditions = conditions.filter(o=>o.formFieldId===field.id); field.repeatableColumns = repeatableColumns.filter(o=>o.formFieldId===field.id);
  }
  for (const section of sections) section.fields=fields.filter(f=>f.formSectionId===section.id);
  return {form,sections,fields,options,conditions,repeatableColumns};
}

async function cloneForm(c, source, options = {}) {
  const asVersion = !!options.asVersion;
  const rootId = source.parentFormTemplateId || source.id;
  const latest = asVersion ? await c.db('tbl_form_templates').where({tenantId:c.tenantId}).where(q=>q.where({id:rootId}).orWhere({parentFormTemplateId:rootId})).max({version:'version'}).first() : null;
  const formName = asVersion ? source.formName : clean(options.formName || `${source.formName} Copy`,160);
  const version = asVersion ? Number(latest?.version || source.version || 1) + 1 : 1;
  let newId;
  await c.db.transaction(async trx=>{
    const ids=await trx('tbl_form_templates').insert({tenantId:c.tenantId,formType:source.formType,formName,formDescription:source.formDescription,version,status:'draft',isActive:1,isSystemTemplate:0,parentFormTemplateId:rootId,createdByUserId:c.userId,modifiedByUserId:c.userId,createdDate:trx.fn.now(),modifiedDate:trx.fn.now()});
    newId=ids[0];
    const sections=await trx('tbl_form_sections').where({tenantId:c.tenantId,formTemplateId:source.id}),sectionMap=new Map(),fieldMap=new Map();
    for(const sourceSection of sections){const row={...sourceSection},old=row.id;delete row.id;row.formTemplateId=newId;row.createdDate=trx.fn.now();row.modifiedDate=trx.fn.now();const inserted=await trx('tbl_form_sections').insert(row);sectionMap.set(old,inserted[0]);}
    const fields=await trx('tbl_form_fields').where({tenantId:c.tenantId,formTemplateId:source.id});
    for(const sourceField of fields){const row={...sourceField},old=row.id;delete row.id;row.formTemplateId=newId;row.formSectionId=sectionMap.get(row.formSectionId);row.createdByUserId=c.userId;row.modifiedByUserId=c.userId;row.createdDate=trx.fn.now();row.modifiedDate=trx.fn.now();const inserted=await trx('tbl_form_fields').insert(row);fieldMap.set(old,inserted[0]);}
    for(const table of ['tbl_form_field_options','tbl_form_repeatable_columns']) for(const sourceRow of await trx(table).where({tenantId:c.tenantId}).whereIn('formFieldId',[...fieldMap.keys()])){const row={...sourceRow};delete row.id;row.formFieldId=fieldMap.get(row.formFieldId);if(row.createdDate)row.createdDate=trx.fn.now();if(row.modifiedDate)row.modifiedDate=trx.fn.now();await trx(table).insert(row);}
    for(const sourceRow of await trx('tbl_form_field_conditions').where({tenantId:c.tenantId}).whereIn('formFieldId',[...fieldMap.keys()])){const row={...sourceRow};delete row.id;row.formFieldId=fieldMap.get(row.formFieldId);row.controllingFieldId=fieldMap.get(row.controllingFieldId);row.createdDate=trx.fn.now();row.modifiedDate=trx.fn.now();await trx('tbl_form_field_conditions').insert(row);}
  });
  return newId;
}
function actualValue(row) {
  if (!row) return null;
  for (const column of ['valueText','valueNumber','valueDecimal','valueDate','valueDateTime','valueTime','valueBoolean','valueJson']) if (row[column] !== null && row[column] !== undefined) return column==='valueJson' ? json(row[column],[]) : row[column];
  return null;
}
function conditionMatches(operator, actual, expected) {
  if (operator==='is_empty') return actual===null||actual===undefined||actual===''||(Array.isArray(actual)&&!actual.length);
  if (operator==='is_not_empty') return !conditionMatches('is_empty',actual,expected);
  if (operator==='equals') return String(actual??'')===String(expected??'');
  if (operator==='not_equals') return String(actual??'')!==String(expected??'');
  if (operator==='contains') return Array.isArray(actual)?actual.map(String).includes(String(expected)):String(actual??'').includes(String(expected??''));
  if (operator==='greater_than') return Number(actual)>Number(expected);
  if (operator==='less_than') return Number(actual)<Number(expected);
  return false;
}
function fieldState(field, values, byId) {
  const rules=field.conditions||[], showRules=rules.filter(rule=>rule.conditionAction==='show');
  let visible=showRules.length===0&&!field.isHidden, required=!!field.isRequired;
  if(showRules.length)visible=showRules.some(rule=>{const control=byId.get(Number(rule.controllingFieldId));return conditionMatches(rule.operator,values[control?.fieldKey],rule.comparisonValue)});
  for (const rule of rules) {
    const control=byId.get(Number(rule.controllingFieldId)), matched=conditionMatches(rule.operator,values[control?.fieldKey],rule.comparisonValue);
    if (rule.conditionAction==='hide'&&matched) visible=false;
    if (rule.conditionAction==='require'&&matched) required=true; if (rule.conditionAction==='make_optional'&&matched) required=false;
  }
  return {visible,required};
}
function validateField(field, raw, state) {
  const errors=[], rules=field.validation||{}, empty=raw===null||raw===undefined||raw===''||(Array.isArray(raw)&&!raw.length);
  if (!state.visible) return errors;
  if (state.visible&&state.required&&empty) errors.push(`${field.fieldLabel} is required.`); if (empty) return errors;
  if (NUMBER_TYPES.has(field.fieldType)) { const n=Number(raw); if (!Number.isFinite(n)) errors.push(`${field.fieldLabel} must be a number.`); else { if (field.fieldType==='percentage'&&(n<0||n>100)) errors.push(`${field.fieldLabel} must be between 0 and 100.`); if (rules.min!=null&&n<Number(rules.min)) errors.push(`${field.fieldLabel} is below the minimum.`); if (rules.max!=null&&n>Number(rules.max)) errors.push(`${field.fieldLabel} exceeds the maximum.`); } }
  const text=String(raw); if (rules.minLength!=null&&text.length<Number(rules.minLength)) errors.push(`${field.fieldLabel} is too short.`); if (rules.maxLength!=null&&text.length>Number(rules.maxLength)) errors.push(`${field.fieldLabel} is too long.`);
  if (field.fieldType==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) errors.push(`${field.fieldLabel} must be a valid email address.`);
  if (field.fieldType==='url') { try { const u=new URL(text); if (!['http:','https:'].includes(u.protocol)) throw new Error(); } catch (_) { errors.push(`${field.fieldLabel} must be a valid web address.`); } }
  if (SELECT_TYPES.has(field.fieldType)) { const allowed=new Set((field.options||[]).map(o=>String(o.optionValue))), chosen=field.fieldType==='multi_select'?(Array.isArray(raw)?raw:json(raw,[])):[raw]; if (chosen.some(v=>!allowed.has(String(v)))) errors.push(`${field.fieldLabel} contains an invalid option.`); }
  if (field.fieldType==='repeatable_table') { const rows=Array.isArray(raw)?raw:json(raw,null); if (!Array.isArray(rows)) errors.push(`${field.fieldLabel} must contain valid rows.`); else for (const [index,row] of rows.entries()) for (const col of field.repeatableColumns||[]) if (col.isRequired&&(row[col.columnKey]===null||row[col.columnKey]===undefined||row[col.columnKey]==='')) errors.push(`${field.fieldLabel}, row ${index+1}: ${col.columnLabel} is required.`); }
  return errors;
}
function typed(field, raw) {
  const out={valueText:null,valueNumber:null,valueDecimal:null,valueDate:null,valueDateTime:null,valueTime:null,valueBoolean:null,valueJson:null};
  if (raw===null||raw===undefined||raw===''||(Array.isArray(raw)&&!raw.length)) return out;
  if (field.fieldType==='number') out.valueNumber=Number.isInteger(Number(raw))?Number(raw):null, out.valueDecimal=Number.isInteger(Number(raw))?null:Number(raw);
  else if (field.fieldType==='currency'||field.fieldType==='percentage') out.valueDecimal=Number(raw);
  else if (field.fieldType==='date') out.valueDate=raw; else if (field.fieldType==='datetime') out.valueDateTime=raw; else if (field.fieldType==='time') out.valueTime=raw;
  else if (field.fieldType==='yes_no'||field.fieldType==='checkbox') out.valueBoolean=bool(raw);
  else if (JSON_TYPES.has(field.fieldType)) out.valueJson=JSON.stringify(Array.isArray(raw)?raw:json(raw,[])); else out.valueText=String(raw);
  return out;
}
function submitted(body, fields) { const values={}; for (const f of fields) { let value=body[`field_${f.id}`]??body[f.fieldKey]??null; if(Array.isArray(value)){if(f.fieldType==='multi_select')value=value.flatMap(item=>Array.isArray(json(item,[]))?json(item,[]):item).filter(item=>item!==''&&item!=='[]'&&item!=null);else value=value.find(item=>item!==''&&item!=='[]'&&item!==null&&item!==undefined)??'';}else if(value==='[]'&&f.fieldType!=='repeatable_table')value=f.fieldType==='multi_select'?[]:''; values[f.fieldKey]=value; } return values; }
async function audit(c, entityType, entityId, action, summary, after) { if (!await c.db.schema.hasTable('tbl_activity_log')) return; await c.db('tbl_activity_log').insert({tenantId:c.tenantId,userId:c.userId,entityType,entityId,actionType:action,summary,afterJson:JSON.stringify(after||{}),createdDate:c.db.fn.now()}); }

module.exports = {
  async list(){ const c=await context(this,true); return {forms:await c.db('tbl_form_templates as f').leftJoin('tbl_workflow_templates as wt',function(){this.on('wt.recordFormTemplateId','f.id').andOn('wt.tenantId','f.tenantId')}).where({'f.tenantId':c.tenantId,'f.formType':'record','f.isActive':1}).groupBy('f.id').select('f.*').countDistinct({usedByWorkflowTemplates:'wt.id'}).orderBy('f.modifiedDate','desc')}; },
  async get(){ const c=await context(this,true), form=await ownedForm(c,this,this.req.query?.id); return definition(c,form); },
  async options(){ const c=await context(this,true); return {recordForms:await c.db('tbl_form_templates').where({tenantId:c.tenantId,formType:'record',status:'published',isActive:1}).orderBy('formName'),taskForms:[]}; },
  async saveTemplate(){
    const c=await context(this,true),b=this.req.body||{},values={formType:'record',formName:clean(b.formName,160),formDescription:clean(b.formDescription)||null,modifiedByUserId:c.userId,modifiedDate:c.db.fn.now()};
    let id=Number(b.id)||0;
    if(!values.formName)fail(this,422,'Form name is required.');
    if(id){
      const form=await ownedForm(c,this,id);
      if(form.status!=='draft')fail(this,409,'Published forms cannot be edited. Create a new version.');
      await c.db('tbl_form_templates').where({id,tenantId:c.tenantId}).update(values);
    }else{
      await c.db.transaction(async trx=>{
        const ids=await trx('tbl_form_templates').insert({tenantId:c.tenantId,version:1,status:'draft',isActive:1,isSystemTemplate:0,createdByUserId:c.userId,createdDate:trx.fn.now(),...values,modifiedDate:trx.fn.now()});
        id=ids[0];
        if(values.formType==='task')await trx('tbl_form_sections').insert({tenantId:c.tenantId,formTemplateId:id,sectionKey:'task_questions',sectionName:'Task Questions',sectionDescription:'Questions to complete for this task.',displayLocation:'task',displayOrder:10,isCollapsible:0,isDefaultExpanded:1,isActive:1,createdDate:trx.fn.now(),modifiedDate:trx.fn.now()});
      });
    }
    await audit(c,'form_template',id,'FORM_SAVED',`Form ${values.formName} saved.`,{formType:values.formType,formName:values.formName,formDescription:values.formDescription,modifiedByUserId:c.userId});
    return{success:true,id};
  },
  async saveSection(){ const c=await context(this,true),b=this.req.body||{},form=await ownedForm(c,this,b.formTemplateId);let id=Number(b.id)||0;if(form.status!=='draft')fail(this,409,'Published forms cannot be edited.');const values={sectionKey:key(b.sectionKey||b.sectionName),sectionName:clean(b.sectionName,160),sectionDescription:clean(b.sectionDescription)||null,displayLocation:key(b.displayLocation||'details'),displayOrder:Number(b.displayOrder)||100,isCollapsible:bool(b.isCollapsible),isDefaultExpanded:b.isDefaultExpanded==null?1:bool(b.isDefaultExpanded),isActive:b.isActive==null?1:bool(b.isActive),modifiedDate:c.db.fn.now()};if(!values.sectionKey||!values.sectionName)fail(this,422,'Section name and stable key are required.');if(id){const row=await c.db('tbl_form_sections').where({id,tenantId:c.tenantId,formTemplateId:form.id}).first();if(!row)fail(this,404,'Section not found.');await c.db('tbl_form_sections').where({id,tenantId:c.tenantId}).update(values);}else{const ids=await c.db('tbl_form_sections').insert({tenantId:c.tenantId,formTemplateId:form.id,createdDate:c.db.fn.now(),...values});id=ids[0];}return{success:true,id}; },
  async saveField(){
    const c=await context(this,true),b=this.req.body||{},form=await ownedForm(c,this,b.formTemplateId);
    let id=Number(b.id)||0;
    if(form.status!=='draft')fail(this,409,'Published forms cannot be edited.');
    let section=await c.db('tbl_form_sections').where({id:Number(b.formSectionId)||0,tenantId:c.tenantId,formTemplateId:form.id,isActive:1}).first();
    if(!section&&form.formType==='task')section=await c.db('tbl_form_sections').where({tenantId:c.tenantId,formTemplateId:form.id,isActive:1}).orderBy('displayOrder').orderBy('id').first();
    if(!section)fail(this,422,'Select a valid question group.');
    const fieldType=FIELD_TYPES.has(b.fieldType)?b.fieldType:null;
    if(!fieldType)fail(this,422,'Unsupported answer type.');
    const validation={min:b.min===''?null:b.min,max:b.max===''?null:b.max,minLength:b.minLength===''?null:b.minLength,maxLength:b.maxLength===''?null:b.maxLength,precision:b.precision===''?null:b.precision};
    const values={formSectionId:section.id,fieldKey:key(b.fieldKey||b.fieldLabel),fieldLabel:clean(b.fieldLabel,160),fieldType,helpText:clean(b.helpText)||null,placeholderText:clean(b.placeholderText,255)||null,displayOrder:Number(b.displayOrder)||100,columnWidth:[3,4,6,8,12].includes(Number(b.columnWidth))?Number(b.columnWidth):6,isRequired:bool(b.isRequired),isReadOnly:bool(b.isReadOnly),isHidden:bool(b.isHidden),defaultValue:clean(b.defaultValue)||null,validationJson:JSON.stringify(validation),settingsJson:JSON.stringify(json(b.settingsJson,{})),isActive:b.isActive==null?1:bool(b.isActive),modifiedByUserId:c.userId,modifiedDate:c.db.fn.now()};
    if(!values.fieldKey||!values.fieldLabel)fail(this,422,'Question and stable key are required.');
    if(id){const row=await c.db('tbl_form_fields').where({id,tenantId:c.tenantId,formTemplateId:form.id}).first();if(!row)fail(this,404,'Question not found.');values.fieldKey=row.fieldKey;await c.db('tbl_form_fields').where({id,tenantId:c.tenantId}).update(values);}else{const ids=await c.db('tbl_form_fields').insert({tenantId:c.tenantId,formTemplateId:form.id,createdByUserId:c.userId,createdDate:c.db.fn.now(),...values});id=ids[0];}
    return{success:true,id};
  },
  async saveOption(){const c=await context(this,true),b=this.req.body||{},field=await c.db('tbl_form_fields as f').join('tbl_form_templates as t','t.id','f.formTemplateId').where({'f.id':Number(b.formFieldId),'f.tenantId':c.tenantId,'t.tenantId':c.tenantId,'t.status':'draft'}).first('f.*');if(!field||!SELECT_TYPES.has(field.fieldType))fail(this,422,'Select a draft selection field.');const id=Number(b.id)||0,values={optionValue:key(b.optionValue||b.optionLabel),optionLabel:clean(b.optionLabel,160),displayOrder:Number(b.displayOrder)||100,isActive:b.isActive==null?1:bool(b.isActive),modifiedDate:c.db.fn.now()};if(!values.optionValue||!values.optionLabel)fail(this,422,'Option value and label are required.');if(id)await c.db('tbl_form_field_options').where({id,tenantId:c.tenantId,formFieldId:field.id}).update(values);else await c.db('tbl_form_field_options').insert({tenantId:c.tenantId,formFieldId:field.id,createdDate:c.db.fn.now(),...values});return{success:true};},
  async saveCondition(){const c=await context(this,true),b=this.req.body||{},target=await c.db('tbl_form_fields as f').join('tbl_form_templates as t','t.id','f.formTemplateId').where({'f.id':Number(b.formFieldId),'f.tenantId':c.tenantId,'t.tenantId':c.tenantId,'t.status':'draft'}).first('f.*'),control=target?await c.db('tbl_form_fields').where({id:Number(b.controllingFieldId),tenantId:c.tenantId,formTemplateId:target.formTemplateId,isActive:1}).first():null;if(!target||!control||target.id===control.id)fail(this,422,'Select fields from the same draft form.');if(!CONDITION_OPERATORS.has(b.operator)||!CONDITION_ACTIONS.has(b.conditionAction))fail(this,422,'Invalid condition.');const values={controllingFieldId:control.id,operator:b.operator,comparisonValue:clean(b.comparisonValue)||null,conditionAction:b.conditionAction,modifiedDate:c.db.fn.now()},id=Number(b.id)||0;if(id)await c.db('tbl_form_field_conditions').where({id,tenantId:c.tenantId,formFieldId:target.id}).update(values);else await c.db('tbl_form_field_conditions').insert({tenantId:c.tenantId,formFieldId:target.id,createdDate:c.db.fn.now(),...values});return{success:true};},
  async saveRepeatableColumn(){const c=await context(this,true),b=this.req.body||{},field=await c.db('tbl_form_fields as f').join('tbl_form_templates as t','t.id','f.formTemplateId').where({'f.id':Number(b.formFieldId),'f.tenantId':c.tenantId,'f.fieldType':'repeatable_table','t.tenantId':c.tenantId,'t.status':'draft'}).first('f.*');const allowed=['text','number','currency','percentage','date','dropdown','yes_no'];if(!field||!allowed.includes(b.columnType))fail(this,422,'Select a valid repeatable-table field.');const values={columnKey:key(b.columnKey||b.columnLabel),columnLabel:clean(b.columnLabel,160),columnType:b.columnType,isRequired:bool(b.isRequired),displayOrder:Number(b.displayOrder)||100,settingsJson:JSON.stringify(json(b.settingsJson,{})),isActive:b.isActive==null?1:bool(b.isActive)},id=Number(b.id)||0;if(!values.columnKey||!values.columnLabel)fail(this,422,'Column key and label are required.');if(id)await c.db('tbl_form_repeatable_columns').where({id,tenantId:c.tenantId,formFieldId:field.id}).update(values);else await c.db('tbl_form_repeatable_columns').insert({tenantId:c.tenantId,formFieldId:field.id,...values});return{success:true};},
  async publish(){const c=await context(this,true),form=await ownedForm(c,this,this.req.body?.id);if(form.status!=='draft')fail(this,409,'Only draft forms can be published.');const count=await c.db('tbl_form_fields').where({tenantId:c.tenantId,formTemplateId:form.id,isActive:1}).count({count:'id'}).first();if(!Number(count.count))fail(this,422,'Add at least one field before publishing.');await c.db('tbl_form_templates').where({id:form.id,tenantId:c.tenantId}).update({status:'published',publishedDate:c.db.fn.now(),modifiedByUserId:c.userId,modifiedDate:c.db.fn.now()});return{success:true};},
  async duplicate(){const c=await context(this,true),source=await ownedForm(c,this,this.req.body?.id),id=await cloneForm(c,source,{formName:this.req.body?.formName});return{success:true,id};},
  async newVersion(){const c=await context(this,true),source=await ownedForm(c,this,this.req.body?.id);if(source.status!=='published')fail(this,409,'Only a published form can start a new version.');const existing=await c.db('tbl_form_templates').where({tenantId:c.tenantId,formName:source.formName,status:'draft',isActive:1}).first('id');if(existing)return{success:true,id:existing.id,reused:true};const id=await cloneForm(c,source,{asVersion:true});return{success:true,id};},
  async archive(){const c=await context(this,true),form=await ownedForm(c,this,this.req.body?.id);await c.db('tbl_form_templates').where({id:form.id,tenantId:c.tenantId}).update({status:'archived',isActive:0,modifiedByUserId:c.userId,modifiedDate:c.db.fn.now()});return{success:true};},
  async renderRecord(){const c=await context(this),workflow=await c.db('tbl_workflows as w').leftJoin('tbl_workflow_templates as wt',function(){this.on('wt.id','w.templateId').andOn('wt.tenantId','w.tenantId')}).where({'w.id':Number(this.req.query?.workflowId||this.req.query?.workflowid),'w.tenantId':c.tenantId}).first('w.*','wt.recordFormTemplateId');if(!workflow)fail(this,404,'Record not found.');let formId=Number(this.req.query?.formTemplateId)||workflow.recordFormTemplateId;if(!formId&&workflow.workflowTypeId)formId=(await c.db('tbl_form_templates').where({tenantId:c.tenantId,formType:'record',status:'published',isActive:1}).whereRaw("JSON_UNQUOTE(JSON_EXTRACT(formDescription,'$.workflowTypeId'))=?",[String(workflow.workflowTypeId)]).first('id'))?.id;if(!formId)return{form:null,sections:[],values:{},canEdit:false};const form=await ownedForm(c,this,formId,'record');if(form.status!=='published')fail(this,404,'Published Record Form not found.');const def=await definition(c,form),rows=await c.db('tbl_record_form_values').where({tenantId:c.tenantId,workflowId:workflow.id,formTemplateId:form.id}),values={};for(const f of def.fields)values[f.fieldKey]=actualValue(rows.find(r=>r.formFieldId===f.id))??f.defaultValue??null;return{...def,values,workflowId:workflow.id,canEdit:await permission(c.db,c.tenantId,c.userId,'commercial.edit')||await permission(c.db,c.tenantId,c.userId,'commercial.manage')};},
  async saveRecord(){const c=await context(this),b=this.req.body||{},workflow=await c.db('tbl_workflows as w').leftJoin('tbl_workflow_templates as wt',function(){this.on('wt.id','w.templateId').andOn('wt.tenantId','w.tenantId')}).where({'w.id':Number(b.workflowId),'w.tenantId':c.tenantId}).first('w.id','wt.recordFormTemplateId');if(!workflow)fail(this,404,'Record not found.');if(!await permission(c.db,c.tenantId,c.userId,'commercial.edit')&&!await permission(c.db,c.tenantId,c.userId,'commercial.manage'))fail(this,403,'You cannot edit this Record Form.');const form=await ownedForm(c,this,workflow.recordFormTemplateId,'record');if(form.status!=='published')fail(this,409,'The Record Form is not published.');const def=await definition(c,form),values=submitted(b,def.fields),byId=new Map(def.fields.map(f=>[f.id,f])),errors=[];for(const f of def.fields)errors.push(...validateField(f,values[f.fieldKey],fieldState(f,values,byId)));if(errors.length)fail(this,422,'Please correct the highlighted form values.',errors);await c.db.transaction(async trx=>{for(const f of def.fields){const raw=values[f.fieldKey],typedValue=typed(f,raw),empty=Object.values(typedValue).every(v=>v===null);if(empty)await trx('tbl_record_form_values').where({tenantId:c.tenantId,workflowId:workflow.id,formFieldId:f.id}).del();else await trx('tbl_record_form_values').insert({tenantId:c.tenantId,workflowId:workflow.id,formTemplateId:form.id,formTemplateVersion:form.version,formFieldId:f.id,createdByUserId:c.userId,modifiedByUserId:c.userId,createdDate:trx.fn.now(),modifiedDate:trx.fn.now(),...typedValue}).onConflict(['tenantId','workflowId','formFieldId']).merge({...typedValue,formTemplateId:form.id,formTemplateVersion:form.version,modifiedByUserId:c.userId,modifiedDate:trx.fn.now()});}});return{success:true,message:'Record Form saved.'};},
  async renderTask(){const c=await context(this),task=await c.db('tbl_tasks').where({id:Number(this.req.query?.taskId||this.req.query?.taskid),tenantId:c.tenantId}).first();if(!task)fail(this,404,'Task not found.');if(!task.taskFormTemplateId)return{form:null,sections:[],values:{},taskId:task.id};const response=await c.db('tbl_task_form_responses').where({tenantId:c.tenantId,taskId:task.id}).first(),form=await ownedForm(c,this,response?.formTemplateId||task.taskFormTemplateId,'task'),def=await definition(c,form),rows=response?await c.db('tbl_task_form_values').where({tenantId:c.tenantId,taskFormResponseId:response.id}):[],values={};for(const f of def.fields)values[f.fieldKey]=actualValue(rows.find(r=>r.formFieldId===f.id))??f.defaultValue??null;return{...def,values,response:response||null,taskId:task.id,completionPolicy:task.formCompletionPolicy};},
  async saveTask(){const c=await context(this),b=this.req.body||{},task=await c.db('tbl_tasks').where({id:Number(b.taskId),tenantId:c.tenantId}).first();if(!task||!task.taskFormTemplateId)fail(this,404,'Task Form not found.');const form=await ownedForm(c,this,task.taskFormTemplateId,'task'),def=await definition(c,form),values=submitted(b,def.fields),submit=bool(b.submit),byId=new Map(def.fields.map(f=>[f.id,f])),errors=[];if(submit)for(const f of def.fields)errors.push(...validateField(f,values[f.fieldKey],fieldState(f,values,byId)));if(errors.length)fail(this,422,'Please complete the required Task Form fields.',errors);await c.db.transaction(async trx=>{let response=await trx('tbl_task_form_responses').where({tenantId:c.tenantId,taskId:task.id}).first();if(!response){const ids=await trx('tbl_task_form_responses').insert({tenantId:c.tenantId,taskId:task.id,formTemplateId:form.id,formTemplateVersion:form.version,status:submit?'complete':'in_progress',startedDate:trx.fn.now(),startedByUserId:c.userId,completedDate:submit?trx.fn.now():null,completedByUserId:submit?c.userId:null,createdDate:trx.fn.now(),modifiedDate:trx.fn.now()});response={id:ids[0]};}else await trx('tbl_task_form_responses').where({id:response.id,tenantId:c.tenantId}).update({status:submit?'complete':'in_progress',completedDate:submit?trx.fn.now():null,completedByUserId:submit?c.userId:null,modifiedDate:trx.fn.now()});for(const f of def.fields){const tv=typed(f,values[f.fieldKey]),empty=Object.values(tv).every(v=>v===null);if(empty)await trx('tbl_task_form_values').where({tenantId:c.tenantId,taskFormResponseId:response.id,formFieldId:f.id}).del();else await trx('tbl_task_form_values').insert({tenantId:c.tenantId,taskFormResponseId:response.id,formFieldId:f.id,createdByUserId:c.userId,modifiedByUserId:c.userId,createdDate:trx.fn.now(),modifiedDate:trx.fn.now(),...tv}).onConflict(['tenantId','taskFormResponseId','formFieldId']).merge({...tv,modifiedByUserId:c.userId,modifiedDate:trx.fn.now()});}if(submit&&task.formCompletionPolicy==='complete_on_submission')await trx('tbl_tasks').where({id:task.id,tenantId:c.tenantId}).update({status:'complete',completedDate:trx.fn.now(),completedByUserId:c.userId,modifiedDate:trx.fn.now()});});return{success:true,complete:submit,message:submit?'Task Form submitted.':'Progress saved.'};},
  _test:{conditionMatches,fieldState,validateField,typed,key}
};
