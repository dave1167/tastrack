USE `task_tracker`;

ALTER TABLE `tbl_users`
  ADD COLUMN IF NOT EXISTS `phone` varchar(60) NULL AFTER `displayName`,
  ADD COLUMN IF NOT EXISTS `jobTitle` varchar(120) NULL AFTER `phone`,
  ADD COLUMN IF NOT EXISTS `avatarPath` varchar(500) NULL AFTER `jobTitle`;
