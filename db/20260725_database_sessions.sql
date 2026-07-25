USE `task_tracker`;

CREATE TABLE IF NOT EXISTS `tbl_sessions` (
  `sid` varchar(255) NOT NULL,
  `sess` json NOT NULL,
  `expired` datetime NOT NULL,
  PRIMARY KEY (`sid`),
  KEY `idx_sessions_expired` (`expired`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
