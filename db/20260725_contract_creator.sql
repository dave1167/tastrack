USE `task_tracker`;

CREATE TABLE IF NOT EXISTS `tbl_contract_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `templateName` varchar(180) NOT NULL,
  `description` text NULL,
  `bodyHtml` longtext NOT NULL,
  `versionNumber` int unsigned NOT NULL DEFAULT 1,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdByUserId` int unsigned NULL,
  `modifiedByUserId` int unsigned NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contract_templates_tenant` (`tenantId`,`isActive`,`templateName`),
  CONSTRAINT `fk_contract_templates_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_contract_templates_created_user` FOREIGN KEY (`createdByUserId`) REFERENCES `tbl_users` (`id`),
  CONSTRAINT `fk_contract_templates_modified_user` FOREIGN KEY (`modifiedByUserId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_contract_template_versions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `templateId` int unsigned NOT NULL,
  `versionNumber` int unsigned NOT NULL,
  `templateName` varchar(180) NOT NULL,
  `description` text NULL,
  `bodyHtml` longtext NOT NULL,
  `createdByUserId` int unsigned NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contract_template_version` (`tenantId`,`templateId`,`versionNumber`),
  CONSTRAINT `fk_contract_versions_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_contract_versions_template` FOREIGN KEY (`templateId`) REFERENCES `tbl_contract_templates` (`id`),
  CONSTRAINT `fk_contract_versions_user` FOREIGN KEY (`createdByUserId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_generated_contracts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `workflowId` int unsigned NOT NULL,
  `templateId` int unsigned NOT NULL,
  `templateVersionNumber` int unsigned NOT NULL,
  `contractName` varchar(180) NOT NULL,
  `renderedHtml` longtext NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'draft',
  `generatedByUserId` int unsigned NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_generated_contracts_workflow` (`tenantId`,`workflowId`,`createdDate`),
  CONSTRAINT `fk_generated_contracts_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_generated_contracts_workflow` FOREIGN KEY (`workflowId`) REFERENCES `tbl_workflows` (`id`),
  CONSTRAINT `fk_generated_contracts_template` FOREIGN KEY (`templateId`) REFERENCES `tbl_contract_templates` (`id`),
  CONSTRAINT `fk_generated_contracts_user` FOREIGN KEY (`generatedByUserId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `tbl_activity_types`
(`tenantId`,`activityKey`,`activityName`,`activityCategory`,`description`,`icon`,`colour`,`isActive`)
SELECT t.id,x.activityKey,x.activityName,'contracts',x.description,'fas fa-file-contract','#23e4d4',1
FROM `tbl_tenants` t
CROSS JOIN (
  SELECT 'contract.template_created' activityKey,'Contract template created' activityName,'A contract template was created.' description
  UNION ALL SELECT 'contract.template_updated','Contract template updated','A contract template was updated.'
  UNION ALL SELECT 'contract.generated','Contract generated','A contract was generated for an event.'
) x
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_activity_types` a WHERE a.tenantId=t.id AND a.activityKey=x.activityKey
);
