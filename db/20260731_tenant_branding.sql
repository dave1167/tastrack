CREATE TABLE IF NOT EXISTS tbl_tenant_branding (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    primaryColour CHAR(7) NOT NULL DEFAULT '#18B99A',
    accentColour CHAR(7) NOT NULL DEFAULT '#00D7A3',
    headerColour CHAR(7) NOT NULL DEFAULT '#073F3C',
    sidebarColour CHAR(7) NOT NULL DEFAULT '#092F2D',
    logoPath VARCHAR(500) NULL,
    contractLogoPath VARCHAR(500) NULL,
    defaultColourMode ENUM('light','dark','system') NOT NULL DEFAULT 'light',
    customBrandingEnabled TINYINT(1) NOT NULL DEFAULT 1,
    rowVersion INT UNSIGNED NOT NULL DEFAULT 1,
    createdByUserId INT UNSIGNED NULL,
    modifiedByUserId INT UNSIGNED NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tenant_branding_tenant (tenantId),
    CONSTRAINT fk_tenant_branding_tenant
        FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE
);

INSERT INTO tbl_permissions
    (permissionCode, permissionKey, permissionName, permissionDescription, permissionScope, permissionGroup, isSensitive, isAssignable, description, isActive)
VALUES
    ('branding.manage', 'branding.manage', 'Manage branding', 'Change the organisation logo and application colours.', 'tenant', 'Configuration', 0, 1, 'Change tenant branding and appearance.', 1)
ON DUPLICATE KEY UPDATE
    permissionName = VALUES(permissionName),
    permissionDescription = VALUES(permissionDescription),
    permissionGroup = VALUES(permissionGroup),
    isActive = 1;

INSERT IGNORE INTO tbl_role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM tbl_roles r
INNER JOIN tbl_permissions p ON p.permissionCode = 'branding.manage'
WHERE r.roleKey IN ('owner', 'admin')
  AND r.isActive = 1;
