-- Uniqueness rules for tenant and team role administration.
-- Existing global protected roles continue to use uq_tbl_roles_roleKey.

ALTER TABLE tbl_roles
    ADD UNIQUE INDEX IF NOT EXISTS uq_roles_tenant_code (tenantId,roleCode);

ALTER TABLE tbl_team_roles
    ADD UNIQUE INDEX IF NOT EXISTS uq_team_roles_team_code (tenantId,teamId,teamRoleCode);

ALTER TABLE tbl_permissions
    ADD UNIQUE INDEX IF NOT EXISTS uq_permissions_code (permissionCode);
