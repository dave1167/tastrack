const BreakError = require('../../../lib/errors/breakError');
const chatCrypto = require('./chatCrypto');

function fail(app, status, errorCode, message) {
  if (app.res && !app.res.headersSent) app.res.status(status).json({success:false,errorCode,message});
  throw new BreakError();
}

const ACTORS = {
  operations_coordinator: {firstName:'Alex',lastName:'Morgan',displayName:'Alex Morgan',jobTitle:'Operations Coordinator',roleKeys:['operations','team_member']},
  technical_coordinator: {firstName:'Sam',lastName:'Taylor',displayName:'Sam Taylor',jobTitle:'Technical Coordinator',roleKeys:['team_member','operations']}
};

async function ensureActor(trx, context, actorKey) {
  const definition = ACTORS[actorKey];
  if (!definition) throw Object.assign(new Error('Unknown scenario actor key.'), {code:'SCENARIO_ACTOR_INVALID'});
  let mapping = await trx('tbl_scenario_actor_mappings').where({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,actorKey}).first();
  if (mapping) return {...mapping,...definition};
  const email = `scenario+${context.tenantId}.${context.instanceId}.${actorKey}@invalid`;
  await trx.raw("INSERT INTO tbl_users (email,fName,lName,displayName,jobTitle,passwordHash,isActive,isPlatformAdmin,verifycode) VALUES (?,?,?,?,?,NULL,1,0,NULL) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),displayName=VALUES(displayName),jobTitle=VALUES(jobTitle),passwordHash=NULL,verifycode=NULL,isPlatformAdmin=0", [email,definition.firstName,definition.lastName,definition.displayName,definition.jobTitle]);
  const user = await trx('tbl_users').where({email}).first('id');
  await trx.raw("INSERT INTO tbl_user_tenants (tenantId,userId,membershipStatus,actorType,isActive,acceptedDate,chatAvailability,chatStatusMessage) VALUES (?,?,'active','simulated',1,CURRENT_TIMESTAMP,'available',?) ON DUPLICATE KEY UPDATE actorType='simulated',membershipStatus='active',isActive=1,chatAvailability='available',chatStatusMessage=VALUES(chatStatusMessage)", [context.tenantId,user.id,definition.jobTitle]);
  const role = await trx('tbl_roles').whereIn('roleKey',definition.roleKeys).where({isActive:1}).orderByRaw(`FIELD(roleKey,${definition.roleKeys.map(()=>'?').join(',')})`,definition.roleKeys).first('id');
  if (role) await trx.raw('INSERT INTO tbl_user_tenant_roles (userId,tenantId,roleId,isPrimary,isActive) VALUES (?,?,?,1,1) ON DUPLICATE KEY UPDATE isActive=1,isPrimary=1', [user.id,context.tenantId,role.id]);
  await trx('tbl_scenario_actor_mappings').insert({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,actorKey,userId:user.id,roleLabel:definition.jobTitle});
  mapping = await trx('tbl_scenario_actor_mappings').where({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,actorKey}).first();
  return {...mapping,...definition};
}

async function ensureTask(trx, context, actor) {
  let mapping = await trx('tbl_scenario_resource_mappings').where({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,resourceType:'task',resourceKey:'review_task'}).first();
  if (mapping) {
    const task = await trx('tbl_tasks').where({id:mapping.resourceId,tenantId:context.tenantId}).first();
    if (task) return task;
  }
  const workflow = await trx('tbl_workflows as w').leftJoin('tbl_workflow_stages as ws',function(){this.on('ws.workflowId','w.id').andOn('ws.tenantId','w.tenantId')}).where({'w.tenantId':context.tenantId}).orderBy('w.id').orderBy('ws.sortOrder').first('w.id as workflowId','ws.id as workflowStageId');
  if (!workflow) throw Object.assign(new Error('The technical scenario needs an existing workflow.'), {code:'SCENARIO_WORKFLOW_REQUIRED'});
  const [taskId] = await trx('tbl_tasks').insert({tenantId:context.tenantId,workflowId:workflow.workflowId,workflowStageId:workflow.workflowStageId||null,taskName:'Review internal activity update',description:'Neutral technical task created by the Metipath internal-activity scenario.',status:'not_started',priority:'normal',isRequired:0,requiredSnapshot:0,assignedToUserId:actor.userId,createdByUserId:actor.userId});
  await trx('tbl_scenario_resource_mappings').insert({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,resourceType:'task',resourceKey:'review_task',resourceId:taskId});
  return trx('tbl_tasks').where({id:taskId,tenantId:context.tenantId}).first();
}

