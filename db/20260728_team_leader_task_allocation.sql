-- Task allocation is a team-scoped responsibility.
-- Team Managers and Team Leaders may allocate; Task Coordinators may not.

INSERT INTO tbl_team_roles
    (tenantId,teamId,teamRoleCode,teamRoleName,teamRoleDescription,roleDesc,isProtected,isAssignable,isActive,status)
SELECT t.tenantId,t.id,'team_leader','Team Leader',
       'Leads day-to-day team work and may create, allocate and update team tasks.',
       'Team Leader',1,1,1,'active'
FROM tbl_teams t
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_team_roles tr
    WHERE tr.tenantId=t.tenantId
      AND tr.teamId=t.id
      AND tr.teamRoleCode='team_leader'
);

INSERT IGNORE INTO tbl_team_role_permissions (teamRoleId,permissionId)
SELECT tr.id,p.id
FROM tbl_team_roles tr
INNER JOIN tbl_permissions p
    ON p.permissionCode IN (
        'team.settings.view',
        'team.members.view',
        'team.tasks.view',
        'team.tasks.create',
        'team.tasks.assign',
        'team.tasks.update',
        'team.tasks.complete'
    )
WHERE tr.teamRoleCode='team_leader'
  AND NOT EXISTS (
      SELECT 1
      FROM tbl_team_role_permissions existing
      WHERE existing.teamRoleId=tr.id
        AND existing.permissionId=p.id
  );

DELETE trp
FROM tbl_team_role_permissions trp
INNER JOIN tbl_team_roles tr ON tr.id=trp.teamRoleId
INNER JOIN tbl_permissions p ON p.id=trp.permissionId
WHERE tr.teamRoleCode='task_coordinator'
  AND p.permissionCode='team.tasks.assign';
