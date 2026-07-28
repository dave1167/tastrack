USE `task_tracker`;

CREATE TABLE IF NOT EXISTS `tbl_contracting_entities` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `tradingName` varchar(180) NULL,
  `legalName` varchar(220) NOT NULL,
  `registrationNumber` varchar(80) NULL,
  `vatNumber` varchar(80) NULL,
  `addressLine1` varchar(180) NULL,
  `addressLine2` varchar(180) NULL,
  `townCity` varchar(120) NULL,
  `countyRegion` varchar(120) NULL,
  `postcode` varchar(30) NULL,
  `country` varchar(100) NULL,
  `telephone` varchar(60) NULL,
  `email` varchar(180) NULL,
  `website` varchar(255) NULL,
  `signatoryName` varchar(180) NULL,
  `signatoryTitle` varchar(180) NULL,
  `defaultPaymentTerms` text NULL,
  `contractFooter` text NULL,
  `isDefault` tinyint(1) NOT NULL DEFAULT 0,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `defaultTenantId` int unsigned GENERATED ALWAYS AS (CASE WHEN `isDefault`=1 THEN `tenantId` ELSE NULL END) STORED,
  `createdByUserId` int unsigned NULL,
  `modifiedByUserId` int unsigned NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contracting_entity_default` (`defaultTenantId`),
  KEY `idx_contracting_entities_tenant` (`tenantId`,`isActive`,`legalName`),
  CONSTRAINT `fk_contracting_entities_tenant` FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_contracting_entities_created_user` FOREIGN KEY (`createdByUserId`) REFERENCES `tbl_users` (`id`),
  CONSTRAINT `fk_contracting_entities_modified_user` FOREIGN KEY (`modifiedByUserId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `tbl_workflows`
  ADD COLUMN IF NOT EXISTS `contractingEntityId` int unsigned NULL AFTER `configurationId`,
  ADD INDEX IF NOT EXISTS `idx_workflows_contracting_entity` (`tenantId`,`contractingEntityId`);

ALTER TABLE `tbl_generated_contracts`
  ADD COLUMN IF NOT EXISTS `contractingEntityId` int unsigned NULL AFTER `templateVersionNumber`,
  ADD COLUMN IF NOT EXISTS `contractingEntitySnapshot` longtext NULL AFTER `contractingEntityId`;

INSERT INTO `tbl_contracting_entities`
(`tenantId`,`tradingName`,`legalName`,`isDefault`,`isActive`)
SELECT t.id,t.tenantName,t.tenantName,1,1
FROM `tbl_tenants` t
WHERE NOT EXISTS (SELECT 1 FROM `tbl_contracting_entities` ce WHERE ce.tenantId=t.id);

UPDATE `tbl_workflows` w
SET w.contractingEntityId=(SELECT ce.id FROM `tbl_contracting_entities` ce WHERE ce.tenantId=w.tenantId AND ce.isDefault=1 LIMIT 1)
WHERE w.contractingEntityId IS NULL;
