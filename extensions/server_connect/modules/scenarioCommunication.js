const communicationEmail=require('./communicationEmail')._test;
const security=require('./metipathSecurity')._test;

const SENDER={name:'Jordan Reed',email:'jordan.reed@example.invalid'};

async function map(trx,context,type,key,id){
  await trx('tbl_scenario_resource_mappings').insert({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,resourceType:type,resourceKey:key,resourceId:id}).onConflict(['tenantId','scenarioInstanceId','resourceType','resourceKey']).merge({resourceId:id});
}

async function mapped(trx,context,type,key,table){
  const row=await trx('tbl_scenario_resource_mappings').where({tenantId:context.tenantId,scenarioInstanceId:context.instanceId,resourceType:type,resourceKey:key}).first('resourceId');
  return row&&await trx(table).where({id:row.resourceId,tenantId:context.tenantId}).first();
}

async function ensureWorkflow(trx,context){
  let workflow=await mapped(trx,context,'workflow','communication_record','tbl_workflows');
  if(workflow)return workflow;
  workflow=await trx('tbl_workflows').where({tenantId:context.tenantId}).orderBy('id').first();
  if(!workflow){
    let status=await trx('tbl_event_statuses').where({tenantId:context.tenantId}).orderBy('id').first();
    if(!status){const ids=await trx('tbl_event_statuses').insert({tenantId:context.tenantId,statusName:'Open',systemCategory:'active',displayOrder:10,colour:'#0d6efd',isActive:1,isDefault:1});status={id:ids[0]};await map(trx,context,'event_status','communication_open_status',status.id)}
    const ids=await trx('tbl_workflows').insert({tenantId:context.tenantId,eventStatusId:status.id,workflowName:'Technical communication record',referenceCode:`H4-${context.instanceId}`});
    workflow=await trx('tbl_workflows').where({id:ids[0],tenantId:context.tenantId}).first();
  }
  await map(trx,context,'workflow','communication_record',workflow.id);
  return workflow;
}

async function ensureContact(trx,context,workflow){
  let contact=await mapped(trx,context,'contact','external_contact_1','tbl_contacts');
  if(!contact){
    const ids=await trx('tbl_contacts').insert({tenantId:context.tenantId,contactType:'person',firstName:'Jordan',lastName:'Reed',displayName:SENDER.name,email:SENDER.email,isActive:1});
    contact=await trx('tbl_contacts').where({id:ids[0],tenantId:context.tenantId}).first();
    await map(trx,context,'contact','external_contact_1',contact.id);
  }
  await trx('tbl_workflow_contacts').insert({tenantId:context.tenantId,workflowId:workflow.id,contactId:contact.id,relationshipType:'external_contact',isPrimary:1}).onConflict(['workflowId','contactId','relationshipType']).ignore();
  return contact;
}

async function ensureEntitlement(trx,context){
  const moduleRow=await trx('tbl_modules').where({moduleCode:'EMAIL_INTEGRATION',isActive:1}).first('id');
  if(!moduleRow)throw Object.assign(new Error('The communications module is unavailable.'),{code:'SCENARIO_COMMUNICATIONS_UNAVAILABLE'});
  let entitlement=await trx('tbl_tenant_modules').where({tenantId:context.tenantId,moduleId:moduleRow.id}).first();
  if(!entitlement){
    const ids=await trx('tbl_tenant_modules').insert({tenantId:context.tenantId,moduleId:moduleRow.id,status:'ACTIVE',currencyCode:'GBP',autoRenew:0,enabledDate:trx.fn.now(),notes:'Enabled for active demo scenario communications.'});
    entitlement={id:ids[0]};
    await map(trx,context,'tenant_module','email_integration',entitlement.id);
  }else if(!['ACTIVE','TRIAL'].includes(entitlement.status)){
    await trx('tbl_tenant_modules').where({id:entitlement.id,tenantId:context.tenantId}).update({status:'ACTIVE',enabledDate:trx.fn.now(),disabledDate:null,modifiedDate:trx.fn.now()});
  }
  return entitlement;
}

