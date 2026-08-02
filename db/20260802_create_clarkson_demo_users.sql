USE `task_tracker`;

START TRANSACTION;

SET @tenantId = 6;
SET @actorUserId = 1;

CREATE TEMPORARY TABLE tmp_demo_users (
  email VARCHAR(255) PRIMARY KEY,
  firstName VARCHAR(100) NOT NULL,
  lastName VARCHAR(100) NOT NULL,
  teamId INT UNSIGNED NOT NULL,
  tenantRoleKey VARCHAR(100) NOT NULL,
  teamRoleCode VARCHAR(100) NOT NULL
);

INSERT INTO tmp_demo_users (email,firstName,lastName,teamId,tenantRoleKey,teamRoleCode) VALUES
  ('amelia.archer@clarkson.test','Amelia','Archer',15,'admin','team_manager'),
  ('noah.north@clarkson.test','Noah','North',15,'operations','document_manager'),
  ('freya.frost@clarkson.test','Freya','Frost',14,'finance','team_manager'),
  ('aaron.avery@clarkson.test','Aaron','Avery',14,'agreements_approver','contract_manager'),
  ('dahlia.drake@clarkson.test','Dahlia','Drake',16,'department_head','team_manager'),
  ('elliot.east@clarkson.test','Elliot','East',16,'editor','process_designer'),
  ('cora.cole@clarkson.test','Cora','Cole',16,'contacts_manager','team_member'),
  ('theo.turner@clarkson.test','Theo','Turner',13,'team_manager','team_leader'),
  ('maya.moore@clarkson.test','Maya','Moore',13,'agreements_manager','contract_manager'),
  ('victor.vale@clarkson.test','Victor','Vale',13,'viewer','team_viewer');

INSERT INTO tbl_users (email,fName,lName,displayName,passwordHash,isActive,isPlatformAdmin,verifycode)
SELECT d.email,d.firstName,d.lastName,CONCAT(d.firstName,' ',d.lastName),NULL,1,0,UUID()
FROM tmp_demo_users d
ON DUPLICATE KEY UPDATE
  fName=VALUES(fName),lName=VALUES(lName),displayName=VALUES(displayName),isActive=1;

INSERT INTO tbl_user_tenants
  (tenantId,userId,membershipStatus,isActive,invitedByUserId,invitedDate)
SELECT @tenantId,u.id,'invited',1,@actorUserId,CURRENT_TIMESTAMP
FROM tmp_demo_users d
INNER JOIN tbl_users u ON u.email=d.email
WHERE NOT EXISTS (
  SELECT 1 FROM tbl_user_tenants existing
  WHERE existing.tenantId=@tenantId AND existing.userId=u.id
);

UPDATE tbl_user_tenants ut
INNER JOIN tbl_users u ON u.id=ut.userId
INNER JOIN tmp_demo_users d ON d.email=u.email
SET ut.membershipStatus='invited',ut.isActive=1,
    ut.invitedByUserId=COALESCE(ut.invitedByUserId,@actorUserId),
    ut.invitedDate=COALESCE(ut.invitedDate,CURRENT_TIMESTAMP)
WHERE ut.tenantId=@tenantId;

UPDATE tbl_user_tenant_roles utr
INNER JOIN tbl_users u ON u.id=utr.userId
INNER JOIN tmp_demo_users d ON d.email=u.email
SET utr.isPrimary=0
WHERE utr.tenantId=@tenantId;

INSERT INTO tbl_user_tenant_roles (userId,tenantId,roleId,isPrimary,isActive)
SELECT u.id,@tenantId,r.id,1,1
FROM tmp_demo_users d
INNER JOIN tbl_users u ON u.email=d.email
INNER JOIN tbl_roles r ON r.roleKey=d.tenantRoleKey AND r.tenantId IS NULL AND r.isActive=1
ON DUPLICATE KEY UPDATE isPrimary=1,isActive=1;

INSERT INTO tbl_team_members
  (tenantId,userTenantId,tenantUserId,teamId,teamRole,isPrimary,isActive)
SELECT @tenantId,ut.id,utr.id,d.teamId,tr.id,1,1
FROM tmp_demo_users d
INNER JOIN tbl_users u ON u.email=d.email
INNER JOIN tbl_user_tenants ut ON ut.userId=u.id AND ut.tenantId=@tenantId
INNER JOIN tbl_user_tenant_roles utr ON utr.userId=u.id AND utr.tenantId=@tenantId AND utr.isPrimary=1 AND utr.isActive=1
INNER JOIN tbl_team_roles tr ON tr.tenantId=@tenantId AND tr.teamId=d.teamId AND tr.teamRoleCode=d.teamRoleCode AND tr.isActive=1
ON DUPLICATE KEY UPDATE
  userTenantId=VALUES(userTenantId),tenantUserId=VALUES(tenantUserId),
  teamRole=VALUES(teamRole),isPrimary=1,isActive=1;

INSERT INTO tbl_team_member_roles
  (teamMemberId,teamRoleId,assignedByUserId,assignedDate,isActive)
SELECT tm.id,tr.id,@actorUserId,CURRENT_TIMESTAMP,1
FROM tmp_demo_users d
INNER JOIN tbl_users u ON u.email=d.email
INNER JOIN tbl_user_tenants ut ON ut.userId=u.id AND ut.tenantId=@tenantId
INNER JOIN tbl_team_members tm ON tm.tenantId=@tenantId AND tm.userTenantId=ut.id AND tm.teamId=d.teamId
INNER JOIN tbl_team_roles tr ON tr.tenantId=@tenantId AND tr.teamId=d.teamId AND tr.teamRoleCode=d.teamRoleCode AND tr.isActive=1
ON DUPLICATE KEY UPDATE
  assignedByUserId=VALUES(assignedByUserId),assignedDate=CURRENT_TIMESTAMP,isActive=1;

INSERT INTO tbl_activity_log
  (tenantId,teamId,userId,targetUserId,entityType,entityId,actionType,summary,createdDate)
SELECT @tenantId,d.teamId,@actorUserId,u.id,'user',u.id,'user.invited',
       CONCAT('Created demo user ',u.displayName,' as ',r.roleName,' in ',t.teamName),CURRENT_TIMESTAMP
FROM tmp_demo_users d
INNER JOIN tbl_users u ON u.email=d.email
INNER JOIN tbl_roles r ON r.roleKey=d.tenantRoleKey AND r.tenantId IS NULL
INNER JOIN tbl_teams t ON t.id=d.teamId AND t.tenantId=@tenantId
WHERE NOT EXISTS (
  SELECT 1 FROM tbl_activity_log a
  WHERE a.tenantId=@tenantId AND a.targetUserId=u.id
    AND a.actionType='user.invited' AND a.summary LIKE 'Created demo user%'
);

DROP TEMPORARY TABLE tmp_demo_users;

COMMIT;