async function completeTask(trx, context, execution, config) {
  const actor = await ensureActor(trx,context,config.actorKey);
  const task = await ensureTask(trx,context,actor);
  const before = {status:task.status,assignedToUserId:task.assignedToUserId,completedDate:task.completedDate};
  if (task.status !== 'complete') await trx('tbl_tasks').where({id:task.id,tenantId:context.tenantId}).update({assignedToUserId:actor.userId,status:'complete',startedDate:trx.raw('COALESCE(startedDate,CURRENT_TIMESTAMP)'),completedDate:trx.fn.now(),completedByUserId:actor.userId,modifiedDate:trx.fn.now(),rowVersion:trx.raw('rowVersion+1')});
  if (task.workflowStageId) await trx.raw("UPDATE tbl_workflow_stages ws SET ws.status=(SELECT CASE WHEN COUNT(t.id)=0 THEN 'not_started' WHEN SUM(t.status NOT IN ('complete','skipped','cancelled'))=0 THEN 'complete' WHEN SUM(t.status IN ('in_progress','complete'))>0 THEN 'in_progress' ELSE 'not_started' END FROM tbl_tasks t WHERE t.workflowStageId=ws.id AND t.tenantId=ws.tenantId),ws.startedDate=COALESCE(ws.startedDate,CURRENT_TIMESTAMP),ws.completedDate=CASE WHEN (SELECT COUNT(*) FROM tbl_tasks t WHERE t.workflowStageId=ws.id AND t.tenantId=ws.tenantId AND t.status NOT IN ('complete','skipped','cancelled'))=0 THEN COALESCE(ws.completedDate,CURRENT_TIMESTAMP) ELSE NULL END,ws.modifiedDate=CURRENT_TIMESTAMP WHERE ws.id=? AND ws.tenantId=?",[task.workflowStageId,context.tenantId]);
  await trx.raw("UPDATE tbl_workflows w SET w.status=(SELECT CASE WHEN COUNT(t.id)=0 THEN 'not_started' WHEN SUM(t.status NOT IN ('complete','skipped','cancelled'))=0 THEN 'complete' WHEN SUM(t.status IN ('in_progress','complete'))>0 THEN 'in_progress' ELSE 'not_started' END FROM tbl_tasks t WHERE t.workflowId=w.id AND t.tenantId=w.tenantId),w.completedDate=CASE WHEN (SELECT COUNT(*) FROM tbl_tasks t WHERE t.workflowId=w.id AND t.tenantId=w.tenantId AND t.status NOT IN ('complete','skipped','cancelled'))=0 THEN COALESCE(w.completedDate,CURRENT_TIMESTAMP) ELSE NULL END,w.modifiedDate=CURRENT_TIMESTAMP WHERE w.id=? AND w.tenantId=?",[task.workflowId,context.tenantId]);
  await trx('tbl_activity_log').insert({tenantId:context.tenantId,userId:actor.userId,workflowId:task.workflowId,taskId:task.id,entityType:'task',entityId:task.id,actionType:'task.status_changed',summary:`${actor.displayName} completed ${task.taskName}`,beforeJson:JSON.stringify(before),afterJson:JSON.stringify({status:'complete',source:'scenario',scenarioInstanceId:context.instanceId,scenarioExecutionId:execution.id}),scenarioInstanceId:context.instanceId,scenarioExecutionId:execution.id});
  return {taskId:task.id,actorUserId:actor.userId,before};
}