async function ensureConnection(trx,context,userId){
  let connection=await mapped(trx,context,'email_connection','scenario_mailbox','tbl_email_connections');
  if(connection)return connection;
  const address=`scenario+${context.tenantId}.${context.instanceId}@example.invalid`,mailbox=security.encrypt(address,context.tenantId,'email.mailbox'),display=security.encrypt('Metipath guided demo',context.tenantId,'email.display_name');
  const ids=await trx('tbl_email_connections').insert({tenantId:context.tenantId,connectedByUserId:userId,provider:'scenario',providerDisplayName:'Guided demo',mailboxAddressCiphertext:mailbox.ciphertext,mailboxAddressIv:mailbox.iv,mailboxAddressAuthTag:mailbox.authTag,mailboxAddressHash:security.searchHash(address,context.tenantId,'email.mailbox','email'),displayNameCiphertext:display.ciphertext,displayNameIv:display.iv,displayNameAuthTag:display.authTag,keyVersion:mailbox.keyVersion,nylasGrantId:null,connectionStatus:'scenario',connectionType:'scenario_internal',purpose:'Guided demo communications',isActive:1,mailboxType:'workflow',accessMode:'record',isSensitive:0,unmatchedRetentionDays:30});
  connection=await trx('tbl_email_connections').where({id:ids[0],tenantId:context.tenantId}).first();
  await map(trx,context,'email_connection','scenario_mailbox',connection.id);
  return connection;
}

async function inject(trx,context,execution,config,userId){
  const workflow=await ensureWorkflow(trx,context);
  await ensureContact(trx,context,workflow);
  await ensureEntitlement(trx,context);
  const connection=await ensureConnection(trx,context,userId);
  const messageKey=String(config.messageKey||'external_email_1'),threadKey=String(config.threadKey||'external_thread_1');
  const prior=await mapped(trx,context,'communication',messageKey,'tbl_communications');
  if(prior)return{communicationId:prior.id,threadId:prior.threadId,workflowId:workflow.id,idempotent:true};
  const syntheticThreadId=`scenario:${context.instanceId}:${threadKey}:thread`,syntheticMessageId=`scenario:${context.instanceId}:${messageKey}:message`;
  const result=await communicationEmail.ingest(trx,connection,{id:syntheticMessageId,thread_id:syntheticThreadId,from:[SENDER],to:[{name:'Metipath guided demo',email:`scenario+${context.tenantId}.${context.instanceId}@example.invalid`}],cc:[],bcc:[],subject:String(config.subject||'Updated information'),body:String(config.body||'I have updated the information we discussed. Please attach this message to the appropriate record.'),date:Math.floor(new Date(context.simulatedDateTime||Date.now()).getTime()/1000),attachments:[]},{sourceType:'scenario',scenarioInstanceId:context.instanceId,scenarioExecutionId:execution.id});
  const communication=await trx('tbl_communications').where({id:result.communicationId,tenantId:context.tenantId}).first();
  await map(trx,context,'communication',messageKey,communication.id);
  await map(trx,context,'communication_thread',threadKey,communication.threadId);
  return{communicationId:communication.id,threadId:communication.threadId,workflowId:workflow.id,matched:communication.matchStatus==='linked'};
}

async function requireLinked(trx,context,config){
  const key=String(config.messageKey||'external_email_1'),communication=await mapped(trx,context,'communication',key,'tbl_communications');
  if(!communication)throw Object.assign(new Error('The scenario communication has not arrived yet.'),{code:'SCENARIO_COMMUNICATION_REQUIRED'});
  const workflow=await mapped(trx,context,'workflow','communication_record','tbl_workflows');
  const link=workflow&&await trx('tbl_communication_links').where({tenantId:context.tenantId,communicationId:communication.id,entityType:'workflow',entityId:workflow.id}).first();
  if(!link)throw Object.assign(new Error('Open Communications and allocate the email to the suggested record before continuing.'),{code:'SCENARIO_USER_ACTION_REQUIRED',status:409});
  return{communicationId:communication.id,workflowId:workflow.id,linkId:link.id};
}

module.exports={inject,requireLinked,_test:{ensureWorkflow,ensureContact,ensureEntitlement,ensureConnection,inject,requireLinked,mapped}};
