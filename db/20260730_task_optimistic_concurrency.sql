USE `task_tracker`;

SET @add_task_row_version = (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'tbl_tasks'
              AND COLUMN_NAME = 'rowVersion'
        ),
        'SELECT 1',
        'ALTER TABLE tbl_tasks ADD COLUMN rowVersion INT UNSIGNED NOT NULL DEFAULT 1 AFTER modifiedDate'
    )
);

PREPARE add_task_row_version_statement FROM @add_task_row_version;
EXECUTE add_task_row_version_statement;
DEALLOCATE PREPARE add_task_row_version_statement;
