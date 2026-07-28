-- Professional contact details and event-specific contractual parties.
-- Safe to run more than once on MariaDB/MySQL versions supporting IF NOT EXISTS.

ALTER TABLE `tbl_contacts`
  ADD COLUMN IF NOT EXISTS `legalName` varchar(180) NULL AFTER `organisationName`,
  ADD COLUMN IF NOT EXISTS `tradingName` varchar(180) NULL AFTER `legalName`,
  ADD COLUMN IF NOT EXISTS `jobTitle` varchar(120) NULL AFTER `lastName`,
  ADD COLUMN IF NOT EXISTS `registrationNumber` varchar(80) NULL AFTER `phone`,
  ADD COLUMN IF NOT EXISTS `vatNumber` varchar(80) NULL AFTER `registrationNumber`,
  ADD COLUMN IF NOT EXISTS `website` varchar(255) NULL AFTER `vatNumber`,
  ADD UNIQUE INDEX IF NOT EXISTS `uq_contacts_tenant_id` (`tenantId`,`id`);

ALTER TABLE `tbl_workflows`
  ADD UNIQUE INDEX IF NOT EXISTS `uq_workflows_tenant_id` (`tenantId`,`id`);

CREATE TABLE IF NOT EXISTS `tbl_workflow_contract_details` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` int unsigned NOT NULL,
  `workflowId` int unsigned NOT NULL,
  `contractPartyContactId` int unsigned NULL,
  `artistContactId` int unsigned NULL,
  `managerContactId` int unsigned NULL,
  `promoterContactId` int unsigned NULL,
  `agentContactId` int unsigned NULL,
  `signatoryContactId` int unsigned NULL,
  `financeContactId` int unsigned NULL,
  `createdByUserId` int unsigned NULL,
  `modifiedByUserId` int unsigned NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_contract_details` (`tenantId`,`workflowId`),
  KEY `idx_workflow_contract_party` (`tenantId`,`contractPartyContactId`),
  CONSTRAINT `fk_workflow_contract_details_workflow`
    FOREIGN KEY (`tenantId`,`workflowId`) REFERENCES `tbl_workflows` (`tenantId`,`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workflow_contract_details_party`
    FOREIGN KEY (`tenantId`,`contractPartyContactId`) REFERENCES `tbl_contacts` (`tenantId`,`id`),
  CONSTRAINT `fk_workflow_contract_details_artist`
    FOREIGN KEY (`tenantId`,`artistContactId`) REFERENCES `tbl_contacts` (`tenantId`,`id`),
  CONSTRAINT `fk_workflow_contract_details_manager`
    FOREIGN KEY (`tenantId`,`managerContactId`) REFERENCES `tbl_contacts` (`tenantId`,`id`),
  CONSTRAINT `fk_workflow_contract_details_promoter`
    FOREIGN KEY (`tenantId`,`promoterContactId`) REFERENCES `tbl_contacts` (`tenantId`,`id`),
  CONSTRAINT `fk_workflow_contract_details_agent`
    FOREIGN KEY (`tenantId`,`agentContactId`) REFERENCES `tbl_contacts` (`tenantId`,`id`),
  CONSTRAINT `fk_workflow_contract_details_signatory`
    FOREIGN KEY (`tenantId`,`signatoryContactId`) REFERENCES `tbl_contacts` (`tenantId`,`id`),
  CONSTRAINT `fk_workflow_contract_details_finance`
    FOREIGN KEY (`tenantId`,`financeContactId`) REFERENCES `tbl_contacts` (`tenantId`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `tbl_generated_contracts`
  ADD COLUMN IF NOT EXISTS `contractPartiesSnapshot` longtext NULL AFTER `contractingEntitySnapshot`;
