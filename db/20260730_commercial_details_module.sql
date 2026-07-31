USE `task_tracker`;

INSERT INTO `tbl_modules`
(`moduleCode`,`moduleName`,`moduleDescription`,`moduleCategory`,`isCore`,`isBillable`,`isActive`,`currencyCode`,`displayOrder`)
VALUES
('COMMERCIAL_DETAILS','Commercial Details','Optional commercial information and reusable pricing entries for workflows.','CORE',0,0,1,'GBP',30)
ON DUPLICATE KEY UPDATE
`moduleName`=VALUES(`moduleName`),`moduleDescription`=VALUES(`moduleDescription`),
`moduleCategory`=VALUES(`moduleCategory`),`isBillable`=0,`isActive`=1,`displayOrder`=VALUES(`displayOrder`);

INSERT INTO `tbl_tenant_modules`
(`tenantId`,`moduleId`,`status`,`billingInterval`,`currencyCode`,`enabledDate`)
SELECT t.id,m.id,'ACTIVE','INCLUDED','GBP',CURRENT_TIMESTAMP
FROM `tbl_tenants` t
INNER JOIN `tbl_modules` m ON m.moduleCode='COMMERCIAL_DETAILS'
ON DUPLICATE KEY UPDATE `billingInterval`='INCLUDED';

INSERT INTO `tbl_tenant_terminology` (`tenantId`,`termKey`,`singularLabel`,`pluralLabel`)
SELECT t.id,'commercial','Commercial Details','Commercial Details'
FROM `tbl_tenants` t
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_tenant_terminology` tt
  WHERE tt.tenantId=t.id AND tt.termKey='commercial'
);

INSERT INTO `tbl_tenant_terminology` (`tenantId`,`termKey`,`singularLabel`,`pluralLabel`)
SELECT t.id,defaults.termKey,defaults.singularLabel,defaults.pluralLabel
FROM `tbl_tenants` t
CROSS JOIN (
  SELECT 'commercial_date' termKey,'Available From' singularLabel,'Available From' pluralLabel
  UNION ALL SELECT 'commercial_capacity','Capacity / Quantity','Capacity / Quantity'
  UNION ALL SELECT 'commercial_target','Sales / Income Target','Sales / Income Targets'
  UNION ALL SELECT 'commercial_price','Price / Value','Prices / Values'
  UNION ALL SELECT 'commercial_eligibility','Eligibility','Eligibility'
  UNION ALL SELECT 'commercial_tax','Tax / Charging Notes','Tax / Charging Notes'
) defaults
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_tenant_terminology` tt
  WHERE tt.tenantId=t.id AND tt.termKey=defaults.termKey
);

CREATE TABLE IF NOT EXISTS `tbl_workflow_commercial_details` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` INT UNSIGNED NOT NULL,
  `workflowId` INT UNSIGNED NOT NULL,
  `onSaleDateTime` DATETIME NULL,
  `currencyCode` CHAR(3) NOT NULL DEFAULT 'GBP',
  `capacity` INT UNSIGNED NULL,
  `salesTarget` DECIMAL(12,2) NULL,
  `taxNotes` VARCHAR(500) NULL,
  `notes` TEXT NULL,
  `createdByUserId` INT UNSIGNED NULL,
  `modifiedByUserId` INT UNSIGNED NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_commercial_details` (`tenantId`,`workflowId`),
  KEY `idx_workflow_commercial_workflow` (`workflowId`),
  CONSTRAINT `fk_workflow_commercial_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workflow_commercial_workflow` FOREIGN KEY (`workflowId`) REFERENCES `tbl_workflows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_workflow_price_entries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` INT UNSIGNED NOT NULL,
  `workflowId` INT UNSIGNED NOT NULL,
  `priceLabel` VARCHAR(160) NOT NULL,
  `calculationType` ENUM('fixed_amount','percentage_discount','fixed_discount','free','informational') NOT NULL DEFAULT 'fixed_amount',
  `amount` DECIMAL(12,2) NULL,
  `eligibility` VARCHAR(255) NULL,
  `validFrom` DATETIME NULL,
  `validUntil` DATETIME NULL,
  `displayOrder` INT NOT NULL DEFAULT 100,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdByUserId` INT UNSIGNED NULL,
  `modifiedByUserId` INT UNSIGNED NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_workflow_prices` (`tenantId`,`workflowId`,`isActive`,`displayOrder`),
  CONSTRAINT `fk_workflow_prices_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workflow_prices_workflow` FOREIGN KEY (`workflowId`) REFERENCES `tbl_workflows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `tbl_permissions`
(`permissionCode`,`permissionKey`,`permissionName`,`permissionDescription`,`permissionScope`,`permissionGroup`,`isSensitive`,`isAssignable`,`description`,`isActive`)
VALUES
('commercial.view','commercial.view','View commercial details','View workflow commercial details and price entries.','tenant','commercial',0,1,'View workflow commercial details and price entries.',1),
('commercial.manage','commercial.manage','Manage commercial details','Edit workflow commercial details and price entries.','tenant','commercial',1,1,'Edit workflow commercial details and price entries.',1)
ON DUPLICATE KEY UPDATE `permissionName`=VALUES(`permissionName`),`permissionDescription`=VALUES(`permissionDescription`),`isActive`=1;

INSERT IGNORE INTO `tbl_role_permissions` (`roleId`,`permissionId`)
SELECT r.id,p.id FROM `tbl_roles` r INNER JOIN `tbl_permissions` p
ON p.permissionCode IN ('commercial.view','commercial.manage')
WHERE r.roleKey IN ('owner','admin','department_head','editor','finance');
