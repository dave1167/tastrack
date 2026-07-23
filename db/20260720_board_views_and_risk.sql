USE `task_tracker`;

CREATE TABLE IF NOT EXISTS `tbl_board_views` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` INT UNSIGNED NOT NULL,
  `templateId` INT UNSIGNED NULL,
  `userId` INT UNSIGNED NULL,
  `viewName` VARCHAR(120) NOT NULL,
  `viewType` ENUM('template','tenant','personal') NOT NULL DEFAULT 'personal',
  `isDefault` TINYINT(1) NOT NULL DEFAULT 0,
  `filtersJson` JSON NULL,
  `sortsJson` JSON NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_board_views_scope` (`tenantId`,`templateId`,`userId`,`isDefault`),
  CONSTRAINT `fk_board_views_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_board_views_template` FOREIGN KEY (`templateId`) REFERENCES `tbl_workflow_templates` (`id`),
  CONSTRAINT `fk_board_views_user` FOREIGN KEY (`userId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tbl_board_view_columns` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `boardViewId` INT UNSIGNED NOT NULL,
  `fieldKey` VARCHAR(100) NOT NULL,
  `columnLabel` VARCHAR(120) NOT NULL,
  `isVisible` TINYINT(1) NOT NULL DEFAULT 1,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `width` INT UNSIGNED NULL,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_board_view_field` (`boardViewId`,`fieldKey`),
  CONSTRAINT `fk_board_view_columns_view` FOREIGN KEY (`boardViewId`) REFERENCES `tbl_board_views` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tbl_workflow_risk_status` (
  `workflowId` INT UNSIGNED NOT NULL,
  `tenantId` INT UNSIGNED NOT NULL,
  `calculatedRisk` ENUM('green','amber','red','grey') NOT NULL DEFAULT 'grey',
  `manualRiskOverride` ENUM('amber','red') NULL,
  `riskReason` VARCHAR(500) NULL,
  `calculatedDate` DATETIME NULL,
  `modifiedBy` INT UNSIGNED NULL,
  `modifiedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`workflowId`),
  KEY `idx_workflow_risk_tenant` (`tenantId`,`calculatedRisk`),
  CONSTRAINT `fk_workflow_risk_workflow` FOREIGN KEY (`workflowId`) REFERENCES `tbl_workflows` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workflow_risk_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_workflow_risk_user` FOREIGN KEY (`modifiedBy`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tbl_workflow_risk_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` INT UNSIGNED NOT NULL,
  `workflowId` INT UNSIGNED NOT NULL,
  `previousRisk` ENUM('green','amber','red','grey') NULL,
  `newRisk` ENUM('green','amber','red','grey') NOT NULL,
  `reason` VARCHAR(500) NULL,
  `changedBy` INT UNSIGNED NULL,
  `changedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_risk_history_workflow` (`tenantId`,`workflowId`,`changedDate`),
  CONSTRAINT `fk_risk_history_workflow` FOREIGN KEY (`workflowId`) REFERENCES `tbl_workflows` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_risk_history_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_risk_history_user` FOREIGN KEY (`changedBy`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed a tenant-level default board only where a tenant has no default yet.
INSERT INTO `tbl_board_views` (`tenantId`,`templateId`,`userId`,`viewName`,`viewType`,`isDefault`)
SELECT t.id,NULL,NULL,'Organisation default','tenant',1
FROM `tbl_tenants` t
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_board_views` v
  WHERE v.tenantId=t.id AND v.templateId IS NULL AND v.userId IS NULL AND v.isDefault=1
);

INSERT INTO `tbl_board_view_columns` (`boardViewId`,`fieldKey`,`columnLabel`,`isVisible`,`sortOrder`,`width`)
SELECT v.id,c.fieldKey,c.columnLabel,1,c.sortOrder,c.width
FROM `tbl_board_views` v
JOIN (
  SELECT 'workflowName' fieldKey,'Workflow' columnLabel,10 sortOrder,280 width UNION ALL
  SELECT 'templateName','Template',20,180 UNION ALL
  SELECT 'targetDate','Target date',30,140 UNION ALL
  SELECT 'ownerName','Owner',40,180 UNION ALL
  SELECT 'progress','Progress',50,150 UNION ALL
  SELECT 'status','Status',60,120 UNION ALL
  SELECT 'risk','Risk',70,220
) c
WHERE v.viewType='tenant' AND v.isDefault=1
ON DUPLICATE KEY UPDATE columnLabel=VALUES(columnLabel);
