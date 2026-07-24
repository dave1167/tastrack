USE `task_tracker`;

-- Additive location integration. Existing legacy workflow venue values are retained.

ALTER TABLE `tbl_workflows`
  ADD COLUMN `locationId` INT(10) UNSIGNED NULL AFTER `ownerTeamId`,
  ADD COLUMN `spaceId` INT(10) UNSIGNED NULL AFTER `locationId`,
  ADD COLUMN `configurationId` INT(10) UNSIGNED NULL AFTER `spaceId`,
  ADD KEY `idx_tbl_workflows_location` (`tenantId`, `locationId`),
  ADD KEY `idx_tbl_workflows_space` (`tenantId`, `spaceId`),
  ADD KEY `idx_tbl_workflows_configuration` (`tenantId`, `configurationId`),
  ADD CONSTRAINT `fk_tbl_workflows_location`
    FOREIGN KEY (`tenantId`, `locationId`)
    REFERENCES `tbl_locations` (`tenantId`, `id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_tbl_workflows_space`
    FOREIGN KEY (`tenantId`, `spaceId`)
    REFERENCES `tbl_spaces` (`tenantId`, `id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_tbl_workflows_configuration`
    FOREIGN KEY (`tenantId`, `configurationId`)
    REFERENCES `tbl_space_configurations` (`tenantId`, `id`)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE `tbl_tasks`
  ADD COLUMN `locationMode` ENUM('inherit','override') NOT NULL DEFAULT 'inherit' AFTER `assignedToRoleId`,
  ADD COLUMN `locationId` INT(10) UNSIGNED NULL AFTER `locationMode`,
  ADD COLUMN `spaceId` INT(10) UNSIGNED NULL AFTER `locationId`,
  ADD COLUMN `configurationId` INT(10) UNSIGNED NULL AFTER `spaceId`,
  ADD KEY `idx_tbl_tasks_location_mode` (`tenantId`, `locationMode`),
  ADD KEY `idx_tbl_tasks_location` (`tenantId`, `locationId`),
  ADD KEY `idx_tbl_tasks_space` (`tenantId`, `spaceId`),
  ADD KEY `idx_tbl_tasks_configuration` (`tenantId`, `configurationId`),
  ADD CONSTRAINT `fk_tbl_tasks_location`
    FOREIGN KEY (`tenantId`, `locationId`)
    REFERENCES `tbl_locations` (`tenantId`, `id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_tbl_tasks_space`
    FOREIGN KEY (`tenantId`, `spaceId`)
    REFERENCES `tbl_spaces` (`tenantId`, `id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_tbl_tasks_configuration`
    FOREIGN KEY (`tenantId`, `configurationId`)
    REFERENCES `tbl_space_configurations` (`tenantId`, `id`)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- Server Connect update actions clear all three IDs whenever locationMode='inherit'.
-- The relational foreign keys enforce tenant ownership for override selections.
