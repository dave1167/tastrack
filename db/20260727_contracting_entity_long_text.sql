USE `task_tracker`;

-- Payment terms are reusable contract wording and commonly exceed 255 characters.
ALTER TABLE `tbl_contracting_entities`
  MODIFY COLUMN `defaultPaymentTerms` text NULL;
