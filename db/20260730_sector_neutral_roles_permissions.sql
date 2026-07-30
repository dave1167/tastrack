-- Sector-neutral tenant roles and granular permissions.
-- Repeat-safe: this migration may be run more than once.

INSERT INTO tbl_permissions
    (permissionCode, permissionKey, permissionName, permissionDescription, permissionScope, permissionGroup, isSensitive, isAssignable, description, isActive)
VALUES
    ('workflows.view','workflows.view','View workflows','View tenant workflows and their current status.','tenant','workflows',0,1,'View tenant workflows and their current status.',1),
    ('workflows.create','workflows.create','Create workflows','Create new workflows.','tenant','workflows',0,1,'Create new workflows.',1),
    ('workflows.edit','workflows.edit','Edit workflows','Edit workflow details.','tenant','workflows',0,1,'Edit workflow details.',1),
    ('workflows.status.manage','workflows.status.manage','Change workflow status','Change workflow status and milestones.','tenant','workflows',0,1,'Change workflow status and milestones.',1),
    ('workflows.archive','workflows.archive','Archive workflows','Archive completed or cancelled workflows.','tenant','workflows',1,1,'Archive completed or cancelled workflows.',1),
    ('tasks.view.own','tasks.view.own','View own tasks','View tasks allocated to the user.','own_record','tasks',0,1,'View tasks allocated to the user.',1),
    ('tasks.view.team','tasks.view.team','View team tasks','View tasks belonging to authorised teams.','team','tasks',0,1,'View tasks belonging to authorised teams.',1),
    ('tasks.create','tasks.create','Create tasks','Create workflow tasks.','tenant','tasks',0,1,'Create workflow tasks.',1),
    ('tasks.edit','tasks.edit','Edit tasks','Edit workflow tasks.','tenant','tasks',0,1,'Edit workflow tasks.',1),
    ('tasks.allocate','tasks.allocate','Allocate tasks','Allocate tasks to teams and named members.','team','tasks',0,1,'Allocate tasks to teams and named members.',1),
    ('tasks.complete','tasks.complete','Complete tasks','Mark allocated tasks as complete.','assigned_record','tasks',0,1,'Mark allocated tasks as complete.',1),
    ('tasks.reopen','tasks.reopen','Reopen tasks','Reopen completed tasks.','team','tasks',0,1,'Reopen completed tasks.',1),
    ('agreements.view','agreements.view','View agreements','View agreements and issued versions.','tenant','agreements',0,1,'View agreements and issued versions.',1),
    ('agreements.drafts.create','agreements.drafts.create','Create agreement drafts','Create agreement drafts from templates.','tenant','agreements',0,1,'Create agreement drafts from templates.',1),
    ('agreements.drafts.edit','agreements.drafts.edit','Edit agreement drafts','Edit draft wording, clauses and parties.','tenant','agreements',0,1,'Edit draft wording, clauses and parties.',1),
    ('agreements.issue','agreements.issue','Approve and issue agreements','Approve and issue locked agreement versions.','tenant','agreements',1,1,'Approve and issue locked agreement versions.',1),
    ('agreements.deliver','agreements.deliver','Record agreement delivery','Download and record external delivery of issued agreements.','tenant','agreements',0,1,'Download and record external delivery of issued agreements.',1),
    ('agreements.revise','agreements.revise','Create agreement revisions','Create a new draft revision from an issued agreement.','tenant','agreements',0,1,'Create a new draft revision from an issued agreement.',1),
    ('agreements.archive','agreements.archive','Archive agreements','Archive agreement records.','tenant','agreements',1,1,'Archive agreement records.',1),
    ('agreements.configure','agreements.configure','Configure agreements','Manage agreement clauses, templates and merge fields.','tenant','agreements',1,1,'Manage agreement clauses, templates and merge fields.',1),
    ('documents.view','documents.view','View documents','View documents for accessible workflows.','tenant','documents',0,1,'View documents for accessible workflows.',1),
    ('contacts.view','contacts.view','View contacts','View tenant contacts.','tenant','contacts',0,1,'View tenant contacts.',1),
    ('finance.view','finance.view','View finance','View financial details.','tenant','finance',1,1,'View financial details.',1),
    ('finance.edit','finance.edit','Edit finance','Edit financial details.','tenant','finance',1,1,'Edit financial details.',1),
    ('finance.approve','finance.approve','Approve expenditure','Approve expenditure and financial commitments.','tenant','finance',1,1,'Approve expenditure and financial commitments.',1),
    ('finance.invoices.raise','finance.invoices.raise','Raise invoices','Create and issue invoices.','tenant','finance',1,1,'Create and issue invoices.',1),
    ('finance.payments.record','finance.payments.record','Record payments','Record incoming and outgoing payments.','tenant','finance',1,1,'Record incoming and outgoing payments.',1),
    ('finance.settlements.manage','finance.settlements.manage','Manage settlements','Prepare and approve settlements.','tenant','finance',1,1,'Prepare and approve settlements.',1),
    ('teams.view','teams.view','View teams','View tenant teams and membership.','tenant','teams',0,1,'View tenant teams and membership.',1),
    ('teams.manage','teams.manage','Manage teams','Create and edit teams and membership.','tenant','teams',1,1,'Create and edit teams and membership.',1),
    ('notifications.view','notifications.view','View notifications','View personal notifications.','own_record','notifications',0,1,'View personal notifications.',1),
    ('notifications.send','notifications.send','Send notifications','Send manual in-app notifications.','tenant','notifications',0,1,'Send manual in-app notifications.',1),
    ('notifications.configure','notifications.configure','Configure notifications','Manage tenant notification rules.','tenant','notifications',1,1,'Manage tenant notification rules.',1),
    ('configuration.view','configuration.view','View configuration','View tenant configuration.','tenant','configuration',0,1,'View tenant configuration.',1),
    ('configuration.manage','configuration.manage','Manage configuration','Change operational tenant configuration.','tenant','configuration',1,1,'Change operational tenant configuration.',1)
