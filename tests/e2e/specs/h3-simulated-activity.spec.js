const {test,expect,loginAs,withTestDb}=require('../fixtures/meldren');

test('H3 technical scenario uses real task, notification and encrypted chat UI',async({page,users,testData})=>{
 let instanceId;
 try{
  instanceId=await withTestDb(async db=>{
   await db.execute("UPDATE tbl_tenants SET tenantType='demo',lifecycleStatus='active',accessStartDate=NULL,accessEndDate=NULL WHERE id=?",[testData.tenants.alpha]);
   const [[pack]]=await db.execute("SELECT id FROM tbl_scenario_packs WHERE scenarioCode='TEST_INTERNAL_ACTIVITY_V1' AND versionNumber=1");
   const [[step]]=await db.execute('SELECT id FROM tbl_scenario_steps WHERE scenarioPackId=? ORDER BY sequenceNumber LIMIT 1',[pack.id]);
   const [insert]=await db.execute("INSERT INTO tbl_scenario_instances (tenantId,scenarioPackId,currentStepId,status,guideMode) VALUES (?,?,?,'ready','guided')",[testData.tenants.alpha,pack.id,step.id]);
   return insert.insertId;
  });
  await loginAs(page,users.alphaOwner);
  await page.goto('/demo/test-scenario');
  await expect(page.getByRole('heading',{name:'Internal activity technical scenario'})).toBeVisible();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByText('Sam Taylor is completing the technical review task.')).toBeVisible();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByText('Alex Morgan has an update for you.')).toBeVisible();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByText('Open Messages, read Alex Morgan’s update, then continue.')).toBeVisible();

  await page.getByRole('button',{name:'Notifications'}).click();
  await expect(page.getByText('New message from Alex Morgan')).toBeVisible();
  await page.getByRole('button',{name:'Messages'}).click();
  await page.locator('.shell-chat-list-item').filter({hasText:'Alex Morgan'}).click();
  await expect(page.getByText('The task has been completed. Please review the update.')).toBeVisible();

  await page.goto('/tasks');
  await expect(page.getByText('Review internal activity update')).toBeVisible();
  const proof=await withTestDb(async db=>{
   const [[task]]=await db.execute("SELECT status,completedByUserId FROM tbl_tasks WHERE tenantId=? AND taskName='Review internal activity update'",[testData.tenants.alpha]);
   const [[message]]=await db.execute('SELECT messageText,messageCiphertext,scenarioExecutionId FROM tbl_chat_messages WHERE tenantId=? AND scenarioInstanceId=?',[testData.tenants.alpha,instanceId]);
   return{task,message};
  });
  expect(proof.task.status).toBe('complete');expect(proof.task.completedByUserId).toBeTruthy();expect(proof.message.messageText).toBeNull();expect(proof.message.messageCiphertext).toBeTruthy();expect(proof.message.scenarioExecutionId).toBeTruthy();

  await page.goto('/demo/test-scenario');
  await page.getByRole('button',{name:'I have reviewed the message'}).click();
  await expect(page.getByText('The internal activity test is complete.')).toBeVisible();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByText('Scenario complete.')).toBeVisible();
 }finally{
  await withTestDb(db=>db.execute("UPDATE tbl_tenants SET tenantType='live',lifecycleStatus='active',accessEndDate=NULL WHERE id=?",[testData.tenants.alpha]));
 }
});

test('simulated membership cannot become an interactive tenant session even with a usable password hash',async({page,users,testData})=>{
 const email=`simulated-login-${Date.now()}@invalid`;
 await withTestDb(async db=>{
  const [[human]]=await db.execute('SELECT passwordHash FROM tbl_users WHERE email=?',[users.alphaOwner.email]);
  const [created]=await db.execute("INSERT INTO tbl_users (email,fName,lName,displayName,passwordHash,isActive,isPlatformAdmin,verifycode) VALUES (?,'Test','Actor','Test Simulated Actor',?,1,0,NULL)",[email,human.passwordHash]);
  await db.execute("INSERT INTO tbl_user_tenants (tenantId,userId,membershipStatus,actorType,isActive,acceptedDate) VALUES (?,?,'active','simulated',1,CURRENT_TIMESTAMP)",[testData.tenants.alpha,created.insertId]);
  const [[role]]=await db.execute("SELECT id FROM tbl_roles WHERE roleKey='owner' AND isActive=1 LIMIT 1");
  await db.execute('INSERT INTO tbl_user_tenant_roles (tenantId,userId,roleId,isPrimary,isActive) VALUES (?,?,?,1,1)',[testData.tenants.alpha,created.insertId,role.id]);
 });
 await page.goto('/login/login');
 await page.getByTestId('login-email').fill(email);
 await page.getByTestId('login-password').fill(users.alphaOwner.password);
 await page.getByRole('button',{name:/^sign in$/i}).click();
 await page.waitForLoadState('networkidle');
 expect(['/login','/login/login','/unauthorised']).toContain(new URL(page.url()).pathname);
 const options=await page.request.get('/api/login/tenant_options');
 if(options.ok())expect(JSON.stringify(await options.json())).not.toContain('E2E Tenant Alpha');
});
