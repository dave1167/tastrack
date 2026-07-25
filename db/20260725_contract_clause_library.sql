USE `task_tracker`;

CREATE TABLE IF NOT EXISTS `tbl_contract_clauses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `clauseName` varchar(180) NOT NULL,
  `clauseCategory` varchar(100) NULL,
  `clauseHtml` longtext NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 100,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdByUserId` int unsigned NULL,
  `modifiedByUserId` int unsigned NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contract_clauses_tenant` (`tenantId`,`isActive`,`clauseCategory`,`sortOrder`,`clauseName`),
  CONSTRAINT `fk_contract_clauses_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_contract_clauses_created_user` FOREIGN KEY (`createdByUserId`) REFERENCES `tbl_users` (`id`),
  CONSTRAINT `fk_contract_clauses_modified_user` FOREIGN KEY (`modifiedByUserId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_contract_template_clauses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `templateId` int unsigned NOT NULL,
  `clauseId` int unsigned NULL,
  `clauseNameSnapshot` varchar(180) NOT NULL,
  `clauseHtmlSnapshot` longtext NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 100,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_template_clause` (`tenantId`,`templateId`,`clauseId`),
  KEY `idx_template_clauses_order` (`tenantId`,`templateId`,`sortOrder`),
  CONSTRAINT `fk_template_clauses_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_template_clauses_template` FOREIGN KEY (`templateId`) REFERENCES `tbl_contract_templates` (`id`),
  CONSTRAINT `fk_template_clauses_clause` FOREIGN KEY (`clauseId`) REFERENCES `tbl_contract_clauses` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `tbl_activity_types`
(`tenantId`,`activityKey`,`activityName`,`activityCategory`,`description`,`icon`,`colour`,`isActive`)
SELECT t.id,x.activityKey,x.activityName,'contracts',x.description,'fas fa-paragraph','#23e4d4',1
FROM `tbl_tenants` t
CROSS JOIN (
  SELECT 'contract.clause_created' activityKey,'Contract clause created' activityName,'A reusable contract clause was created.' description
  UNION ALL SELECT 'contract.clause_updated','Contract clause updated','A reusable contract clause was updated.'
) x
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_activity_types` a WHERE a.tenantId=t.id AND a.activityKey=x.activityKey
);
