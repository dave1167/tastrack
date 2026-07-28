USE `task_tracker`;

-- Add clause behaviour without renaming existing columns used by Wappler actions.
ALTER TABLE `tbl_contract_clauses`
  ADD COLUMN IF NOT EXISTS `clauseCode` varchar(80) NULL AFTER `clauseName`,
  ADD COLUMN IF NOT EXISTS `clauseBehaviour` enum('mandatory','optional','conditional') NOT NULL DEFAULT 'optional' AFTER `clauseHtml`,
  ADD COLUMN IF NOT EXISTS `conditionKey` varchar(120) NULL AFTER `clauseBehaviour`;

ALTER TABLE `tbl_contract_template_clauses`
  ADD COLUMN IF NOT EXISTS `clauseBehaviour` enum('mandatory','optional','conditional') NOT NULL DEFAULT 'optional' AFTER `clauseHtmlSnapshot`,
  ADD COLUMN IF NOT EXISTS `conditionKey` varchar(120) NULL AFTER `clauseBehaviour`,
  ADD COLUMN IF NOT EXISTS `defaultIncluded` tinyint(1) NOT NULL DEFAULT 1 AFTER `conditionKey`,
  ADD COLUMN IF NOT EXISTS `isActive` tinyint(1) NOT NULL DEFAULT 1 AFTER `defaultIncluded`,
  ADD COLUMN IF NOT EXISTS `modifiedByUserId` int unsigned NULL AFTER `createdDate`,
  ADD COLUMN IF NOT EXISTS `modifiedDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `modifiedByUserId`;

-- A generated contract is the contract record. Status controls when wording becomes immutable.
ALTER TABLE `tbl_generated_contracts`
  ADD COLUMN IF NOT EXISTS `issuedDate` datetime NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `issuedByUserId` int unsigned NULL AFTER `issuedDate`,
  ADD COLUMN IF NOT EXISTS `modifiedByUserId` int unsigned NULL AFTER `generatedByUserId`;

CREATE TABLE IF NOT EXISTS `tbl_contract_document_clauses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `contractId` int unsigned NOT NULL,
  `sourceClauseId` int unsigned NULL,
  `clauseHeading` varchar(180) NOT NULL,
  `clauseTextSnapshot` longtext NOT NULL,
  `clauseBehaviour` enum('mandatory','optional','conditional') NOT NULL DEFAULT 'optional',
  `conditionKey` varchar(120) NULL,
  `displayOrder` int NOT NULL DEFAULT 100,
  `isIncluded` tinyint(1) NOT NULL DEFAULT 1,
  `isCustom` tinyint(1) NOT NULL DEFAULT 0,
  `createdByUserId` int unsigned NULL,
  `modifiedByUserId` int unsigned NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contract_document_clause_order` (`tenantId`,`contractId`,`displayOrder`,`id`),
  KEY `idx_contract_document_clause_source` (`tenantId`,`sourceClauseId`),
  CONSTRAINT `fk_contract_document_clause_tenant`
    FOREIGN KEY (`tenantId`) REFERENCES `tbl_tenants` (`id`),
  CONSTRAINT `fk_contract_document_clause_contract`
    FOREIGN KEY (`contractId`) REFERENCES `tbl_generated_contracts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_contract_document_clause_source`
    FOREIGN KEY (`sourceClauseId`) REFERENCES `tbl_contract_clauses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_contract_document_clause_created_user`
    FOREIGN KEY (`createdByUserId`) REFERENCES `tbl_users` (`id`),
  CONSTRAINT `fk_contract_document_clause_modified_user`
    FOREIGN KEY (`modifiedByUserId`) REFERENCES `tbl_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve behaviour already defined in the library for mappings created before this migration.
UPDATE `tbl_contract_template_clauses` tc
INNER JOIN `tbl_contract_clauses` c
  ON c.id = tc.clauseId AND c.tenantId = tc.tenantId
SET tc.clauseBehaviour = c.clauseBehaviour,
    tc.conditionKey = c.conditionKey,
    tc.defaultIncluded = CASE WHEN c.clauseBehaviour = 'mandatory' THEN 1 ELSE tc.defaultIncluded END;

DROP TRIGGER IF EXISTS `trg_contract_template_clause_snapshot`;
DELIMITER //
CREATE TRIGGER `trg_contract_template_clause_snapshot`
BEFORE INSERT ON `tbl_contract_template_clauses`
FOR EACH ROW
BEGIN
  IF NEW.clauseId IS NOT NULL THEN
    SET NEW.clauseBehaviour = COALESCE(
      (SELECT c.clauseBehaviour FROM tbl_contract_clauses c
       WHERE c.id = NEW.clauseId AND c.tenantId = NEW.tenantId LIMIT 1),
      NEW.clauseBehaviour
    );
    SET NEW.conditionKey = (
      SELECT c.conditionKey FROM tbl_contract_clauses c
      WHERE c.id = NEW.clauseId AND c.tenantId = NEW.tenantId LIMIT 1
    );
    IF NEW.clauseBehaviour = 'mandatory' THEN
      SET NEW.defaultIncluded = 1;
    END IF;
  END IF;
END//
DELIMITER ;

INSERT INTO `tbl_activity_types`
(`tenantId`,`activityKey`,`activityName`,`activityCategory`,`description`,`icon`,`colour`,`isActive`)
SELECT t.id,x.activityKey,x.activityName,'contracts',x.description,'fas fa-file-signature','#23e4d4',1
FROM `tbl_tenants` t
CROSS JOIN (
  SELECT 'contract.clauses_updated' activityKey,'Contract clauses updated' activityName,'Contract-specific clause wording or order was changed.' description
  UNION ALL SELECT 'contract.issued','Contract issued','A draft contract was issued and its wording locked.'
) x
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_activity_types` a WHERE a.tenantId=t.id AND a.activityKey=x.activityKey
);
