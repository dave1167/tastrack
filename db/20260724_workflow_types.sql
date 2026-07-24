USE `task_tracker`;

CREATE TABLE IF NOT EXISTS `tbl_workflow_types` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` INT UNSIGNED NOT NULL,
  `typeName` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) NULL,
  `colour` VARCHAR(20) NOT NULL DEFAULT '#0d6efd',
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_types_tenant_id` (`tenantId`,`id`),
  UNIQUE KEY `uq_workflow_types_tenant_name` (`tenantId`,`typeName`),
  CONSTRAINT `fk_workflow_types_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `tbl_workflows`
  ADD COLUMN `workflowTypeId` INT UNSIGNED NULL AFTER `templateVersionNumber`,
  ADD KEY `idx_workflows_tenant_type` (`tenantId`,`workflowTypeId`),
  ADD CONSTRAINT `fk_workflows_tenant_type` FOREIGN KEY (`tenantId`,`workflowTypeId`)
    REFERENCES `tbl_workflow_types` (`tenantId`,`id`) ON UPDATE CASCADE ON DELETE RESTRICT;

INSERT INTO `tbl_workflow_types` (`tenantId`,`typeName`,`sortOrder`)
SELECT DISTINCT v.tenantId,TRIM(v.valueText),10
FROM `tbl_workflow_field_values` v
WHERE v.fieldKey='event_type' AND NULLIF(TRIM(v.valueText),'') IS NOT NULL;

UPDATE `tbl_workflows` w
INNER JOIN `tbl_workflow_field_values` v ON v.workflowId=w.id AND v.tenantId=w.tenantId AND v.fieldKey='event_type'
INNER JOIN `tbl_workflow_types` t ON t.tenantId=w.tenantId AND t.typeName=TRIM(v.valueText)
SET w.workflowTypeId=t.id
WHERE w.workflowTypeId IS NULL;
