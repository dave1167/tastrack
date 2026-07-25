USE `task_tracker`;

ALTER TABLE `tbl_users`
  ADD COLUMN IF NOT EXISTS `isPlatformAdmin` tinyint(1) NOT NULL DEFAULT 0 AFTER `isActive`;

CREATE TABLE IF NOT EXISTS `tbl_modules` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `moduleCode` varchar(80) NOT NULL,
  `moduleName` varchar(160) NOT NULL,
  `moduleDescription` text DEFAULT NULL,
  `moduleCategory` varchar(80) DEFAULT NULL,
  `isCore` tinyint(1) NOT NULL DEFAULT 0,
  `isBillable` tinyint(1) NOT NULL DEFAULT 1,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `defaultMonthlyPrice` decimal(10,2) DEFAULT NULL,
  `defaultAnnualPrice` decimal(10,2) DEFAULT NULL,
  `currencyCode` char(3) NOT NULL DEFAULT 'GBP',
  `displayOrder` int(11) NOT NULL DEFAULT 0,
  `createdDate` datetime NOT NULL DEFAULT current_timestamp(),
  `modifiedDate` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_modules_moduleCode` (`moduleCode`),
  KEY `idx_tbl_modules_active_order` (`isActive`, `displayOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_tenant_modules` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int(10) unsigned NOT NULL,
  `moduleId` int(10) unsigned NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'DISABLED',
  `accessStartDate` datetime DEFAULT NULL,
  `accessEndDate` datetime DEFAULT NULL,
  `trialEndsDate` datetime DEFAULT NULL,
  `billingInterval` varchar(20) DEFAULT NULL,
  `monthlyPrice` decimal(10,2) DEFAULT NULL,
  `annualPrice` decimal(10,2) DEFAULT NULL,
  `currencyCode` char(3) NOT NULL DEFAULT 'GBP',
  `billingReference` varchar(255) DEFAULT NULL,
  `autoRenew` tinyint(1) NOT NULL DEFAULT 0,
  `enabledDate` datetime DEFAULT NULL,
  `disabledDate` datetime DEFAULT NULL,
  `createdByUserId` int(10) unsigned DEFAULT NULL,
  `modifiedByUserId` int(10) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `createdDate` datetime NOT NULL DEFAULT current_timestamp(),
  `modifiedDate` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_tenant_modules_tenant_module` (`tenantId`, `moduleId`),
  KEY `idx_tbl_tenant_modules_tenant_status` (`tenantId`, `status`),
  KEY `idx_tbl_tenant_modules_module_status` (`moduleId`, `status`),
  CONSTRAINT `fk_tbl_tenant_modules_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_tenant_modules_module` FOREIGN KEY (`moduleId`) REFERENCES `tbl_modules` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_module_dependencies` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `moduleId` int(10) unsigned NOT NULL,
  `dependsOnModuleId` int(10) unsigned NOT NULL,
  `isRequired` tinyint(1) NOT NULL DEFAULT 1,
  `createdDate` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_module_dependencies` (`moduleId`, `dependsOnModuleId`),
  KEY `idx_tbl_module_dependencies_parent` (`dependsOnModuleId`),
  CONSTRAINT `fk_tbl_module_dependencies_module` FOREIGN KEY (`moduleId`) REFERENCES `tbl_modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_module_dependencies_required` FOREIGN KEY (`dependsOnModuleId`) REFERENCES `tbl_modules` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_tenant_module_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenantModuleId` bigint(20) unsigned NOT NULL,
  `tenantId` int(10) unsigned NOT NULL,
  `moduleId` int(10) unsigned NOT NULL,
  `actionCode` varchar(50) NOT NULL,
  `previousStatus` varchar(30) DEFAULT NULL,
  `newStatus` varchar(30) DEFAULT NULL,
  `previousMonthlyPrice` decimal(10,2) DEFAULT NULL,
  `newMonthlyPrice` decimal(10,2) DEFAULT NULL,
  `previousAnnualPrice` decimal(10,2) DEFAULT NULL,
  `newAnnualPrice` decimal(10,2) DEFAULT NULL,
  `changeNote` text DEFAULT NULL,
  `changedByUserId` int(10) unsigned DEFAULT NULL,
  `changedDate` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tbl_tenant_module_history_tenant` (`tenantId`, `changedDate`),
  KEY `idx_tbl_tenant_module_history_module` (`moduleId`, `changedDate`),
  KEY `idx_tbl_tenant_module_history_entitlement` (`tenantModuleId`, `changedDate`),
  CONSTRAINT `fk_tbl_tenant_module_history_entitlement` FOREIGN KEY (`tenantModuleId`) REFERENCES `tbl_tenant_modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_tenant_module_history_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_tenant_module_history_module` FOREIGN KEY (`moduleId`) REFERENCES `tbl_modules` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `tbl_modules`
