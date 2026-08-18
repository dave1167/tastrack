const assert=require('assert');
const fs=require('fs');
const path=require('path');
const knexLib=require('knex');

const root=path.resolve(__dirname,'..');
process.env.CHAT_ENCRYPTION_KEY_V1=process.env.CHAT_ENCRYPTION_KEY_V1||Buffer.alloc(32,19).toString('base64');
process.env.CHAT_ENCRYPTION_KEY_VERSION='1';
const activity=require('../extensions/server_connect/modules/scenarioActivity')._test;

async function main(){
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'.wappler','targets','Development','app','modules','connections','db.json'),'utf8')).options.connection;
 assert(['localhost','127.0.0.1','::1'].includes(cfg.host));
 const knex=knexLib({client:'mysql2',connection:cfg}),trx=await knex.transaction();
 try{
  const suffix=Date.now();
  const pack=await trx('tbl_scenario_packs').where({scenarioCode:'TEST_INTERNAL_ACTIVITY_V1',versionNumber:1,status:'published'}).first('id');
  assert(pack,'H3 technical pack is required');
  const steps=await trx('tbl_scenario_steps').where({scenarioPackId:pack.id,isActive:1}).orderBy('sequenceNumber');
  assert.deepEqual(steps.map(x=>x.actionType),['narrative_show','task_complete','chat_message_send','wait_chat_read','narrative_show']);
  async function demo(label){
   const [tenantId]=await trx('tbl_tenants').insert({tenantName:`H3 ${label}`,tenantSlug:`h3-${label.toLowerCase()}-${suffix}`,status:1,timezone:'Europe/London',locale:'en-GB',defaultCurrency:'GBP',billingEmail:`${label}-${suffix}@example.test`,isActive:1,tenantType:'demo',lifecycleStatus:'active'});
   const [userId]=await trx('tbl_users').insert({email:`h3-human-${label}-${suffix}@example.test`,fName:'Demo',lName:'Prospect',displayName:`Demo Prospect ${label}`,passwordHash:'not-used-by-test',isActive:1,isPlatformAdmin:0});
   await trx('tbl_user_tenants').insert({tenantId,userId,membershipStatus:'active',actorType:'human',isActive:1,acceptedDate:trx.fn.now()});
   const role=await trx('tbl_roles').where({roleKey:'owner',isActive:1}).first('id');
   await trx('tbl_user_tenant_roles').insert({tenantId,userId,roleId:role.id,isPrimary:1,isActive:1});
   const [statusId]=await trx('tbl_event_statuses').insert({tenantId,statusName:'Open',systemCategory:'active'});
   const [workflowId]=await trx('tbl_workflows').insert({tenantId,eventStatusId:statusId,workflowName:`H3 neutral workflow ${label}`});
   const [stageId]=await trx('tbl_workflow_stages').insert({tenantId,workflowId,stageName:'Internal review'});
   const [instanceId]=await trx('tbl_scenario_instances').insert({tenantId,scenarioPackId:pack.id,currentStepId:steps[0].id,status:'ready',guideMode:'guided'});
   return{tenantId,userId,workflowId,stageId,instanceId};
  }
  const a=await demo('A'),b=await demo('B');
  function app(){const state={status:200,body:null};return{state,req:{},res:{headersSent:false,status(code){state.status=code;return this},json(body){state.body=body;this.headersSent=true;return this}},getDbConnection(){return trx}}}
  async function run(d,step){return activity.advance(app(),d.tenantId,d.instanceId,step.id,d.userId)}
  for(const d of [a,b]){await run(d,steps[0]);await run(d,steps[1]);await run(d,steps[2]);}
  const actors=await trx('tbl_scenario_actor_mappings as m').join('tbl_users as u','u.id','m.userId').join('tbl_user_tenants as ut',function(){this.on('ut.userId','m.userId').andOn('ut.tenantId','m.tenantId')}).whereIn('m.tenantId',[a.tenantId,b.tenantId]).select('m.tenantId','m.actorKey','m.userId','u.displayName','u.passwordHash','u.verifycode','ut.actorType');
  assert.equal(actors.length,4);assert(actors.every(x=>x.actorType==='simulated'&&x.passwordHash===null&&x.verifycode===null));
  assert.equal(new Set(actors.map(x=>x.displayName)).size,2);assert.equal(new Set(actors.map(x=>x.userId)).size,4,'same names must map to different tenant-specific IDs');
  const messages=await trx('tbl_chat_messages').whereIn('tenantId',[a.tenantId,b.tenantId]);
  assert.equal(messages.length,2);assert(messages.every(x=>!x.messageText&&x.messageCiphertext&&x.scenarioInstanceId&&x.scenarioExecutionId));
  const notifications=await trx('tbl_notifications').whereIn('tenantId',[a.tenantId,b.tenantId]).where({notificationType:'chat_message'});
  assert.equal(notifications.length,2);assert(notifications.every(x=>x.status==='unread'));
  const tasks=await trx('tbl_tasks').whereIn('tenantId',[a.tenantId,b.tenantId]).where({taskName:'Review internal activity update'});
  assert.equal(tasks.length,2);assert(tasks.every(x=>x.status==='complete'&&x.completedByUserId));
  const audits=await trx('tbl_activity_log').whereIn('tenantId',[a.tenantId,b.tenantId]).whereNotNull('scenarioExecutionId');
  assert.equal(audits.length,4);assert(audits.every(x=>x.userId!==a.userId&&x.userId!==b.userId));
  const retry=await run(a,steps[2]);assert.equal(retry.idempotent,true);
  assert.equal(Number((await trx('tbl_chat_messages').where({tenantId:a.tenantId}).count({count:'id'}).first()).count),1);
  const crossApp=app();await assert.rejects(()=>activity.advance(crossApp,a.tenantId,b.instanceId,steps[3].id,a.userId));assert.equal(crossApp.state.status,403);
  for(const [type,status] of [['live','active'],['trial','active'],['demo','expired'],['demo','suspended']]){
   await trx('tbl_tenants').where({id:a.tenantId}).update({tenantType:type,lifecycleStatus:status});const blocked=app();await assert.rejects(()=>activity.advance(blocked,a.tenantId,a.instanceId,steps[3].id,a.userId));assert.equal(blocked.state.status,403);
  }
  await trx('tbl_tenants').where({id:a.tenantId}).update({tenantType:'demo',lifecycleStatus:'active'});
  const beforeRead=app();await assert.rejects(()=>activity.advance(beforeRead,a.tenantId,a.instanceId,steps[3].id,a.userId));assert.equal(beforeRead.state.status,409);
  const message=messages.find(x=>x.tenantId===a.tenantId);await trx('tbl_chat_participants').where({tenantId:a.tenantId,conversationId:message.conversationId,userId:a.userId}).update({lastReadMessageId:message.id,lastReadDate:trx.fn.now()});
  await run(a,steps[3]);await run(a,steps[4]);
  assert.equal((await trx('tbl_scenario_instances').where({id:a.instanceId,tenantId:a.tenantId}).first()).status,'completed');
  const login=fs.readFileSync(path.join(root,'app/api/login/login.json'),'utf8'),select=fs.readFileSync(path.join(root,'app/api/login/select_tenant.json'),'utf8'),options=fs.readFileSync(path.join(root,'app/api/login/tenant_options.json'),'utf8');
  assert(login.includes("actorType='human'")&&select.includes("actorType='human'")&&options.includes("actorType='human'"));
  console.log('H3 simulated actor, messaging, task, lifecycle and isolation tests passed.');
 }finally{await trx.rollback();await knex.destroy()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