async function sendDirectMessage(trx, context, execution, config, recipientUserId) {
  const actor = await ensureActor(trx,context,config.actorKey);
  const recipient = await trx('tbl_user_tenants as ut').join('tbl_users as u','u.id','ut.userId').where({'ut.tenantId':context.tenantId,'ut.userId':recipientUserId,'ut.actorType':'human','ut.isActive':1,'ut.membershipStatus':'active','u.isActive':1}).first('u.id','u.displayName');
  if (!recipient || recipient.id === actor.userId) throw Object.assign(new Error('Scenario message recipient is invalid.'), {code:'SCENARIO_RECIPIENT_INVALID'});
  const directKey = `${Math.min(actor.userId,recipient.id)}-${Math.max(actor.userId,recipient.id)}`;
  await trx.raw("INSERT INTO tbl_chat_conversations (tenantId,conversationType,directKey,conversationName,createdByUserId,modifiedByUserId) VALUES (?,'direct',?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),isActive=1,modifiedByUserId=VALUES(modifiedByUserId)", [context.tenantId,directKey,recipient.displayName||'Direct message',actor.userId,actor.userId]);
  const conversation = await trx('tbl_chat_conversations').where({tenantId:context.tenantId,conversationType:'direct',directKey}).first('id');
  for (const userId of [actor.userId,recipient.id]) await trx.raw('INSERT INTO tbl_chat_participants (tenantId,conversationId,userId,isActive) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE isActive=1', [context.tenantId,conversation.id,userId]);
  const encrypted = chatCrypto._encrypt(config.message,context.tenantId,conversation.id);
  const [messageId] = await trx('tbl_chat_messages').insert({tenantId:context.tenantId,conversationId:conversation.id,senderUserId:actor.userId,messageText:null,messageCiphertext:encrypted.ciphertext,messageIv:encrypted.iv,messageAuthTag:encrypted.authTag,messageKeyVersion:encrypted.keyVersion,scenarioInstanceId:context.instanceId,scenarioExecutionId:execution.id});
  await trx('tbl_chat_participants').where({tenantId:context.tenantId,conversationId:conversation.id,userId:actor.userId}).update({lastReadMessageId:messageId,lastReadDate:trx.fn.now()});
  if (config.notify !== false) await trx('tbl_notifications').insert({tenantId:context.tenantId,userId:recipient.id,relatedUserId:actor.userId,notificationType:'chat_message',title:`New message from ${actor.displayName}`,message:'You have a new private message.',status:'unread',channel:'in_app',scenarioInstanceId:context.instanceId,scenarioExecutionId:execution.id});
  await trx('tbl_activity_log').insert({tenantId:context.tenantId,userId:actor.userId,targetUserId:recipient.id,entityType:'chat_message',entityId:messageId,actionType:'chat.message_sent',summary:`${actor.displayName} sent an internal message`,afterJson:JSON.stringify({conversationId:conversation.id,source:'scenario',scenarioInstanceId:context.instanceId,scenarioExecutionId:execution.id}),scenarioInstanceId:context.instanceId,scenarioExecutionId:execution.id});
  await trx('tbl_scenario_resource_mappings').insert({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,resourceType:'chat_message',resourceKey:'colleague_message',resourceId:messageId}).onConflict(['tenantId','scenarioInstanceId','resourceType','resourceKey']).merge({resourceId:messageId});
  return {messageId,conversationId:conversation.id,actorUserId:actor.userId,recipientUserId:recipient.id};
}

async function requireMessageRead(trx, context, recipientUserId) {
  const mapping = await trx('tbl_scenario_resource_mappings').where({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,resourceType:'chat_message',resourceKey:'colleague_message'}).first();
  if (!mapping) throw Object.assign(new Error('The scenario message has not been created.'), {code:'SCENARIO_MESSAGE_REQUIRED'});
  const read = await trx('tbl_chat_messages as m').join('tbl_chat_participants as p',function(){this.on('p.conversationId','m.conversationId').andOn('p.tenantId','m.tenantId')}).where({'m.id':mapping.resourceId,'m.tenantId':context.tenantId,'p.userId':recipientUserId,'p.isActive':1}).whereRaw('p.lastReadMessageId>=m.id').first('m.id');
  if (!read) throw Object.assign(new Error('Open and read the colleague message before continuing.'), {code:'SCENARIO_USER_ACTION_REQUIRED',status:409});
  return {messageId:read.id,readByUserId:recipientUserId};
}

