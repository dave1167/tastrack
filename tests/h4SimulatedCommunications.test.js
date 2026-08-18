const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const knexLib=require('knex');

process.env.METIPATH_ENCRYPTION_MASTER_KEY_V1=crypto.randomBytes(32).toString('base64');
process.env.METIPATH_ENCRYPTION_KEY_VERSION='1';
const activity=require('../extensions/server_connect/modules/scenarioActivity')._test;
const communications=require('../extensions/server_connect/modules/communicationEmail');
const security=require('../extensions/server_connect/modules/metipathSecurity')._test;

async function main(){
 const root=path.resolve(__dirname,'..'),cfg=JSON.parse(fs.readFileSync(path.join(root,'.wappler','targets','Development','app','modules','connections','db.json'),'utf8')).options.connection;
 assert(['localhost','127.0.0.1','::1'].includes(cfg.host),'H4 tests only run against a local database');
 const knex=knexLib({client:'mysql2',connection:cfg}),trx=await knex.transaction();
 try{
  const suffix=Date.now(),pack=await trx('tbl_scenario_packs').where({scenarioCode:'TEST_EXTERNAL_COMMUNICATION_V1',versionNumber:1,status:'published'}).first('id');
  assert(pack,'H4 technical pack is required');
  const steps=await trx('tbl_scenario_steps').where({scenarioPackId:pack.id,isActive:1}).orderBy('sequenceNumber');
  assert.deepEqual(steps.map(x=>x.actionType),['narrative_show','communication_receive','wait_communication_linked','narrative_show','communication_receive','narrative_show','narrative_show']);
  async function demo(label){
   const [tenantId]=await trx('tbl_tenants').insert({tenantName:`H4 ${label}`,tenantSlug:`h4-${label.toLowerCase()}-${suffix}`,status:1,timezone:'Europe/London',locale:'en-GB',defaultCurrency:'GBP',billingEmail:`h4-${label}-${suffix}@example.invalid`,isActive:1,tenantType:'demo',lifecycleStatus:'active'});
   const [userId]=await trx('tbl_users').insert({email:`h4-human-${label}-${suffix}@example.invalid`,fName:'Demo',lName:'Prospect',displayName:`Demo Prospect ${label}`,passwordHash:'not-used-by-test',isActive:1,isPlatformAdmin:0});
   await trx('tbl_user_tenants').insert({tenantId,userId,membershipStatus:'active',actorType:'human',isActive:1,acceptedDate:trx.fn.now()});
   const role=await trx('tbl_roles').where({roleKey:'owner',isActive:1}).first('id');assert(role,'Owner role is required');
   await trx('tbl_user_tenant_roles').insert({tenantId,userId,roleId:role.id,isPrimary:1,isActive:1});
   const [statusId]=await trx('tbl_event_statuses').insert({tenantId,statusName:'Open',systemCategory:'active',displayOrder:10,colour:'#0d6efd',isActive:1,isDefault:1});
   const [workflowId]=await trx('tbl_workflows').insert({tenantId,eventStatusId:statusId,workflowName:`H4 neutral record ${label}`,referenceCode:`H4-${label}-${suffix}`});
   const [instanceId]=await trx('tbl_scenario_instances').insert({tenantId,scenarioPackId:pack.id,currentStepId:steps[0].id,status:'ready',guideMode:'guided',simulatedDateTime:'2026-08-18 10:30:00'});
   return{tenantId,userId,workflowId,instanceId};
  }
  const a=await demo('A'),b=await demo('B');
  function app(d,body={},query={}){const state={status:200,body:null};return{state,req:{session:{USER_ID:d.userId,TENANT_ID:d.tenantId},body,query},res:{headersSent:false,status(code){state.status=code;return this},json(value){state.body=value;this.headersSent=true;return this}},getDbConnection(){return trx}}}
  async function run(d,step){return activity.advance(app(d),d.tenantId,d.instanceId,step.id,d.userId)}
  for(const d of [a,b]){await run(d,steps[0]);await run(d,steps[1])}
  const rows=await trx('tbl_communications').whereIn('tenantId',[a.tenantId,b.tenantId]).where({sourceType:'scenario'}).orderBy('tenantId');
  assert.equal(rows.length,2);assert(rows.every(x=>x.direction==='incoming'&&x.matchStatus==='unmatched'&&x.status==='pending_review'));
  assert(rows.every(x=>x.subjectCiphertext&&x.bodyTextCiphertext&&!x.subject&&!x.bodyText));
  for(const row of rows){assert.equal(security.decrypt({ciphertext:row.subjectCiphertext,iv:row.subjectIv,authTag:row.subjectAuthTag,keyVersion:row.keyVersion,encryptionVersion:row.encryptionVersion},row.tenantId,'communication.subject'),'Updated information')}
  assert.notEqual(rows[0].threadId,rows[1].threadId);assert.notEqual(rows[0].sourceConnectionId,rows[1].sourceConnectionId);
  const contacts=await trx('tbl_contacts').whereIn('tenantId',[a.tenantId,b.tenantId]).where({email:'jordan.reed@example.invalid'});assert.equal(contacts.length,2);assert.notEqual(contacts[0].id,contacts[1].id);
  const participants=await trx('tbl_communication_participants').whereIn('tenantId',[a.tenantId,b.tenantId]);assert.equal(participants.length,4);assert(participants.every(x=>x.emailCiphertext&&x.emailHash));
  const unmatchedA=await communications.unmatched.call(app(a));assert.equal(unmatchedA.communications.length,1);assert.equal(unmatchedA.communications[0].subject,'Updated information');assert.equal(unmatchedA.communications[0].suggestions.length,1);
  const retry=await run(a,steps[1]);assert.equal(retry.idempotent,true);assert.equal(Number((await trx('tbl_communications').where({tenantId:a.tenantId,sourceType:'scenario'}).count({count:'id'}).first()).count),1);
  const waitBefore=app(a);await assert.rejects(()=>activity.advance(waitBefore,a.tenantId,a.instanceId,steps[2].id,a.userId));assert.equal(waitBefore.state.status,409);
  const aCommunication=rows.find(x=>x.tenantId===a.tenantId),crossAssign=app(a);await assert.rejects(()=>communications.assign.call(crossAssign,{communicationId:aCommunication.id,workflowId:b.workflowId}));assert.equal(crossAssign.state.status,404);
  const bCommunication=rows.find(x=>x.tenantId===b.tenantId),foreignAssign=app(a);await assert.rejects(()=>communications.assign.call(foreignAssign,{communicationId:bCommunication.id,workflowId:a.workflowId}));assert.equal(foreignAssign.state.status,404);
  const assigned=await communications.assign.call(app(a),{communicationId:aCommunication.id,workflowId:a.workflowId});assert(assigned.success);
  await run(a,steps[2]);await run(a,steps[3]);await run(a,steps[4]);
  const second=await trx('tbl_communications').where({tenantId:a.tenantId,scenarioInstanceId:a.instanceId,sourceType:'scenario'}).orderBy('id','desc').first();
  assert.equal(second.matchStatus,'linked');assert.equal(second.status,'matched');assert.equal(second.threadId,rows.find(x=>x.tenantId===a.tenantId).threadId);
  assert(await trx('tbl_communication_links').where({tenantId:a.tenantId,communicationId:second.id,entityType:'workflow',entityId:a.workflowId}).first());
  const bStill=await trx('tbl_communications').where({id:bCommunication.id,tenantId:b.tenantId}).first();assert.equal(bStill.matchStatus,'unmatched');
  const crossScenario=app(a);await assert.rejects(()=>activity.advance(crossScenario,a.tenantId,b.instanceId,steps[2].id,a.userId));assert.equal(crossScenario.state.status,403);
  for(const [type,status] of [['live','active'],['trial','active'],['demo','expired'],['demo','suspended']]){
   await trx('tbl_tenants').where({id:b.tenantId}).update({tenantType:type,lifecycleStatus:status});const blocked=app(b);await assert.rejects(()=>activity.advance(blocked,b.tenantId,b.instanceId,steps[2].id,b.userId));assert.equal(blocked.state.status,403);
  }
  assert.equal(Number((await trx('tbl_notifications').whereIn('tenantId',[a.tenantId,b.tenantId]).whereNotNull('scenarioExecutionId').count({count:'id'}).first()).count),0,'normal ingestion creates no notification, so H4 must not invent one');
  console.log('H4 simulated communications, encryption, allocation, threading, lifecycle and tenant isolation tests passed.');
 }finally{await trx.rollback();await knex.destroy()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
