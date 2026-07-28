USE `task_tracker`;

-- Keep this migration recoverable if it is accidentally run before
-- 20260726_contract_pdf_delivery.sql.
ALTER TABLE `tbl_generated_contracts`
  ADD COLUMN IF NOT EXISTS `pdfStoragePath` varchar(500) NULL AFTER `renderedHtml`,
  ADD COLUMN IF NOT EXISTS `pdfFileName` varchar(255) NULL AFTER `pdfStoragePath`,
  ADD COLUMN IF NOT EXISTS `pdfSha256` char(64) NULL AFTER `pdfFileName`,
  ADD COLUMN IF NOT EXISTS `pdfGeneratedDate` datetime NULL AFTER `pdfSha256`,
  ADD COLUMN IF NOT EXISTS `issuedDate` datetime NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `issuedByUserId` int unsigned NULL AFTER `issuedDate`,
  ADD COLUMN IF NOT EXISTS `modifiedByUserId` int unsigned NULL AFTER `generatedByUserId`;

ALTER TABLE `tbl_generated_contracts`
  ADD COLUMN IF NOT EXISTS `contractVersionNumber` int unsigned NOT NULL DEFAULT 0 AFTER `templateVersionNumber`,
  ADD COLUMN IF NOT EXISTS `draftModifiedDate` datetime NULL AFTER `contractVersionNumber`,
  ADD COLUMN IF NOT EXISTS `draftModifiedByUserId` int unsigned NULL AFTER `draftModifiedDate`;

CREATE TABLE IF NOT EXISTS `tbl_contract_versions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `contractId` int unsigned NOT NULL,
  `contractVersionNumber` int unsigned NOT NULL,
  `contractNameSnapshot` varchar(180) NOT NULL,
  `renderedHtmlSnapshot` longtext NOT NULL,
  `clausesJsonSnapshot` longtext NOT NULL,
  `pdfStoragePath` varchar(500) NOT NULL,
  `pdfFileName` varchar(255) NOT NULL,
  `pdfSha256` char(64) NOT NULL,
  `issuedByUserId` int unsigned NULL,
  `issuedDate` datetime NOT NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contract_version` (`tenantId`,`contractId`,`contractVersionNumber`),
  KEY `idx_contract_version_contract` (`tenantId`,`contractId`,`issuedDate`),
  CONSTRAINT `fk_contract_version_tenant`
    FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_contract_version_contract`
    FOREIGN KEY (`contractId`) REFERENCES `tbl_generated_contracts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_contract_version_issued_user`
    FOREIGN KEY (`issuedByUserId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing issued contracts become version 1 without altering drafts.
UPDATE `tbl_generated_contracts`
SET `contractVersionNumber` = 1
WHERE `status` IN ('issued','sent')
  AND `contractVersionNumber` = 0;

INSERT INTO `tbl_contract_versions`
(`tenantId`,`contractId`,`contractVersionNumber`,`contractNameSnapshot`,`renderedHtmlSnapshot`,
 `clausesJsonSnapshot`,`pdfStoragePath`,`pdfFileName`,`pdfSha256`,`issuedByUserId`,`issuedDate`)
SELECT gc.tenantId,gc.id,gc.contractVersionNumber,gc.contractName,gc.renderedHtml,
       COALESCE((
         SELECT JSON_ARRAYAGG(JSON_OBJECT(
           'clauseHeading',dc.clauseHeading,
           'clauseTextSnapshot',dc.clauseTextSnapshot,
           'clauseBehaviour',dc.clauseBehaviour,
           'displayOrder',dc.displayOrder,
           'isIncluded',dc.isIncluded,
           'isCustom',dc.isCustom
         ))
         FROM tbl_contract_document_clauses dc
         WHERE dc.tenantId=gc.tenantId AND dc.contractId=gc.id
       ),JSON_ARRAY()),
       gc.pdfStoragePath,gc.pdfFileName,gc.pdfSha256,gc.issuedByUserId,
       COALESCE(gc.issuedDate,gc.pdfGeneratedDate,gc.modifiedDate,gc.createdDate)
FROM `tbl_generated_contracts` gc
WHERE gc.status IN ('issued','sent')
  AND gc.contractVersionNumber > 0
  AND gc.pdfStoragePath IS NOT NULL
  AND gc.pdfFileName IS NOT NULL
  AND gc.pdfSha256 IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tbl_contract_versions cv
    WHERE cv.tenantId=gc.tenantId
      AND cv.contractId=gc.id
      AND cv.contractVersionNumber=gc.contractVersionNumber
  );

INSERT INTO `tbl_activity_types`
(`tenantId`,`activityKey`,`activityName`,`activityCategory`,`description`,`icon`,`colour`,`isActive`)
SELECT t.id,x.activityKey,x.activityName,'contracts',x.description,x.icon,'#23e4d4',1
FROM `tbl_tenants` t
CROSS JOIN (
  SELECT 'contract.draft_updated' activityKey,'Contract draft updated' activityName,'The editable contract draft was updated.' description,'fas fa-pen' icon
  UNION ALL SELECT 'contract.revision_created','Contract revision created','A new editable revision was created from an issued contract.','fas fa-code-branch'
) x
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_activity_types` a WHERE a.tenantId=t.id AND a.activityKey=x.activityKey
);
