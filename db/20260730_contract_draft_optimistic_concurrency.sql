-- Optimistic concurrency for editable contract drafts.

SET @schema_name = DATABASE();
SET @add_contract_row_version = (
    SELECT IF(
        COUNT(*)=0,
        'ALTER TABLE tbl_generated_contracts ADD COLUMN rowVersion INT UNSIGNED NOT NULL DEFAULT 1 AFTER draftModifiedDate',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_generated_contracts'
      AND COLUMN_NAME='rowVersion'
);
PREPARE add_contract_row_version_stmt FROM @add_contract_row_version;
EXECUTE add_contract_row_version_stmt;
DEALLOCATE PREPARE add_contract_row_version_stmt;
