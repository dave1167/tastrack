USE `task_tracker`;

ALTER TABLE `tbl_generated_contracts`
  ADD COLUMN IF NOT EXISTS `pdfStoragePath` varchar(500) NULL AFTER `renderedHtml`,
  ADD COLUMN IF NOT EXISTS `pdfFileName` varchar(255) NULL AFTER `pdfStoragePath`,
  ADD COLUMN IF NOT EXISTS `pdfSha256` char(64) NULL AFTER `pdfFileName`,
  ADD COLUMN IF NOT EXISTS `pdfGeneratedDate` datetime NULL AFTER `pdfSha256`;

CREATE TABLE IF NOT EXISTS `tbl_contract_deliveries` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `contractId` int unsigned NOT NULL,
  `deliveryMethod` enum('external','transactional_email','docusign') NOT NULL DEFAULT 'external',
  `deliveryStatus` varchar(40) NOT NULL DEFAULT 'recorded',
  `recipientName` varchar(180) NULL,
  `recipientEmail` varchar(254) NOT NULL,
  `ccSnapshot` text NULL,
  `bccSnapshot` text NULL,
  `subjectSnapshot` varchar(255) NULL,
  `messageSnapshot` longtext NULL,
  `pdfFileNameSnapshot` varchar(255) NOT NULL,
  `pdfSha256Snapshot` char(64) NOT NULL,
  `providerMessageId` varchar(255) NULL,
  `providerEnvelopeId` varchar(255) NULL,
  `providerEventJson` longtext NULL,
  `sentDate` datetime NOT NULL,
  `deliveredDate` datetime NULL,
  `viewedDate` datetime NULL,
  `completedDate` datetime NULL,
  `failedDate` datetime NULL,
  `failureReason` text NULL,
  `notes` text NULL,
  `createdByUserId` int unsigned NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contract_delivery_contract` (`tenantId`,`contractId`,`sentDate`),
  KEY `idx_contract_delivery_provider_message` (`providerMessageId`),
  KEY `idx_contract_delivery_provider_envelope` (`providerEnvelopeId`),
  CONSTRAINT `fk_contract_delivery_tenant`
    FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_contract_delivery_contract`
    FOREIGN KEY (`contractId`) REFERENCES `tbl_generated_contracts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_contract_delivery_user`
    FOREIGN KEY (`createdByUserId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tbl_contract_delivery_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `auditCopyEmail` varchar(254) NULL,
  `defaultSubjectTemplate` varchar(255) NULL,
  `defaultMessageTemplate` longtext NULL,
  `transactionalEmailEnabled` tinyint(1) NOT NULL DEFAULT 0,
  `signatureProvider` varchar(40) NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdByUserId` int unsigned NULL,
  `modifiedByUserId` int unsigned NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contract_delivery_settings_tenant` (`tenantId`),
  CONSTRAINT `fk_contract_delivery_settings_tenant`
    FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contract_delivery_settings_created_user`
    FOREIGN KEY (`createdByUserId`) REFERENCES `tbl_users` (`id`),
  CONSTRAINT `fk_contract_delivery_settings_modified_user`
    FOREIGN KEY (`modifiedByUserId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `tbl_activity_types`
(`tenantId`,`activityKey`,`activityName`,`activityCategory`,`description`,`icon`,`colour`,`isActive`)
SELECT t.id,x.activityKey,x.activityName,'contracts',x.description,x.icon,'#23e4d4',1
FROM `tbl_tenants` t
CROSS JOIN (
  SELECT 'contract.pdf_generated' activityKey,'Contract PDF generated' activityName,'An immutable contract PDF was generated.' description,'fas fa-file-pdf' icon
  UNION ALL SELECT 'contract.sent_external','Contract sent externally','A user recorded external delivery of a contract.','fas fa-paper-plane'
) x
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_activity_types` a WHERE a.tenantId=t.id AND a.activityKey=x.activityKey
);
