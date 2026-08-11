const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const knex = require('knex');
const argon2 = require('argon2');
const { loadAndValidateTestEnvironment, databaseConnection } = require('../support/environment');

const stateDirectory = path.resolve(__dirname, '..', '.state');
const statePath = path.join(stateDirectory, 'test-data.json');

function id(name) {
    if (!/^[a-z0-9_]+$/i.test(name)) throw new Error('Unsafe database identifier: ' + name);
    return mysql.escapeId(name);
}

async function insertUser(db, email, firstName, lastName, active, passwordHash) {
    const [result] = await db.execute(
        'INSERT INTO tbl_users (email,fName,lName,displayName,passwordHash,isActive,isPlatformAdmin) VALUES (?,?,?,?,?,?,0)',
        [email.toLowerCase(), firstName, lastName, firstName + ' ' + lastName, passwordHash, active ? 1 : 0]
    );
    return result.insertId;
}

async function addMembership(db, tenantId, userId, roleId, active = true) {
    const [membership] = await db.execute(
        "INSERT INTO tbl_user_tenants (tenantId,userId,membershipStatus,isActive,acceptedDate) VALUES (?,?,'active',?,CURRENT_TIMESTAMP)",
        [tenantId, userId, active ? 1 : 0]
    );
    await db.execute(
        'INSERT INTO tbl_user_tenant_roles (userId,tenantId,roleId,isPrimary,isActive,modifiedDate) VALUES (?,?,?,1,?,CURRENT_TIMESTAMP)',
        [userId, tenantId, roleId, active ? 1 : 0]
    );
    return membership.insertId;
}

async function seedTenantModules(db, tenantId, templateTenantId) {
    if (!templateTenantId) return;
    await db.execute(
        "INSERT INTO tbl_tenant_modules (tenantId,moduleId,status,accessStartDate,accessEndDate,trialEndsDate,billingInterval,monthlyPrice,annualPrice,currencyCode,billingReference,autoRenew,enabledDate,disabledDate,createdByUserId,modifiedByUserId,notes) SELECT ?,moduleId,CASE WHEN status IN ('ACTIVE','TRIAL') THEN 'ACTIVE' ELSE status END,CURRENT_TIMESTAMP,NULL,NULL,billingInterval,monthlyPrice,annualPrice,currencyCode,NULL,0,CURRENT_TIMESTAMP,NULL,NULL,NULL,'E2E seeded module' FROM tbl_tenant_modules WHERE tenantId=?",
        [tenantId, templateTenantId]
    );
}

async function enableModule(db, tenantId, moduleCode) {
    await db.execute(
        "INSERT INTO tbl_tenant_modules (tenantId,moduleId,status,accessStartDate,currencyCode,autoRenew,enabledDate,notes) SELECT ?,id,'ACTIVE',CURRENT_TIMESTAMP,currencyCode,0,CURRENT_TIMESTAMP,'E2E enabled module' FROM tbl_modules WHERE moduleCode=? AND isActive=1 ON DUPLICATE KEY UPDATE status='ACTIVE',accessStartDate=CURRENT_TIMESTAMP,accessEndDate=NULL,disabledDate=NULL",
        [tenantId, moduleCode]
    );
}

async function seedActivityTypes(db, tenantId) {
    for (const [key, name, category] of [
        ['workflow.created', 'Workflow created', 'workflow'],
        ['workflow.updated', 'Workflow updated', 'workflow'],
        ['task.created', 'Task created', 'task'],
        ['task.updated', 'Task updated', 'task'],
        ['task.status_changed', 'Task status changed', 'task'],
        ['task.team_changed', 'Task team changed', 'task'],
        ['task.location_changed', 'Task location changed', 'task'],
        ['location.created', 'Location created', 'location'],
        ['location.updated', 'Location updated', 'location']
    ]) {
        await db.execute(
            'INSERT INTO tbl_activity_types (tenantId,activityKey,activityName,activityCategory,description,isActive) VALUES (?,?,?,?,?,1) ON DUPLICATE KEY UPDATE isActive=1',
            [tenantId, key, name, category, name + ' during E2E testing']
        );
    }
}