(`moduleCode`,`moduleName`,`moduleDescription`,`moduleCategory`,`isCore`,`isBillable`,`isActive`,`defaultMonthlyPrice`,`defaultAnnualPrice`,`currencyCode`,`displayOrder`)
VALUES
('CORE','Tastrack Core','Core workflow, tasks, events, teams and standard Tastrack functionality.','CORE',1,0,1,NULL,NULL,'GBP',10),
('CONTRACT_GENERATION','Contract Generation','Contract templates, merge fields, document generation, versioning and contract records.','DOCUMENTS',0,1,1,7.50,75.00,'GBP',100),
('ADVANCED_NOTIFICATIONS','Advanced Notifications','Custom notification rules, digests, escalations and advanced delivery options.','AUTOMATION',0,1,0,NULL,NULL,'GBP',200),
('WHITE_LABEL_EMAIL','White-label Email','Tenant-specific sending domains and enhanced notification branding.','COMMUNICATIONS',0,1,0,NULL,NULL,'GBP',210)
ON DUPLICATE KEY UPDATE
`moduleName`=VALUES(`moduleName`),`moduleDescription`=VALUES(`moduleDescription`),`moduleCategory`=VALUES(`moduleCategory`),
`isCore`=VALUES(`isCore`),`isBillable`=VALUES(`isBillable`),`isActive`=VALUES(`isActive`),
`defaultMonthlyPrice`=VALUES(`defaultMonthlyPrice`),`defaultAnnualPrice`=VALUES(`defaultAnnualPrice`),
`currencyCode`=VALUES(`currencyCode`),`displayOrder`=VALUES(`displayOrder`);

INSERT INTO `tbl_tenant_modules` (`tenantId`,`moduleId`,`status`,`billingInterval`,`currencyCode`,`enabledDate`)
SELECT t.`id`,m.`id`,'ACTIVE','INCLUDED','GBP',current_timestamp()
FROM `tbl_tenants` t
INNER JOIN `tbl_modules` m ON m.`moduleCode`='CORE'
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_tenant_modules` tm WHERE tm.`tenantId`=t.`id` AND tm.`moduleId`=m.`id`
);

-- Bootstrap one platform administrator only when the installation has none.
UPDATE `tbl_users` u
SET u.`isPlatformAdmin`=1
WHERE u.`id`=(
  SELECT bootstrap.userId
  FROM (
    SELECT MIN(utr.userId) userId
    FROM `tbl_user_tenant_roles` utr
    INNER JOIN `tbl_roles` r ON r.id=utr.roleId
    INNER JOIN `tbl_users` candidate ON candidate.id=utr.userId AND candidate.isActive=1
    WHERE utr.isActive=1 AND r.roleKey='owner'
  ) bootstrap
)
AND NOT EXISTS (
  SELECT 1 FROM (SELECT id FROM `tbl_users` WHERE `isPlatformAdmin`=1 LIMIT 1) existingAdmin
);

DROP TRIGGER IF EXISTS `trg_tbl_tenants_assign_core`;
CREATE TRIGGER `trg_tbl_tenants_assign_core`
AFTER INSERT ON `tbl_tenants`
FOR EACH ROW
INSERT INTO `tbl_tenant_modules`
  (`tenantId`,`moduleId`,`status`,`billingInterval`,`currencyCode`,`enabledDate`)
SELECT NEW.`id`,m.`id`,'ACTIVE','INCLUDED','GBP',CURRENT_TIMESTAMP
FROM `tbl_modules` m
WHERE m.`moduleCode`='CORE' AND m.`isActive`=1;
