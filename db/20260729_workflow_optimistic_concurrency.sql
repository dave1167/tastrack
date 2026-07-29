-- Initial optimistic-concurrency protection for events/bookings (tbl_workflows).
-- Safe to run repeatedly in Development, Staging and Production.

SET @schema_name = DATABASE();

SET @add_row_version = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE tbl_workflows ADD COLUMN rowVersion INT UNSIGNED NOT NULL DEFAULT 1 AFTER modifiedDate',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'tbl_workflows'
      AND COLUMN_NAME = 'rowVersion'
);
PREPARE add_row_version_stmt FROM @add_row_version;
EXECUTE add_row_version_stmt;
DEALLOCATE PREPARE add_row_version_stmt;

SET @add_modified_by = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE tbl_workflows ADD COLUMN modifiedByUserId INT UNSIGNED NULL AFTER modifiedDate',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'tbl_workflows'
      AND COLUMN_NAME = 'modifiedByUserId'
);
PREPARE add_modified_by_stmt FROM @add_modified_by;
EXECUTE add_modified_by_stmt;
DEALLOCATE PREPARE add_modified_by_stmt;

SET @add_modified_by_index = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE tbl_workflows ADD KEY idx_workflows_modified_by (modifiedByUserId)',
        'SELECT 1'
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'tbl_workflows'
      AND INDEX_NAME = 'idx_workflows_modified_by'
);
PREPARE add_modified_by_index_stmt FROM @add_modified_by_index;
EXECUTE add_modified_by_index_stmt;
DEALLOCATE PREPARE add_modified_by_index_stmt;

SET @add_modified_by_fk = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE tbl_workflows ADD CONSTRAINT fk_workflows_modified_by_user FOREIGN KEY (modifiedByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL',
        'SELECT 1'
    )
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = @schema_name
      AND TABLE_NAME = 'tbl_workflows'
      AND CONSTRAINT_NAME = 'fk_workflows_modified_by_user'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
PREPARE add_modified_by_fk_stmt FROM @add_modified_by_fk;
EXECUTE add_modified_by_fk_stmt;
DEALLOCATE PREPARE add_modified_by_fk_stmt;