async function seedTestData() {
    loadAndValidateTestEnvironment();
    const sourceName = process.env.E2E_SOURCE_DB;
    const testName = process.env.E2E_DB_NAME;
    const admin = await mysql.createConnection(databaseConnection());

    await admin.query('DROP DATABASE IF EXISTS ' + id(testName));
    await admin.query('CREATE DATABASE ' + id(testName) + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    const [tableRows] = await admin.query("SHOW FULL TABLES FROM " + id(sourceName) + " WHERE Table_type='BASE TABLE'");
    if (!tableRows.length) throw new Error('E2E seed: the source development database has no tables.');

    for (const row of tableRows) {
        const table = Object.values(row)[0];
        await admin.query('CREATE TABLE ' + id(testName) + '.' + id(table) + ' LIKE ' + id(sourceName) + '.' + id(table));
        const [columns] = await admin.query('SHOW COLUMNS FROM ' + id(sourceName) + '.' + id(table));
        const copiedColumns = columns.filter(column => !/GENERATED/i.test(column.Extra || '')).map(column => id(column.Field));
        if (copiedColumns.length) {
            const columnList = copiedColumns.join(',');
            await admin.query('INSERT INTO ' + id(testName) + '.' + id(table) + ' (' + columnList + ') SELECT ' + columnList + ' FROM ' + id(sourceName) + '.' + id(table));
        }
    }
    await admin.end();

    const db = await mysql.createConnection(databaseConnection(testName));
    await db.query('SET FOREIGN_KEY_CHECKS=0');
    const [sessionTable] = await db.query("SHOW TABLES LIKE 'tbl_sessions'");
    if (sessionTable.length) await db.query('TRUNCATE TABLE tbl_sessions');
    const [knexSessionTable] = await db.query("SHOW TABLES LIKE 'sessions'");
    if (knexSessionTable.length) await db.query('TRUNCATE TABLE sessions');

    const [alphaTenant] = await db.execute(
        "INSERT INTO tbl_tenants (tenantName,tenantSlug,status,timezone,locale,defaultCurrency,billingEmail,isActive) VALUES ('E2E Tenant Alpha','e2e-tenant-alpha',1,'Europe/London','en-GB','GBP','alpha@example.test',1)"
    );
    const [betaTenant] = await db.execute(
        "INSERT INTO tbl_tenants (tenantName,tenantSlug,status,timezone,locale,defaultCurrency,billingEmail,isActive) VALUES ('E2E Tenant Beta','e2e-tenant-beta',1,'Europe/London','en-GB','GBP','beta@example.test',1)"
    );
    const alphaTenantId = alphaTenant.insertId;
    const betaTenantId = betaTenant.insertId;

    await seedTenantModules(db, alphaTenantId, Number(process.env.E2E_TEMPLATE_TENANT_ID || 0));
    await seedTenantModules(db, betaTenantId, Number(process.env.E2E_TEMPLATE_TENANT_ID || 0));
    await enableModule(db, alphaTenantId, 'LOCATIONS');
    await enableModule(db, betaTenantId, 'LOCATIONS');
    await enableModule(db, alphaTenantId, 'CONTRACT_GENERATION');
    await enableModule(db, betaTenantId, 'CONTRACT_GENERATION');
    await seedActivityTypes(db, alphaTenantId);
    await seedActivityTypes(db, betaTenantId);

    const passwordHash = await argon2.hash(process.env.E2E_USER_PASSWORD, { type: argon2.argon2id });
    const users = {
        alphaOwner: await insertUser(db, process.env.E2E_OWNER_ALPHA_EMAIL, 'Alice', 'Owner', true, passwordHash),
        alphaAdmin: await insertUser(db, process.env.E2E_ADMIN_ALPHA_EMAIL, 'Aaron', 'Admin', true, passwordHash),
        alphaMember: await insertUser(db, process.env.E2E_MEMBER_ALPHA_EMAIL, 'Amelia', 'Member', true, passwordHash),
        alphaViewer: await insertUser(db, process.env.E2E_VIEWER_ALPHA_EMAIL, 'Avery', 'Viewer', true, passwordHash),
        alphaInactive: await insertUser(db, process.env.E2E_INACTIVE_ALPHA_EMAIL, 'Imogen', 'Inactive', false, passwordHash),
        betaOwner: await insertUser(db, process.env.E2E_OWNER_BETA_EMAIL, 'Beatrice', 'Owner', true, passwordHash),
        betaMember: await insertUser(db, process.env.E2E_MEMBER_BETA_EMAIL, 'Benjamin', 'Member', true, passwordHash)
    };

    const memberships = {
        alphaOwner: await addMembership(db, alphaTenantId, users.alphaOwner, 1),
        alphaAdmin: await addMembership(db, alphaTenantId, users.alphaAdmin, 2),
        alphaMember: await addMembership(db, alphaTenantId, users.alphaMember, 3),
        alphaViewer: await addMembership(db, alphaTenantId, users.alphaViewer, 6),
        alphaInactive: await addMembership(db, alphaTenantId, users.alphaInactive, 3, false),
        betaOwner: await addMembership(db, betaTenantId, users.betaOwner, 1),
        betaMember: await addMembership(db, betaTenantId, users.betaMember, 3)
    };

    const [alphaTeam] = await db.execute("INSERT INTO tbl_teams (tenantId,teamName,description,isActive) VALUES (?,'E2E Alpha Team','Tenant Alpha test team',1)", [alphaTenantId]);
    const [betaTeam] = await db.execute("INSERT INTO tbl_teams (tenantId,teamName,description,isActive) VALUES (?,'E2E Beta Team','Tenant Beta test team',1)", [betaTenantId]);
    const [alphaTeamRole] = await db.execute("INSERT INTO tbl_team_roles (tenantId,teamId,teamRoleCode,teamRoleName,teamRoleDescription,roleDesc,isProtected,isAssignable,isActive,status) VALUES (?,?,'team_member','Team Member','E2E team member role','Team Member',1,1,1,'active')", [alphaTenantId,alphaTeam.insertId]);
    const [betaTeamRole] = await db.execute("INSERT INTO tbl_team_roles (tenantId,teamId,teamRoleCode,teamRoleName,teamRoleDescription,roleDesc,isProtected,isAssignable,isActive,status) VALUES (?,?,'team_member','Team Member','E2E team member role','Team Member',1,1,1,'active')", [betaTenantId,betaTeam.insertId]);
    const [alphaMembers] = await db.execute("INSERT INTO tbl_team_members (tenantId,userTenantId,tenantUserId,teamId,teamRole,isPrimary,isActive) VALUES (?,?,?,?,?,1,1),(?,?,?,?,?,0,1),(?,?,?,?,?,0,1)", [alphaTenantId,memberships.alphaOwner,memberships.alphaOwner,alphaTeam.insertId,alphaTeamRole.insertId,alphaTenantId,memberships.alphaAdmin,memberships.alphaAdmin,alphaTeam.insertId,alphaTeamRole.insertId,alphaTenantId,memberships.alphaMember,memberships.alphaMember,alphaTeam.insertId,alphaTeamRole.insertId]);
    const [betaMembers] = await db.execute("INSERT INTO tbl_team_members (tenantId,userTenantId,tenantUserId,teamId,teamRole,isPrimary,isActive) VALUES (?,?,?,?,?,1,1),(?,?,?,?,?,0,1)", [betaTenantId,memberships.betaOwner,memberships.betaOwner,betaTeam.insertId,betaTeamRole.insertId,betaTenantId,memberships.betaMember,memberships.betaMember,betaTeam.insertId,betaTeamRole.insertId]);
    await db.execute("INSERT INTO tbl_team_member_roles (teamMemberId,teamRoleId,isActive) SELECT id,teamRole,1 FROM tbl_team_members WHERE id BETWEEN ? AND ?", [alphaMembers.insertId,alphaMembers.insertId + 2]);
    await db.execute("INSERT INTO tbl_team_member_roles (teamMemberId,teamRoleId,isActive) SELECT id,teamRole,1 FROM tbl_team_members WHERE id BETWEEN ? AND ?", [betaMembers.insertId,betaMembers.insertId + 1]);
    const [alphaLocation] = await db.execute("INSERT INTO tbl_locations (tenantId,locationName,locationType,townCity,country,isActive) VALUES (?,'E2E Alpha Location','Test','Alpha Town','United Kingdom',1)", [alphaTenantId]);
    const [betaLocation] = await db.execute("INSERT INTO tbl_locations (tenantId,locationName,locationType,townCity,country,isActive) VALUES (?,'E2E Beta Location','Test','Beta Town','United Kingdom',1)", [betaTenantId]);
    const [alphaSpace] = await db.execute("INSERT INTO tbl_spaces (tenantId,locationId,spaceName,spaceType,description,defaultCapacity,isActive) VALUES (?,?,'E2E Alpha Space','Auditorium','E2E test space',250,1)", [alphaTenantId, alphaLocation.insertId]);
    const [betaSpace] = await db.execute("INSERT INTO tbl_spaces (tenantId,locationId,spaceName,spaceType,description,defaultCapacity,isActive) VALUES (?,?,'E2E Beta Space','Room','E2E test space',80,1)", [betaTenantId, betaLocation.insertId]);
    const [alphaConfiguration] = await db.execute("INSERT INTO tbl_space_configurations (tenantId,spaceId,configurationName,description,seatedCapacity,standingCapacity,maximumTotalCapacity,setupMinutes,resetMinutes,isDefault,isActive) VALUES (?,?,'E2E Alpha Seated','E2E seated layout',200,0,200,30,20,1,1)", [alphaTenantId, alphaSpace.insertId]);
    const [betaConfiguration] = await db.execute("INSERT INTO tbl_space_configurations (tenantId,spaceId,configurationName,description,seatedCapacity,standingCapacity,maximumTotalCapacity,setupMinutes,resetMinutes,isDefault,isActive) VALUES (?,?,'E2E Beta Standing','E2E standing layout',0,70,70,15,15,1,1)", [betaTenantId, betaSpace.insertId]);
    const [alphaStatus] = await db.execute("INSERT INTO tbl_event_statuses (tenantId,statusName,systemCategory,displayOrder,colour,isActive,isDefault,createdByUserId) VALUES (?,'E2E Planned','planned',10,'#2563EB',1,1,?)", [alphaTenantId, users.alphaOwner]);
    const [betaStatus] = await db.execute("INSERT INTO tbl_event_statuses (tenantId,statusName,systemCategory,displayOrder,colour,isActive,isDefault,createdByUserId) VALUES (?,'E2E Planned','planned',10,'#14B8A6',1,1,?)", [betaTenantId, users.betaOwner]);
    const [alphaType] = await db.execute("INSERT INTO tbl_workflow_types (tenantId,typeName,description,colour,sortOrder,isActive) VALUES (?,'E2E Event','E2E workflow type','#2563EB',10,1)", [alphaTenantId]);
    const [betaType] = await db.execute("INSERT INTO tbl_workflow_types (tenantId,typeName,description,colour,sortOrder,isActive) VALUES (?,'E2E Event','E2E workflow type','#14B8A6',10,1)", [betaTenantId]);

    const [alphaTemplate] = await db.execute("INSERT INTO tbl_workflow_templates (tenantId,templateName,templateKey,description,versionNumber,status,isDefault,createdByUserId) VALUES (?,'E2E Alpha Workflow Template','e2e-alpha-workflow','Repeatable E2E workflow template',1,'published',1,?)", [alphaTenantId, users.alphaOwner]);
    const [alphaTemplateStage] = await db.execute("INSERT INTO tbl_template_stages (tenantId,templateId,stageName,description,sortOrder,status,colour,requiresAllTasksComplete) VALUES (?,?,'E2E Delivery Phase','E2E active phase',10,'active','#2563EB',1)", [alphaTenantId, alphaTemplate.insertId]);
    await db.execute("INSERT INTO tbl_template_tasks (tenantId,templateId,templateStageId,taskName,description,sortOrder,priority,status,isRequired,dueOffsetType,dueOffsetDays,dueRelation,defaultOwnerType) VALUES (?,?,?,'E2E Required Template Task','Required E2E task',10,'normal','active',1,'workflow_start_date',2,'after','workflow_owner'),(?,?,?,'E2E Optional Template Task','Optional E2E task',20,'low','active',0,'workflow_start_date',3,'after','unassigned')", [alphaTenantId, alphaTemplate.insertId, alphaTemplateStage.insertId, alphaTenantId, alphaTemplate.insertId, alphaTemplateStage.insertId]);

    const [alphaWorkflow] = await db.execute(
        "INSERT INTO tbl_workflows (tenantId,workflowTypeId,eventStatusId,workflowName,referenceCode,status,ownerUserId,ownerTeamId,locationId,startDate,targetDate,createdByUserId,modifiedByUserId,rowVersion) VALUES (?,?,?,'E2E Alpha Event','E2E-ALPHA','active',?,?,?,CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY),?,?,1)",
        [alphaTenantId, alphaType.insertId, alphaStatus.insertId, users.alphaOwner, alphaTeam.insertId, alphaLocation.insertId, users.alphaOwner, users.alphaOwner]
    );
    const [betaWorkflow] = await db.execute(
        "INSERT INTO tbl_workflows (tenantId,workflowTypeId,eventStatusId,workflowName,referenceCode,status,ownerUserId,ownerTeamId,locationId,startDate,targetDate,createdByUserId,modifiedByUserId,rowVersion) VALUES (?,?,?,'E2E Beta Event','E2E-BETA','active',?,?,?,CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY),?,?,1)",
        [betaTenantId, betaType.insertId, betaStatus.insertId, users.betaOwner, betaTeam.insertId, betaLocation.insertId, users.betaOwner, users.betaOwner]
    );
    const [alphaStage] = await db.execute("INSERT INTO tbl_workflow_stages (tenantId,workflowId,sourceTemplateStageId,stageName,description,sortOrder,status,colour) VALUES (?,?,?,'E2E Active Phase','E2E seeded workflow phase',10,'in_progress','#2563EB')", [alphaTenantId, alphaWorkflow.insertId, alphaTemplateStage.insertId]);
    await db.execute('UPDATE tbl_workflows SET templateId=?,templateVersionNumber=1,currentStageId=?,spaceId=?,configurationId=? WHERE id=?', [alphaTemplate.insertId, alphaStage.insertId, alphaSpace.insertId, alphaConfiguration.insertId, alphaWorkflow.insertId]);
    const [alphaTask] = await db.execute("INSERT INTO tbl_tasks (tenantId,workflowId,workflowStageId,taskName,description,status,priority,isRequired,assignedToUserId,assignedToTeamId,dueDate,createdByUserId,rowVersion) VALUES (?,?,?,'E2E Alpha Task','Tenant Alpha test task','not_started','normal',1,?,?,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 7 DAY),?,1)", [alphaTenantId, alphaWorkflow.insertId, alphaStage.insertId, users.alphaMember, alphaTeam.insertId, users.alphaOwner]);
    const [alphaTaskTwo] = await db.execute("INSERT INTO tbl_tasks (tenantId,workflowId,workflowStageId,taskName,description,status,priority,isRequired,assignedToUserId,assignedToTeamId,dueDate,createdByUserId,rowVersion) VALUES (?,?,?,'E2E Alpha Task Two','Second concurrent E2E task','not_started','normal',0,?,?,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 8 DAY),?,1)", [alphaTenantId, alphaWorkflow.insertId, alphaStage.insertId, users.alphaAdmin, alphaTeam.insertId, users.alphaOwner]);
    const [betaTask] = await db.execute("INSERT INTO tbl_tasks (tenantId,workflowId,taskName,description,status,priority,isRequired,assignedToUserId,assignedToTeamId,dueDate,createdByUserId,rowVersion) VALUES (?,?,'E2E Beta Task','Tenant Beta test task','not_started','normal',1,?,?,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 7 DAY),?,1)", [betaTenantId, betaWorkflow.insertId, users.betaMember, betaTeam.insertId, users.betaOwner]);

    const [alphaEntity] = await db.execute("INSERT INTO tbl_contracting_entities (tenantId,tradingName,legalName,registrationNumber,vatNumber,addressLine1,townCity,postcode,country,email,signatoryName,signatoryTitle,defaultPaymentTerms,contractFooter,isDefault,isActive,createdByUserId,modifiedByUserId) VALUES (?,'E2E Alpha Trading','E2E Alpha Legal Ltd','E2E-001','GB-E2E-001','1 Alpha Street','Alpha Town','AA1 1AA','United Kingdom','contracts-alpha@example.test','Alice Signatory','Director','Payment within 30 days','E2E Alpha footer',1,1,?,?)", [alphaTenantId, users.alphaOwner, users.alphaOwner]);
    const [betaEntity] = await db.execute("INSERT INTO tbl_contracting_entities (tenantId,tradingName,legalName,registrationNumber,addressLine1,townCity,postcode,country,email,isDefault,isActive,createdByUserId,modifiedByUserId) VALUES (?,'E2E Beta Trading','E2E Beta Legal Ltd','E2E-002','2 Beta Street','Beta Town','BB1 1BB','United Kingdom','contracts-beta@example.test',1,1,?,?)", [betaTenantId, users.betaOwner, users.betaOwner]);
    await db.execute('UPDATE tbl_workflows SET contractingEntityId=? WHERE id=? AND tenantId=?', [alphaEntity.insertId, alphaWorkflow.insertId, alphaTenantId]);
    await db.execute('UPDATE tbl_workflows SET contractingEntityId=? WHERE id=? AND tenantId=?', [betaEntity.insertId, betaWorkflow.insertId, betaTenantId]);

    const templateBody = '<h1>{{event.name}}</h1><p>Reference: {{event.reference}}</p><p>Venue: {{location.name}}</p><p>Organisation: {{tenant.name}}</p><p>Entity: {{contractingEntity.legalName}}</p>';
    const [alphaContractTemplate] = await db.execute("INSERT INTO tbl_contract_templates (tenantId,templateName,description,outputType,templateKey,bodyHtml,versionNumber,isActive,createdByUserId,modifiedByUserId) VALUES (?,'E2E Alpha Contract','Phase 3 deterministic contract template','contract','e2e-alpha-contract',?,1,1,?,?)", [alphaTenantId, templateBody, users.alphaOwner, users.alphaOwner]);
    const [betaContractTemplate] = await db.execute("INSERT INTO tbl_contract_templates (tenantId,templateName,description,outputType,templateKey,bodyHtml,versionNumber,isActive,createdByUserId,modifiedByUserId) VALUES (?,'E2E Beta Contract','Phase 3 tenant isolation template','contract','e2e-beta-contract',?,1,1,?,?)", [betaTenantId, templateBody, users.betaOwner, users.betaOwner]);
    const [alphaClause] = await db.execute("INSERT INTO tbl_contract_clauses (tenantId,clauseName,clauseCode,clauseCategory,clauseHtml,clauseBehaviour,sortOrder,isActive,createdByUserId,modifiedByUserId) VALUES (?,'E2E Health and Safety','E2E-HS','Operations','<p>{{eventName}} at {{venueName}} must comply with E2E safety rules for {{tenantName}}.</p>','mandatory',10,1,?,?)", [alphaTenantId, users.alphaOwner, users.alphaOwner]);
    const [betaClause] = await db.execute("INSERT INTO tbl_contract_clauses (tenantId,clauseName,clauseCode,clauseCategory,clauseHtml,clauseBehaviour,sortOrder,isActive,createdByUserId,modifiedByUserId) VALUES (?,'E2E Beta Clause','E2E-BETA','General','<p>Beta tenant wording.</p>','optional',10,1,?,?)", [betaTenantId, users.betaOwner, users.betaOwner]);
    const [alphaTemplateClause] = await db.execute("INSERT INTO tbl_contract_template_clauses (tenantId,templateId,clauseId,clauseNameSnapshot,clauseHtmlSnapshot,clauseBehaviour,defaultIncluded,isActive,sortOrder,modifiedByUserId) VALUES (?,?,?,?,?,'mandatory',1,1,10,?)", [alphaTenantId, alphaContractTemplate.insertId, alphaClause.insertId, 'E2E Health and Safety', '<p>{{eventName}} at {{venueName}} must comply with E2E safety rules for {{tenantName}}.</p>', users.alphaOwner]);
    const [alphaDraft] = await db.execute("INSERT INTO tbl_generated_contracts (tenantId,workflowId,templateId,templateVersionNumber,contractVersionNumber,rowVersion,draftModifiedDate,draftModifiedByUserId,contractingEntityId,contractName,renderedHtml,status,generatedByUserId,modifiedByUserId) VALUES (?,?,?,?,0,1,CURRENT_TIMESTAMP,?,?,?,'<h1>E2E Alpha Event Contract</h1><p>Editable Phase 3 draft.</p>','draft',?,?)", [alphaTenantId, alphaWorkflow.insertId, alphaContractTemplate.insertId, 1, users.alphaOwner, alphaEntity.insertId, 'E2E Alpha Draft Contract', users.alphaOwner, users.alphaOwner]);
    const [betaDraft] = await db.execute("INSERT INTO tbl_generated_contracts (tenantId,workflowId,templateId,templateVersionNumber,contractVersionNumber,rowVersion,draftModifiedDate,draftModifiedByUserId,contractingEntityId,contractName,renderedHtml,status,generatedByUserId,modifiedByUserId) VALUES (?,?,?,?,0,1,CURRENT_TIMESTAMP,?,?,?,'<h1>E2E Beta Event Contract</h1><p>Beta private wording.</p>','draft',?,?)", [betaTenantId, betaWorkflow.insertId, betaContractTemplate.insertId, 1, users.betaOwner, betaEntity.insertId, 'E2E Beta Draft Contract', users.betaOwner, users.betaOwner]);
    const [alphaDocumentClause] = await db.execute("INSERT INTO tbl_contract_document_clauses (tenantId,contractId,sourceClauseId,clauseHeading,clauseTextSnapshot,clauseBehaviour,displayOrder,isIncluded,isCustom,createdByUserId,modifiedByUserId) VALUES (?,?,?,'E2E Health and Safety','<p>E2E Alpha Event at E2E Alpha Location must comply with E2E safety rules for E2E Tenant Alpha.</p>','mandatory',10,1,0,?,?)", [alphaTenantId, alphaDraft.insertId, alphaClause.insertId, users.alphaOwner, users.alphaOwner]);
    await db.query('SET FOREIGN_KEY_CHECKS=1');
    await db.end();

    // Keep the isolated browser database reproducible when new form tables or seed tenants are added.
    const migrationDb = knex({client:'mysql2',connection:{...databaseConnection(),database:testName}});
    try {
        await require('../../../db/20260808_configurable_forms').up(migrationDb);
        await require('../../../db/20260808_seed_event_record_form').up(migrationDb);
        await require('../../../db/20260809_task_question_redesign').up(migrationDb);
        await require('../../../db/20260809_seed_task_question_templates').up(migrationDb);
    } finally {
        await migrationDb.destroy();
    }

    const state = {
        tenants: { alpha: alphaTenantId, beta: betaTenantId },
        users,
        memberships,
        teams: { alpha: alphaTeam.insertId, beta: betaTeam.insertId },
        locations: { alpha: alphaLocation.insertId, beta: betaLocation.insertId },
        spaces: { alpha: alphaSpace.insertId, beta: betaSpace.insertId },
        configurations: { alpha: alphaConfiguration.insertId, beta: betaConfiguration.insertId },
        statuses: { alpha: alphaStatus.insertId, beta: betaStatus.insertId },
        workflowTypes: { alpha: alphaType.insertId, beta: betaType.insertId },
        templates: { alpha: alphaTemplate.insertId },
        templateStages: { alpha: alphaTemplateStage.insertId },
        workflowStages: { alpha: alphaStage.insertId },
        workflows: { alpha: alphaWorkflow.insertId, beta: betaWorkflow.insertId },
        tasks: { alpha: alphaTask.insertId, alphaTwo: alphaTaskTwo.insertId, beta: betaTask.insertId },
        contractingEntities: { alpha: alphaEntity.insertId, beta: betaEntity.insertId },
        contractTemplates: { alpha: alphaContractTemplate.insertId, beta: betaContractTemplate.insertId },
        contractClauses: { alpha: alphaClause.insertId, beta: betaClause.insertId },
        contractTemplateClauses: { alpha: alphaTemplateClause.insertId },
        contracts: { alphaDraft: alphaDraft.insertId, betaDraft: betaDraft.insertId },
        contractDocumentClauses: { alpha: alphaDocumentClause.insertId }
    };
    fs.mkdirSync(stateDirectory, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log('E2E database rebuilt and deterministic Meldren test data seeded.');
    return state;
}

if (require.main === module) {
    seedTestData().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}

module.exports = { seedTestData, statePath };
