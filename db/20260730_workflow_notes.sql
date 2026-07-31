USE `task_tracker`;

ALTER TABLE `tbl_workflows`
    ADD COLUMN IF NOT EXISTS `notes` TEXT NULL AFTER `referenceCode`;