ON DUPLICATE KEY UPDATE
    permissionName=VALUES(permissionName),
    permissionDescription=VALUES(permissionDescription),
    permissionScope=VALUES(permissionScope),
    permissionGroup=VALUES(permissionGroup),
    description=VALUES(description),
    isActive=1;

UPDATE tbl_roles
SET roleName='Finance Officer',
    roleDescription='Manages permitted financial records, invoices, payments and reporting.',
    description='Manages permitted financial records, invoices, payments and reporting.',
    modifiedDate=CURRENT_TIMESTAMP
WHERE tenantId IS NULL AND roleKey='finance';

INSERT INTO tbl_roles
    (tenantId, roleCode, roleKey, roleName, roleDescription, description, isSystemRole, isProtected, isOwnerRole, isAssignable, isActive)
VALUES
    (NULL,'DEPARTMENT_HEAD','department_head','Department Head','Leads an operational area and manages its workflows, tasks, people and documents.','Leads an operational area and manages its workflows, tasks, people and documents.',1,1,0,1,1),
    (NULL,'TEAM_MANAGER','team_manager','Team Manager','Coordinates team workloads and allocates tasks without tenant administration access.','Coordinates team workloads and allocates tasks without tenant administration access.',1,1,0,1,1),
    (NULL,'AGREEMENTS_MANAGER','agreements_manager','Agreements Manager','Creates, edits, revises and administers agreement drafts.','Creates, edits, revises and administers agreement drafts.',1,1,0,1,1),
    (NULL,'AGREEMENTS_APPROVER','agreements_approver','Agreements Approver','Reviews and issues agreements independently of draft preparation.','Reviews and issues agreements independently of draft preparation.',1,1,0,1,1)
ON DUPLICATE KEY UPDATE
    roleName=VALUES(roleName),
    roleDescription=VALUES(roleDescription),
    description=VALUES(description),
    isProtected=1,
    isAssignable=1,
    isActive=1;

-- Owner receives every active tenant permission. Admin excludes ownership and destructive tenant controls.
INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r
INNER JOIN tbl_permissions p ON p.isActive=1 AND p.permissionScope IN ('tenant','team','assigned_record','own_record')
WHERE r.roleKey='owner';

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r
INNER JOIN tbl_permissions p ON p.isActive=1 AND p.permissionScope IN ('tenant','team','assigned_record','own_record')
WHERE r.roleKey='admin'
  AND p.permissionCode NOT IN ('tenant.owner.assign','tenant.owner.transfer','tenant.delete');

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r INNER JOIN tbl_permissions p
ON p.permissionCode IN (
 'workflows.view','workflows.create','workflows.edit','workflows.status.manage','workflows.archive',
 'tasks.view.own','tasks.view.team','tasks.create','tasks.edit','tasks.allocate','tasks.complete','tasks.reopen',
 'agreements.view','agreements.drafts.create','agreements.drafts.edit','agreements.deliver','agreements.revise','agreements.archive','agreements.configure',
 'documents.view','documents.manage','contacts.view','contacts.manage','teams.view','teams.manage',
 'reports.view','notifications.view','notifications.send','configuration.view','configuration.manage'
) WHERE r.roleKey='department_head';

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r INNER JOIN tbl_permissions p
ON p.permissionCode IN (
 'workflows.view','workflows.edit','workflows.status.manage',
 'tasks.view.own','tasks.view.team','tasks.create','tasks.edit','tasks.allocate','tasks.complete','tasks.reopen',
 'documents.view','contacts.view','teams.view','notifications.view','notifications.send'
) WHERE r.roleKey='team_manager';

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r INNER JOIN tbl_permissions p
ON p.permissionCode IN (
 'workflows.view','workflows.create','workflows.edit','workflows.status.manage','workflows.archive',
 'tasks.view.own','tasks.view.team','tasks.create','tasks.edit','tasks.allocate','tasks.complete','tasks.reopen',
 'workflows.view','agreements.view','agreements.drafts.create','agreements.drafts.edit',
 'agreements.deliver','agreements.revise','agreements.archive',
 'documents.view','documents.manage','contacts.view','notifications.view'
) WHERE r.roleKey IN ('agreements_manager','editor');

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r INNER JOIN tbl_permissions p
ON p.permissionCode IN (
 'workflows.view','workflows.edit','workflows.status.manage',
 'tasks.view.own','tasks.view.team','tasks.create','tasks.edit','tasks.allocate','tasks.complete','tasks.reopen',
 'documents.view','documents.manage','contacts.view','teams.view','notifications.view'
) WHERE r.roleKey='operations';

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r INNER JOIN tbl_permissions p
ON p.permissionCode IN ('workflows.view','agreements.view','agreements.issue','agreements.deliver','documents.view','contacts.view','notifications.view')
WHERE r.roleKey='agreements_approver';

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r INNER JOIN tbl_permissions p
ON p.permissionCode IN (
 'workflows.view','agreements.view','documents.view','finance.view','finance.edit','finance.approve',
 'finance.invoices.raise','finance.payments.record','finance.settlements.manage','reports.view','notifications.view'
) WHERE r.roleKey='finance';

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r INNER JOIN tbl_permissions p
ON p.permissionCode IN ('workflows.view','tasks.view.own','agreements.view','documents.view','contacts.view','notifications.view')
WHERE r.roleKey='viewer';
