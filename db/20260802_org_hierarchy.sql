USE `task_tracker`;

ALTER TABLE `tbl_user_tenants`
  ADD COLUMN IF NOT EXISTS `positionLevel` varchar(30) NOT NULL DEFAULT 'team_member' AFTER `membershipStatus`,
  ADD COLUMN IF NOT EXISTS `reportsToUserId` bigint unsigned NULL AFTER `positionLevel`;

CREATE INDEX `idx_user_tenants_hierarchy` ON `tbl_user_tenants` (`tenantId`,`positionLevel`,`reportsToUserId`);
