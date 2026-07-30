-- Tenant-configurable event milestones and per-event values.

CREATE TABLE IF NOT EXISTS tbl_event_milestones (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    milestoneName VARCHAR(100) NOT NULL,
    milestoneGroup VARCHAR(100) NOT NULL,
    timingCategory ENUM('before_show','during_show','after_show') NOT NULL DEFAULT 'before_show',
    sourceType ENUM('manual','contract') NOT NULL DEFAULT 'manual',
    displayOrder INT UNSIGNED NOT NULL DEFAULT 100,
    isActive TINYINT(1) NOT NULL DEFAULT 1,
    isDefault TINYINT(1) NOT NULL DEFAULT 0,
    createdByUserId INT UNSIGNED NULL,
    modifiedByUserId INT UNSIGNED NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_event_milestones_tenant_id (tenantId,id),
    UNIQUE KEY uq_event_milestones_tenant_name (tenantId,milestoneName),
    KEY idx_event_milestones_tenant_order (tenantId,isActive,timingCategory,displayOrder),
    CONSTRAINT fk_event_milestones_tenant FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_milestones_created_by FOREIGN KEY (createdByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_event_milestones_modified_by FOREIGN KEY (modifiedByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_event_milestone_options (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    milestoneId INT UNSIGNED NOT NULL,
    optionName VARCHAR(100) NOT NULL,
    displayOrder INT UNSIGNED NOT NULL DEFAULT 100,
    colour CHAR(7) NOT NULL DEFAULT '#6c757d',
    isDefault TINYINT(1) NOT NULL DEFAULT 0,
    isComplete TINYINT(1) NOT NULL DEFAULT 0,
    isActive TINYINT(1) NOT NULL DEFAULT 1,
    createdByUserId INT UNSIGNED NULL,
    modifiedByUserId INT UNSIGNED NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_event_milestone_options_tenant_id (tenantId,id),
    UNIQUE KEY uq_event_milestone_options_name (tenantId,milestoneId,optionName),
    KEY idx_event_milestone_options_order (tenantId,milestoneId,isActive,displayOrder),
    CONSTRAINT fk_event_milestone_options_milestone FOREIGN KEY (tenantId,milestoneId) REFERENCES tbl_event_milestones(tenantId,id),
    CONSTRAINT fk_event_milestone_options_created_by FOREIGN KEY (createdByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_event_milestone_options_modified_by FOREIGN KEY (modifiedByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tbl_workflow_milestone_values (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    workflowId INT UNSIGNED NOT NULL,
    milestoneId INT UNSIGNED NOT NULL,
    optionId INT UNSIGNED NOT NULL,
    notes VARCHAR(500) NULL,
    createdByUserId INT UNSIGNED NULL,
    modifiedByUserId INT UNSIGNED NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_workflow_milestone_value (tenantId,workflowId,milestoneId),
    KEY idx_workflow_milestone_option (tenantId,optionId),
    CONSTRAINT fk_workflow_milestone_workflow FOREIGN KEY (tenantId,workflowId) REFERENCES tbl_workflows(tenantId,id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_milestone_definition FOREIGN KEY (tenantId,milestoneId) REFERENCES tbl_event_milestones(tenantId,id),
    CONSTRAINT fk_workflow_milestone_option FOREIGN KEY (tenantId,optionId) REFERENCES tbl_event_milestone_options(tenantId,id),
    CONSTRAINT fk_workflow_milestone_created_by FOREIGN KEY (createdByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_workflow_milestone_modified_by FOREIGN KEY (modifiedByUserId) REFERENCES tbl_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tbl_event_milestones
    (tenantId,milestoneName,milestoneGroup,timingCategory,sourceType,displayOrder,isActive)
SELECT id,'Contract','Contracts','before_show','contract',10,1 FROM tbl_tenants
UNION ALL SELECT id,'Tickets','Ticketing','before_show','manual',20,1 FROM tbl_tenants
UNION ALL SELECT id,'Marketing','Marketing','before_show','manual',30,1 FROM tbl_tenants
UNION ALL SELECT id,'Show readiness','Production','during_show','manual',40,1 FROM tbl_tenants
UNION ALL SELECT id,'Settlement','Finance','after_show','manual',50,1 FROM tbl_tenants
UNION ALL SELECT id,'Final invoice','Finance','after_show','manual',60,1 FROM tbl_tenants;

INSERT IGNORE INTO tbl_event_milestone_options
    (tenantId,milestoneId,optionName,displayOrder,colour,isDefault,isComplete,isActive)
SELECT m.tenantId,m.id,'Not started',10,'#6c757d',1,0,1 FROM tbl_event_milestones m WHERE m.sourceType='manual'
UNION ALL SELECT m.tenantId,m.id,'In progress',20,'#0d6efd',0,0,1 FROM tbl_event_milestones m WHERE m.sourceType='manual'
UNION ALL SELECT m.tenantId,m.id,'Complete',30,'#198754',0,1,1 FROM tbl_event_milestones m WHERE m.sourceType='manual';

SET @schema_name = DATABASE();

SET @add_milestone_default = (
    SELECT IF(
        COUNT(*)=0,
        'ALTER TABLE tbl_event_milestones ADD COLUMN isDefault TINYINT(1) NOT NULL DEFAULT 0 AFTER isActive',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_event_milestones'
      AND COLUMN_NAME='isDefault'
);
PREPARE add_milestone_default_stmt FROM @add_milestone_default;
EXECUTE add_milestone_default_stmt;
DEALLOCATE PREPARE add_milestone_default_stmt;

UPDATE tbl_event_milestones m
INNER JOIN (
    SELECT tenantId,MIN(id) id
    FROM tbl_event_milestones
    WHERE isActive=1
    GROUP BY tenantId
) firstMilestone ON firstMilestone.id=m.id
SET m.isDefault=1
WHERE NOT EXISTS(
    SELECT 1
    FROM tbl_event_milestones existingDefault
    WHERE existingDefault.tenantId=m.tenantId
      AND existingDefault.isDefault=1
);

SET @add_current_milestone = (
    SELECT IF(
        COUNT(*)=0,
        'ALTER TABLE tbl_workflows ADD COLUMN currentMilestoneId INT UNSIGNED NULL AFTER eventStatusId',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_workflows'
      AND COLUMN_NAME='currentMilestoneId'
);
PREPARE add_current_milestone_stmt FROM @add_current_milestone;
EXECUTE add_current_milestone_stmt;
DEALLOCATE PREPARE add_current_milestone_stmt;

UPDATE tbl_workflows w
INNER JOIN tbl_event_milestones m ON m.tenantId=w.tenantId AND m.isDefault=1
SET w.currentMilestoneId=m.id
WHERE w.currentMilestoneId IS NULL;

SET @add_current_milestone_index = (
    SELECT IF(
        COUNT(*)=0,
        'ALTER TABLE tbl_workflows ADD KEY idx_workflows_current_milestone (tenantId,currentMilestoneId)',
        'SELECT 1'
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_workflows'
      AND INDEX_NAME='idx_workflows_current_milestone'
);
PREPARE add_current_milestone_index_stmt FROM @add_current_milestone_index;
EXECUTE add_current_milestone_index_stmt;
DEALLOCATE PREPARE add_current_milestone_index_stmt;

SET @add_current_milestone_fk = (
    SELECT IF(
        COUNT(*)=0,
        'ALTER TABLE tbl_workflows ADD CONSTRAINT fk_workflows_current_milestone FOREIGN KEY (tenantId,currentMilestoneId) REFERENCES tbl_event_milestones(tenantId,id)',
        'SELECT 1'
    )
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=@schema_name
      AND TABLE_NAME='tbl_workflows'
      AND CONSTRAINT_NAME='fk_workflows_current_milestone'
);
PREPARE add_current_milestone_fk_stmt FROM @add_current_milestone_fk;
EXECUTE add_current_milestone_fk_stmt;
DEALLOCATE PREPARE add_current_milestone_fk_stmt;
