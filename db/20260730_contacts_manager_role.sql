USE `task_tracker`;

INSERT INTO tbl_roles
    (tenantId, roleCode, roleKey, roleName, roleDescription, description, isSystemRole, isProtected, isOwnerRole, isAssignable, isActive)
VALUES
    (NULL, 'CONTACTS_MANAGER', 'contacts_manager', 'Contacts Manager',
     'Creates and maintains contacts for the organisation.',
     'Creates and maintains contacts for the organisation.',
     1, 1, 0, 1, 1)
ON DUPLICATE KEY UPDATE
    roleName = VALUES(roleName),
    roleDescription = VALUES(roleDescription),
    description = VALUES(description),
    isAssignable = 1,
    isActive = 1;

INSERT IGNORE INTO tbl_role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM tbl_roles r
INNER JOIN tbl_permissions p
    ON p.permissionCode IN ('contacts.view', 'contacts.manage')
   AND p.isActive = 1
WHERE r.tenantId IS NULL
  AND r.roleKey = 'contacts_manager';

INSERT IGNORE INTO tbl_role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM tbl_roles r
INNER JOIN tbl_permissions p
    ON p.permissionCode IN ('contacts.view', 'contacts.manage')
   AND p.isActive = 1
WHERE r.roleKey IN ('owner', 'admin');
