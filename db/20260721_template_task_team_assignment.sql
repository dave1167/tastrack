-- Template tasks are assigned to a tenant team or left unallocated.
-- Legacy workflow-owner/user/role defaults are retired.
UPDATE tbl_template_tasks
SET defaultOwnerType='unassigned', defaultOwnerId=NULL, modifiedDate=CURRENT_TIMESTAMP
WHERE defaultOwnerType<>'team'
   OR defaultOwnerId IS NULL
   OR NOT EXISTS (
       SELECT 1 FROM tbl_teams tm
       WHERE tm.id=tbl_template_tasks.defaultOwnerId
         AND tm.tenantId=tbl_template_tasks.tenantId
         AND tm.isActive=1
   );

-- Convert legacy live user assignments to the user's primary team where possible.
UPDATE tbl_tasks t
LEFT JOIN tbl_user_tenant_roles utr
  ON utr.userId=t.assignedToUserId AND utr.tenantId=t.tenantId AND utr.isActive=1
LEFT JOIN tbl_team_members tm
  ON tm.tenantUserId=utr.id AND tm.tenantId=t.tenantId AND tm.isPrimary=1 AND tm.isActive=1
SET t.assignedToTeamId=COALESCE(t.assignedToTeamId,tm.teamId),
    t.assignedToUserId=NULL,
    t.assignedToRoleId=NULL,
    t.modifiedDate=CURRENT_TIMESTAMP
WHERE t.assignedToUserId IS NOT NULL OR t.assignedToRoleId IS NOT NULL;
