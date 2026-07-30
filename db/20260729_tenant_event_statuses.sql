-- Tenant-configurable event statuses.
-- The fixed systemCategory drives reporting; statusName is tenant-visible.

CREATE TABLE IF NOT EXISTS tbl_event_statuses (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    statusName VARCHAR(100) NOT NULL,
    systemCategory ENUM('planned','active','on_hold','completed','cancelled','archived') NOT NULL,
    displayOrder INT UNSIGNED NOT NULL DEFAULT 100,
    colour CHAR(7) NOT NULL DEFAULT '#6c757d',
    isActive TINYINT(1) NOT NULL DEFAULT 1,
    isDefault TINYINT(1) NOT NULL DEFAULT 0,
    createdByUserId INT UNSIGNED NULL,
    modifiedByUserId INT UNSIGNED NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_event_statuses_tenant_id (tenantId,id),
    UNIQUE KEY uq_event_statuses_tenant_name (tenantId,statusName),
    KEY idx_event_statuses_tenant_order (tenantId,isActive,displayOrder),
    KEY idx_event_statuses_tenant_category (tenantId,systemCategory),
    CONSTRAINT fk_event_statuses_tenant FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_statuses_created_by FOREIGN KEY (createdByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_event_statuses_modified_by FOREIGN KEY (modifiedByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tbl_event_statuses
    (tenantId,statusName,systemCategory,displayOrder,colour,isActive,isDefault)
SELECT t.id,'Draft','planned',10,'#6c757d',1,0 FROM tbl_tenants t
UNION ALL SELECT t.id,'Not started','planned',20,'#adb5bd',1,1 FROM tbl_tenants t
UNION ALL SELECT t.id,'Active','active',30,'#0d6efd',1,0 FROM tbl_tenants t
UNION ALL SELECT t.id,'In progress','active',40,'#0dcaf0',1,0 FROM tbl_tenants t
UNION ALL SELECT t.id,'Waiting','on_hold',50,'#ffc107',1,0 FROM tbl_tenants t
UNION ALL SELECT t.id,'Complete','completed',60,'#198754',1,0 FROM tbl_tenants t
UNION ALL SELECT t.id,'Cancelled','cancelled',70,'#dc3545',1,0 FROM tbl_tenants t
UNION ALL SELECT t.id,'Archived','archived',80,'#212529',1,0 FROM tbl_tenants t;

SET @schema_name = DATABASE();
SET @add_event_status_id = (
    SELECT IF(
        COUNT(*)=0,
        'ALTER TABLE tbl_workflows ADD COLUMN eventStatusId INT UNSIGNED NULL AFTER workflowTypeId',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_workflows'
      AND COLUMN_NAME='eventStatusId'
);
PREPARE add_event_status_id_stmt FROM @add_event_status_id;
EXECUTE add_event_status_id_stmt;
DEALLOCATE PREPARE add_event_status_id_stmt;

UPDATE tbl_workflows w
INNER JOIN tbl_event_statuses es
    ON es.tenantId=w.tenantId
   AND es.statusName=CASE w.status
       WHEN 'draft' THEN 'Draft'
       WHEN 'active' THEN 'Active'
       WHEN 'in_progress' THEN 'In progress'
       WHEN 'waiting' THEN 'Waiting'
       WHEN 'complete' THEN 'Complete'
       WHEN 'cancelled' THEN 'Cancelled'
       WHEN 'archived' THEN 'Archived'
       ELSE 'Not started'
   END
SET w.eventStatusId=es.id
WHERE w.eventStatusId IS NULL;

UPDATE tbl_workflows w
INNER JOIN tbl_event_statuses es
    ON es.tenantId=w.tenantId
   AND es.isDefault=1
SET w.eventStatusId=es.id
WHERE w.eventStatusId IS NULL;

SET @make_event_status_required = (
    SELECT IF(
        IS_NULLABLE='YES',
        'ALTER TABLE tbl_workflows MODIFY COLUMN eventStatusId INT UNSIGNED NOT NULL',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_workflows'
      AND COLUMN_NAME='eventStatusId'
);
PREPARE make_event_status_required_stmt FROM @make_event_status_required;
EXECUTE make_event_status_required_stmt;
DEALLOCATE PREPARE make_event_status_required_stmt;

SET @add_event_status_index = (
    SELECT IF(
        COUNT(*)=0,
        'ALTER TABLE tbl_workflows ADD KEY idx_workflows_event_status (tenantId,eventStatusId)',
        'SELECT 1'
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_workflows'
      AND INDEX_NAME='idx_workflows_event_status'
);
PREPARE add_event_status_index_stmt FROM @add_event_status_index;
EXECUTE add_event_status_index_stmt;
DEALLOCATE PREPARE add_event_status_index_stmt;

SET @add_event_status_fk = (
    SELECT IF(
        COUNT(*)=0,
        'ALTER TABLE tbl_workflows ADD CONSTRAINT fk_workflows_event_status FOREIGN KEY (tenantId,eventStatusId) REFERENCES tbl_event_statuses(tenantId,id)',
        'SELECT 1'
    )
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_workflows'
      AND CONSTRAINT_NAME='fk_workflows_event_status'
);
PREPARE add_event_status_fk_stmt FROM @add_event_status_fk;
EXECUTE add_event_status_fk_stmt;
DEALLOCATE PREPARE add_event_status_fk_stmt;

SET @add_event_status_tenant_key = (
    SELECT IF(
        COUNT(*)=0,
        'ALTER TABLE tbl_event_statuses ADD UNIQUE KEY uq_event_statuses_tenant_id (tenantId,id)',
        'SELECT 1'
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_event_statuses'
      AND INDEX_NAME='uq_event_statuses_tenant_id'
);
PREPARE add_event_status_tenant_key_stmt FROM @add_event_status_tenant_key;
EXECUTE add_event_status_tenant_key_stmt;
DEALLOCATE PREPARE add_event_status_tenant_key_stmt;

SET @replace_event_status_fk = (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE CONSTRAINT_SCHEMA=@schema_name
              AND TABLE_NAME='tbl_workflows'
              AND CONSTRAINT_NAME='fk_workflows_event_status'
              AND COLUMN_NAME='tenantId'
        ),
        'SELECT 1',
        'ALTER TABLE tbl_workflows DROP FOREIGN KEY fk_workflows_event_status, ADD CONSTRAINT fk_workflows_event_status FOREIGN KEY (tenantId,eventStatusId) REFERENCES tbl_event_statuses(tenantId,id)'
    )
);
PREPARE replace_event_status_fk_stmt FROM @replace_event_status_fk;
EXECUTE replace_event_status_fk_stmt;
DEALLOCATE PREPARE replace_event_status_fk_stmt;