async function advance(app, tenantId, instanceId, stepId, userId) {
  const db = app.getDbConnection('db');
  try {
    return await db.transaction(async trx => {
      const base = await trx('tbl_scenario_instances as i').join('tbl_tenants as t','t.id','i.tenantId').where({'i.id':instanceId,'i.tenantId':tenantId,'t.tenantType':'demo','t.lifecycleStatus':'active','t.isActive':1}).where(q=>q.whereNull('t.accessStartDate').orWhere('t.accessStartDate','<=',trx.fn.now())).where(q=>q.whereNull('t.accessEndDate').orWhere('t.accessEndDate','>',trx.fn.now())).first('i.id');
      const human = await trx('tbl_user_tenants').where({tenantId,userId,actorType:'human',isActive:1,membershipStatus:'active'}).first('id');
      if (!base || !human) throw Object.assign(new Error('Active demo scenario access is unavailable.'), {code:'ACTIVE_DEMO_REQUIRED',status:403});
      const idempotencyKey = `${instanceId}:${stepId}`;
      const completed = await trx('tbl_scenario_executions').where({tenantId,scenarioInstanceId:instanceId,scenarioStepId:stepId,idempotencyKey:idempotencyKey,executionStatus:'completed'}).first('resultJson');
      if (completed) return {success:true,...JSON.parse(completed.resultJson||'{}'),idempotent:true};
      const context = await trx('tbl_scenario_instances as i').join('tbl_tenants as t','t.id','i.tenantId').join('tbl_scenario_steps as s',function(){this.on('s.id','i.currentStepId').andOn('s.scenarioPackId','i.scenarioPackId')}).where({'i.id':instanceId,'i.tenantId':tenantId,'i.currentStepId':stepId,'t.tenantType':'demo','t.lifecycleStatus':'active','t.isActive':1}).whereIn('i.status',['ready','active']).where(q=>q.whereNull('t.accessStartDate').orWhere('t.accessStartDate','<=',trx.fn.now())).where(q=>q.whereNull('t.accessEndDate').orWhere('t.accessEndDate','>',trx.fn.now())).forUpdate().first('i.id as instanceId','i.tenantId','i.scenarioPackId','s.id as stepId','s.sequenceNumber','s.actionType','s.configurationJson');
      if (!context) throw Object.assign(new Error('Active demo scenario step not found.'), {code:'ACTIVE_DEMO_REQUIRED',status:403});
      context.instanceId=Number(context.instanceId);
      const config = typeof context.configurationJson === 'string' ? JSON.parse(context.configurationJson||'{}') : (context.configurationJson||{});
      const key = idempotencyKey;
      let execution = await trx('tbl_scenario_executions').where({tenantId:context.tenantId,idempotencyKey:key}).first();
      if (execution && execution.executionStatus==='completed') return JSON.parse(execution.resultJson||'{}');
      if (!execution) {
        const [id] = await trx('tbl_scenario_executions').insert({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,scenarioStepId:context.stepId,idempotencyKey:key,executionStatus:'claimed',attemptCount:1,claimedDate:trx.fn.now()});
        execution={id};
      } else await trx('tbl_scenario_executions').where({id:execution.id,tenantId:context.tenantId}).update({attemptCount:trx.raw('attemptCount+1'),claimedDate:trx.fn.now(),errorCode:null,errorMessage:null});
      let result={action:context.actionType};
      if (context.actionType==='task_complete') result={...result,...await completeTask(trx,context,execution,config)};
      else if (context.actionType==='chat_message_send') result={...result,...await sendDirectMessage(trx,context,execution,config,userId)};
      else if (context.actionType==='wait_chat_read') result={...result,...await requireMessageRead(trx,context,userId)};
      else if (context.actionType!=='narrative_show') throw Object.assign(new Error('Unsupported scenario action.'), {code:'SCENARIO_ACTION_UNSUPPORTED'});
      const next = await trx('tbl_scenario_steps').where({scenarioPackId:context.scenarioPackId,isActive:1,sequenceNumber:context.sequenceNumber+1}).first('id');
      await trx('tbl_scenario_instances').where({id:context.instanceId,tenantId:context.tenantId,currentStepId:context.stepId}).update({currentStepId:next?next.id:context.stepId,status:next?'active':'completed',startedDate:trx.raw('COALESCE(startedDate,CURRENT_TIMESTAMP)'),completedDate:next?null:trx.fn.now(),modifiedDate:trx.fn.now(),revisionNumber:trx.raw('revisionNumber+1')});
      await trx('tbl_scenario_executions').where({id:execution.id,tenantId:context.tenantId}).update({executionStatus:'completed',executedDate:trx.fn.now(),resultJson:JSON.stringify(result),modifiedDate:trx.fn.now()});
      return {success:true,...result};
    });
  } catch (error) {
    if (error instanceof BreakError) throw error;
    fail(app,error.status||422,error.code||'SCENARIO_ACTION_FAILED',error.message||'Scenario action failed.');
  }
}

module.exports = {
  advance: async function(options) {
    const tenantId=this.parseRequired(options.tenantId,'number','scenarioActivity.advance: tenantId is required.');
    const instanceId=this.parseRequired(options.instanceId,'number','scenarioActivity.advance: instanceId is required.');
    const stepId=this.parseRequired(options.stepId,'number','scenarioActivity.advance: stepId is required.');
    const userId=this.parseRequired(options.userId,'number','scenarioActivity.advance: userId is required.');
    return advance(this,tenantId,instanceId,stepId,userId);
  },
  _test:{ensureActor,ensureTask,completeTask,sendDirectMessage,requireMessageRead,advance}
};
