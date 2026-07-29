-- Tastrack roles and permissions phase 2.
-- This migration is intentionally backward-compatible with the existing Wappler
-- Security Provider and legacy single-role team forms. New actions should use
-- tbl_user_tenants and the many-to-many role mappings introduced below.

CREATE TABLE IF NOT EXISTS tbl_user_tenants (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    userId INT UNSIGNED NOT NULL,
    membershipStatus ENUM('invited','active','suspended','left','cancelled') NOT NULL DEFAULT 'active',
    isActive TINYINT(1) NOT NULL DEFAULT 1,
    invitedByUserId INT UNSIGNED NULL,
    invitedDate DATETIME NULL,
    acceptedDate DATETIME NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_tenants_tenant_user (tenantId,userId),
    KEY idx_user_tenants_user (userId),
    KEY idx_user_tenants_status (tenantId,membershipStatus,isActive),
    CONSTRAINT fk_user_tenants_tenant FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_tenants_user FOREIGN KEY (userId) REFERENCES tbl_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_tenants_inviter FOREIGN KEY (invitedByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tbl_user_tenants
    (tenantId,userId,membershipStatus,isActive,acceptedDate,createdDate)
SELECT utr.tenantId,utr.userId,
       CASE WHEN MAX(utr.isActive)=1 THEN 'active' ELSE 'suspended' END,
       MAX(utr.isActive),
       MIN(utr.createdDate),
       MIN(utr.createdDate)
FROM tbl_user_tenant_roles utr
GROUP BY utr.tenantId,utr.userId
ON DUPLICATE KEY UPDATE
    membershipStatus=VALUES(membershipStatus),
    isActive=VALUES(isActive);

ALTER TABLE tbl_roles
    ADD COLUMN IF NOT EXISTS tenantId INT UNSIGNED NULL AFTER id,
    ADD COLUMN IF NOT EXISTS roleCode VARCHAR(80) NULL AFTER tenantId,
    ADD COLUMN IF NOT EXISTS roleDescription TEXT NULL AFTER roleName,
    ADD COLUMN IF NOT EXISTS isProtected TINYINT(1) NOT NULL DEFAULT 0 AFTER isSystemRole,
    ADD COLUMN IF NOT EXISTS isOwnerRole TINYINT(1) NOT NULL DEFAULT 0 AFTER isProtected,
    ADD COLUMN IF NOT EXISTS isAssignable TINYINT(1) NOT NULL DEFAULT 1 AFTER isOwnerRole,
    ADD COLUMN IF NOT EXISTS createdByUserId INT UNSIGNED NULL AFTER isActive;

UPDATE tbl_roles
SET roleCode=COALESCE(NULLIF(roleCode,''),roleKey),
    roleDescription=COALESCE(roleDescription,description),
    isProtected=CASE WHEN isSystemRole=1 THEN 1 ELSE isProtected END,
    isOwnerRole=CASE WHEN roleKey='owner' THEN 1 ELSE isOwnerRole END,
    isAssignable=CASE WHEN roleKey='owner' THEN 0 ELSE isAssignable END;

ALTER TABLE tbl_permissions
    ADD COLUMN IF NOT EXISTS permissionCode VARCHAR(160) NULL AFTER id,
    ADD COLUMN IF NOT EXISTS permissionDescription TEXT NULL AFTER permissionName,
    ADD COLUMN IF NOT EXISTS permissionScope ENUM('platform','tenant','team','assigned_record','own_record') NOT NULL DEFAULT 'tenant' AFTER permissionDescription,
    ADD COLUMN IF NOT EXISTS permissionGroup VARCHAR(80) NULL AFTER permissionScope,
    ADD COLUMN IF NOT EXISTS isSensitive TINYINT(1) NOT NULL DEFAULT 0 AFTER permissionGroup,
    ADD COLUMN IF NOT EXISTS isAssignable TINYINT(1) NOT NULL DEFAULT 1 AFTER isSensitive;

UPDATE tbl_permissions
SET permissionCode=COALESCE(NULLIF(permissionCode,''),permissionKey),
    permissionDescription=COALESCE(permissionDescription,description),
    permissionScope=CASE WHEN permissionKey LIKE 'team.%' THEN 'team' ELSE permissionScope END;

INSERT INTO tbl_permissions
    (permissionKey,permissionCode,permissionName,description,permissionDescription,permissionScope,permissionGroup,isSensitive,isAssignable,isActive)
VALUES
('tenant.users.view','tenant.users.view','View tenant users','View users belonging to the tenant.','View users belonging to the tenant.','tenant','users',0,1,1),
('tenant.users.create','tenant.users.create','Create tenant users','Create users within the tenant.','Create users within the tenant.','tenant','users',1,1,1),
('tenant.users.invite','tenant.users.invite','Invite tenant users','Invite users into the tenant.','Invite users into the tenant.','tenant','users',1,1,1),
('tenant.users.edit','tenant.users.edit','Edit tenant users','Edit tenant user details.','Edit tenant user details.','tenant','users',1,1,1),
('tenant.users.suspend','tenant.users.suspend','Suspend tenant users','Suspend tenant membership.','Suspend tenant membership.','tenant','users',1,1,1),
('tenant.users.reactivate','tenant.users.reactivate','Reactivate tenant users','Reactivate tenant membership.','Reactivate tenant membership.','tenant','users',1,1,1),
('tenant.users.roles.assign','tenant.users.roles.assign','Assign tenant roles','Assign permitted tenant roles.','Assign permitted tenant roles.','tenant','users',1,1,1),
('tenant.roles.view','tenant.roles.view','View tenant roles','View tenant role definitions.','View tenant role definitions.','tenant','roles',0,1,1),
('tenant.roles.create','tenant.roles.create','Create tenant roles','Create assignable tenant roles.','Create assignable tenant roles.','tenant','roles',1,1,1),
('tenant.roles.edit','tenant.roles.edit','Edit tenant roles','Edit non-protected tenant roles.','Edit non-protected tenant roles.','tenant','roles',1,1,1),
('tenant.roles.archive','tenant.roles.archive','Archive tenant roles','Archive non-protected tenant roles.','Archive non-protected tenant roles.','tenant','roles',1,1,1),
('tenant.roles.permissions.manage','tenant.roles.permissions.manage','Manage tenant role permissions','Change permissions on tenant roles.','Change permissions on tenant roles.','tenant','roles',1,1,1),
('tenant.teams.view','tenant.teams.view','View teams','View tenant teams.','View tenant teams.','tenant','teams',0,1,1),
('tenant.teams.create','tenant.teams.create','Create teams','Create tenant teams.','Create tenant teams.','tenant','teams',0,1,1),
('tenant.teams.edit','tenant.teams.edit','Edit teams','Edit tenant teams.','Edit tenant teams.','tenant','teams',0,1,1),
('tenant.teams.archive','tenant.teams.archive','Archive teams','Archive tenant teams.','Archive tenant teams.','tenant','teams',0,1,1),
('tenant.teams.members.manage','tenant.teams.members.manage','Manage team members','Manage membership of tenant teams.','Manage membership of tenant teams.','tenant','teams',1,1,1),
('tenant.teams.roles.manage','tenant.teams.roles.manage','Manage team roles','Manage roles belonging to tenant teams.','Manage roles belonging to tenant teams.','tenant','teams',1,1,1),
('tenant.processes.view','tenant.processes.view','View processes','View tenant workflow templates.','View tenant workflow templates.','tenant','processes',0,1,1),
('tenant.processes.create','tenant.processes.create','Create processes','Create tenant workflow templates.','Create tenant workflow templates.','tenant','processes',0,1,1),
('tenant.processes.edit','tenant.processes.edit','Edit processes','Edit tenant workflow templates.','Edit tenant workflow templates.','tenant','processes',0,1,1),
('tenant.processes.publish','tenant.processes.publish','Publish processes','Publish tenant workflow templates.','Publish tenant workflow templates.','tenant','processes',1,1,1),
('tenant.processes.archive','tenant.processes.archive','Archive processes','Archive tenant workflow templates.','Archive tenant workflow templates.','tenant','processes',1,1,1),
('tenant.categories.manage','tenant.categories.manage','Manage categories','Manage tenant categories.','Manage tenant categories.','tenant','categories',0,1,1),
('tenant.terminology.view','tenant.terminology.view','View terminology','View tenant terminology.','View tenant terminology.','tenant','terminology',0,1,1),
('tenant.terminology.manage','tenant.terminology.manage','Manage terminology','Change tenant terminology.','Change tenant terminology.','tenant','terminology',1,1,1),
('tenant.billing.view','tenant.billing.view','View billing','View tenant billing information.','View tenant billing information.','tenant','billing',1,1,1),
('tenant.billing.manage','tenant.billing.manage','Manage billing','Manage tenant billing.','Manage tenant billing.','tenant','billing',1,1,1),
('tenant.subscription.manage','tenant.subscription.manage','Manage subscription','Manage tenant subscription.','Manage tenant subscription.','tenant','billing',1,1,1),
('tenant.modules.view','tenant.modules.view','View modules','View enabled tenant modules.','View enabled tenant modules.','tenant','modules',0,1,1),
('tenant.modules.manage','tenant.modules.manage','Manage modules','Manage tenant modules.','Manage tenant modules.','tenant','modules',1,1,1),
('tenant.security.view','tenant.security.view','View security','View tenant security settings.','View tenant security settings.','tenant','security',1,1,1),
('tenant.security.manage','tenant.security.manage','Manage security','Manage tenant security settings.','Manage tenant security settings.','tenant','security',1,1,1),
('tenant.audit.view','tenant.audit.view','View audit log','View tenant audit records.','View tenant audit records.','tenant','security',1,1,1),
('tenant.owner.assign','tenant.owner.assign','Assign tenant owner','Assign an additional tenant owner.','Assign an additional tenant owner.','tenant','ownership',1,0,1),
('tenant.owner.transfer','tenant.owner.transfer','Transfer tenant ownership','Transfer tenant ownership.','Transfer tenant ownership.','tenant','ownership',1,0,1),
('tenant.delete','tenant.delete','Delete tenant','Delete the tenant.','Delete the tenant.','tenant','ownership',1,0,1),
('team.settings.view','team.settings.view','View team settings','View settings for an authorised team.','View settings for an authorised team.','team','team_admin',0,1,1),
('team.settings.manage','team.settings.manage','Manage team settings','Manage settings for an authorised team.','Manage settings for an authorised team.','team','team_admin',0,1,1),
('team.members.view','team.members.view','View team members','View members of an authorised team.','View members of an authorised team.','team','team_admin',0,1,1),
('team.members.manage','team.members.manage','Manage team members','Manage members of an authorised team.','Manage members of an authorised team.','team','team_admin',1,1,1),
('team.roles.assign','team.roles.assign','Assign team roles','Assign permitted roles in an authorised team.','Assign permitted roles in an authorised team.','team','team_admin',1,1,1),
('team.processes.view','team.processes.view','View team processes','View processes owned by an authorised team.','View processes owned by an authorised team.','team','processes',0,1,1),
('team.processes.create','team.processes.create','Create team processes','Create processes for an authorised team.','Create processes for an authorised team.','team','processes',0,1,1),
('team.processes.edit','team.processes.edit','Edit team processes','Edit processes for an authorised team.','Edit processes for an authorised team.','team','processes',0,1,1),
('team.processes.publish','team.processes.publish','Publish team processes','Publish processes for an authorised team.','Publish processes for an authorised team.','team','processes',1,1,1),
('team.processes.archive','team.processes.archive','Archive team processes','Archive processes for an authorised team.','Archive processes for an authorised team.','team','processes',1,1,1),
('team.categories.view','team.categories.view','View team categories','View categories for an authorised team.','View categories for an authorised team.','team','categories',0,1,1),
('team.categories.create','team.categories.create','Create team categories','Create categories for an authorised team.','Create categories for an authorised team.','team','categories',0,1,1),
('team.categories.edit','team.categories.edit','Edit team categories','Edit categories for an authorised team.','Edit categories for an authorised team.','team','categories',0,1,1),
('team.categories.archive','team.categories.archive','Archive team categories','Archive categories for an authorised team.','Archive categories for an authorised team.','team','categories',0,1,1),
('team.tasks.view','team.tasks.view','View team tasks','View tasks belonging to an authorised team.','View tasks belonging to an authorised team.','team','tasks',0,1,1),
('team.tasks.create','team.tasks.create','Create team tasks','Create tasks for an authorised team.','Create tasks for an authorised team.','team','tasks',0,1,1),
('team.tasks.assign','team.tasks.assign','Assign team tasks','Assign tasks for an authorised team.','Assign tasks for an authorised team.','team','tasks',0,1,1),
('team.tasks.update','team.tasks.update','Update team tasks','Update tasks for an authorised team.','Update tasks for an authorised team.','team','tasks',0,1,1),
('team.tasks.complete','team.tasks.complete','Complete team tasks','Complete allocated team tasks.','Complete allocated team tasks.','team','tasks',0,1,1),
('team.tasks.archive','team.tasks.archive','Archive team tasks','Archive tasks for an authorised team.','Archive tasks for an authorised team.','team','tasks',1,1,1),
('team.documents.view','team.documents.view','View team documents','View documents for an authorised team.','View documents for an authorised team.','team','documents',0,1,1),
('team.documents.upload','team.documents.upload','Upload team documents','Upload documents for an authorised team.','Upload documents for an authorised team.','team','documents',0,1,1),
('team.documents.edit','team.documents.edit','Edit team documents','Edit documents for an authorised team.','Edit documents for an authorised team.','team','documents',0,1,1),
('team.documents.archive','team.documents.archive','Archive team documents','Archive documents for an authorised team.','Archive documents for an authorised team.','team','documents',1,1,1),
('team.documents.manage','team.documents.manage','Manage team documents','Manage documents for an authorised team.','Manage documents for an authorised team.','team','documents',0,1,1),
('team.contracts.view','team.contracts.view','View team contracts','View contracts for an authorised team.','View contracts for an authorised team.','team','contracts',0,1,1),
('team.contracts.create','team.contracts.create','Create team contracts','Create contracts for an authorised team.','Create contracts for an authorised team.','team','contracts',0,1,1),
('team.contracts.edit','team.contracts.edit','Edit team contracts','Edit draft contracts for an authorised team.','Edit draft contracts for an authorised team.','team','contracts',0,1,1),
('team.contracts.approve','team.contracts.approve','Approve team contracts','Approve contracts for an authorised team.','Approve contracts for an authorised team.','team','contracts',1,1,1),
('team.contracts.manage','team.contracts.manage','Manage team contracts','Manage contracts for an authorised team.','Manage contracts for an authorised team.','team','contracts',0,1,1)
ON DUPLICATE KEY UPDATE
    permissionCode=VALUES(permissionCode),
    permissionName=VALUES(permissionName),
    permissionDescription=VALUES(permissionDescription),
    permissionScope=VALUES(permissionScope),
    permissionGroup=VALUES(permissionGroup),
    isSensitive=VALUES(isSensitive),
    isAssignable=VALUES(isAssignable),
    isActive=VALUES(isActive);

ALTER TABLE tbl_team_roles
    ADD COLUMN IF NOT EXISTS teamRoleCode VARCHAR(100) NULL AFTER teamId,
    ADD COLUMN IF NOT EXISTS teamRoleName VARCHAR(120) NULL AFTER teamRoleCode,
    ADD COLUMN IF NOT EXISTS teamRoleDescription TEXT NULL AFTER teamRoleName,
    ADD COLUMN IF NOT EXISTS isProtected TINYINT(1) NOT NULL DEFAULT 0 AFTER teamRoleDescription,
    ADD COLUMN IF NOT EXISTS isAssignable TINYINT(1) NOT NULL DEFAULT 1 AFTER isProtected,
    ADD COLUMN IF NOT EXISTS createdByUserId INT UNSIGNED NULL AFTER isActive,
    ADD COLUMN IF NOT EXISTS createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER createdByUserId,
    ADD COLUMN IF NOT EXISTS modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER createdDate;

UPDATE tbl_team_roles
SET teamRoleCode=COALESCE(NULLIF(teamRoleCode,''),CONCAT('legacy_',id)),
    teamRoleName=COALESCE(NULLIF(teamRoleName,''),roleDesc,'Team role'),
    teamRoleDescription=COALESCE(teamRoleDescription,roleDesc);

INSERT INTO tbl_team_roles
    (tenantId,teamId,teamRoleCode,teamRoleName,teamRoleDescription,roleDesc,isProtected,isAssignable,isActive,status)
SELECT t.tenantId,t.id,defaults.roleCode,defaults.roleName,defaults.roleDescription,defaults.roleName,1,1,1,'active'
FROM tbl_teams t
CROSS JOIN (
    SELECT 'team_manager' roleCode,'Team Manager' roleName,'Manages team membership, roles, processes, tasks and documents.' roleDescription
    UNION ALL SELECT 'process_designer','Process Designer','Creates and edits team processes without automatic publication authority.'
    UNION ALL SELECT 'task_coordinator','Task Coordinator','Creates, assigns and updates team tasks.'
    UNION ALL SELECT 'document_manager','Document Manager','Uploads and manages team documents.'
    UNION ALL SELECT 'contract_manager','Contract Manager','Creates and manages team contract drafts.'
    UNION ALL SELECT 'team_member','Team Member','Updates allocated work and completes assigned tasks.'
    UNION ALL SELECT 'team_viewer','Team Viewer','Read-only access to permitted team records.'
) defaults
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_team_roles existing
    WHERE existing.tenantId=t.tenantId AND existing.teamId=t.id AND existing.teamRoleCode=defaults.roleCode
);

CREATE TABLE IF NOT EXISTS tbl_team_member_roles (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    teamMemberId INT UNSIGNED NOT NULL,
    teamRoleId INT UNSIGNED NOT NULL,
    assignedByUserId INT UNSIGNED NULL,
    assignedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    isActive TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_team_member_roles_member_role (teamMemberId,teamRoleId),
    KEY idx_team_member_roles_role (teamRoleId),
    CONSTRAINT fk_team_member_roles_member FOREIGN KEY (teamMemberId) REFERENCES tbl_team_members(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_member_roles_role FOREIGN KEY (teamRoleId) REFERENCES tbl_team_roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_member_roles_assigner FOREIGN KEY (assignedByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tbl_team_member_roles (teamMemberId,teamRoleId,assignedDate,isActive)
SELECT tm.id,tm.teamRole,tm.createdDate,tm.isActive
FROM tbl_team_members tm
WHERE tm.teamRole IS NOT NULL
ON DUPLICATE KEY UPDATE isActive=VALUES(isActive);

ALTER TABLE tbl_team_members
    ADD COLUMN IF NOT EXISTS userTenantId INT UNSIGNED NULL AFTER tenantId;

UPDATE tbl_team_members tm
INNER JOIN tbl_user_tenant_roles utr ON utr.id=tm.tenantUserId AND utr.tenantId=tm.tenantId
INNER JOIN tbl_user_tenants ut ON ut.tenantId=utr.tenantId AND ut.userId=utr.userId
SET tm.userTenantId=ut.id
WHERE tm.userTenantId IS NULL;

CREATE TABLE IF NOT EXISTS tbl_team_role_permissions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    teamRoleId INT UNSIGNED NOT NULL,
    permissionId INT UNSIGNED NOT NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_team_role_permissions_role_permission (teamRoleId,permissionId),
    KEY idx_team_role_permissions_permission (permissionId),
    CONSTRAINT fk_team_role_permissions_role FOREIGN KEY (teamRoleId) REFERENCES tbl_team_roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_role_permissions_permission FOREIGN KEY (permissionId) REFERENCES tbl_permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tbl_team_role_permissions (teamRoleId,permissionId)
SELECT tr.id,p.id
FROM tbl_team_roles tr
INNER JOIN tbl_permissions p ON p.permissionScope='team' AND p.isActive=1
WHERE tr.teamRoleCode='team_manager';

INSERT IGNORE INTO tbl_team_role_permissions (teamRoleId,permissionId)
SELECT tr.id,p.id FROM tbl_team_roles tr INNER JOIN tbl_permissions p
ON p.permissionCode IN ('team.processes.view','team.processes.create','team.processes.edit','team.categories.view','team.categories.create','team.categories.edit')
WHERE tr.teamRoleCode='process_designer';

INSERT IGNORE INTO tbl_team_role_permissions (teamRoleId,permissionId)
SELECT tr.id,p.id FROM tbl_team_roles tr INNER JOIN tbl_permissions p
ON p.permissionCode IN ('team.tasks.view','team.tasks.create','team.tasks.assign','team.tasks.update','team.tasks.complete')
WHERE tr.teamRoleCode='task_coordinator';

INSERT IGNORE INTO tbl_team_role_permissions (teamRoleId,permissionId)
SELECT tr.id,p.id FROM tbl_team_roles tr INNER JOIN tbl_permissions p
ON p.permissionCode IN ('team.documents.view','team.documents.upload','team.documents.edit','team.documents.archive','team.documents.manage')
WHERE tr.teamRoleCode='document_manager';

INSERT IGNORE INTO tbl_team_role_permissions (teamRoleId,permissionId)
SELECT tr.id,p.id FROM tbl_team_roles tr INNER JOIN tbl_permissions p
ON p.permissionCode IN ('team.contracts.view','team.contracts.create','team.contracts.edit','team.contracts.manage')
WHERE tr.teamRoleCode='contract_manager';

INSERT IGNORE INTO tbl_team_role_permissions (teamRoleId,permissionId)
SELECT tr.id,p.id FROM tbl_team_roles tr INNER JOIN tbl_permissions p
ON p.permissionCode IN ('team.settings.view','team.members.view','team.processes.view','team.categories.view','team.tasks.view','team.tasks.update','team.tasks.complete','team.documents.view','team.documents.upload','team.contracts.view')
WHERE tr.teamRoleCode='team_member';

INSERT IGNORE INTO tbl_team_role_permissions (teamRoleId,permissionId)
SELECT tr.id,p.id FROM tbl_team_roles tr INNER JOIN tbl_permissions p
ON p.permissionCode IN ('team.settings.view','team.members.view','team.processes.view','team.categories.view','team.tasks.view','team.documents.view','team.contracts.view')
WHERE tr.teamRoleCode='team_viewer';

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id
FROM tbl_roles r
INNER JOIN tbl_permissions p ON p.permissionScope='tenant' AND p.isActive=1
WHERE r.roleKey='owner';

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id
FROM tbl_roles r
INNER JOIN tbl_permissions p ON p.permissionScope='tenant' AND p.isActive=1
WHERE r.roleKey='admin'
  AND p.permissionCode NOT IN ('tenant.owner.assign','tenant.owner.transfer','tenant.delete');

ALTER TABLE tbl_activity_log
    ADD COLUMN IF NOT EXISTS teamId INT UNSIGNED NULL AFTER tenantId,
    ADD COLUMN IF NOT EXISTS targetUserId INT UNSIGNED NULL AFTER entityId;
