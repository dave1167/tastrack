USE `task_tracker`;

-- Match TasTrack's established table collation so dynamic catalogue keys can be
-- compared with template field, task and stage keys on MariaDB.
ALTER TABLE `tbl_board_views` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `tbl_board_view_columns` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `tbl_workflow_risk_status` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `tbl_workflow_risk_history` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
