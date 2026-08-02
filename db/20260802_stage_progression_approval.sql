USE `task_tracker`;

-- Stage completion is deliberately separated from stage progression.
-- Repeat-safe so it can be applied through Wappler Database Manager or DBeaver.

SET @schemaName = DATABASE();

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schemaName AND TABLE_NAME='tbl_template_stages' AND COLUMN_NAME='nextStageTemplateId')=0,
  'ALTER TABLE tbl_template_stages ADD COLUMN nextStageTemplateId INT UNSIGNED NULL AFTER requiresAllTasksComplete, ADD COLUMN requiresProgressionApproval TINYINT(1) NOT NULL DEFAULT 1 AFTER nextStageTemplateId, ADD COLUMN allowManualOverride TINYINT(1) NOT NULL DEFAULT 0 AFTER requiresProgressionApproval, ADD COLUMN approvalPrompt VARCHAR(500) NULL AFTER allowManualOverride, ADD INDEX idx_template_stage_next (tenantId,templateId,nextStageTemplateId)',
  'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schemaName AND TABLE_NAME='tbl_workflow_stages' AND COLUMN_NAME='nextWorkflowStageId')=0,
  'ALTER TABLE tbl_workflow_stages ADD COLUMN nextWorkflowStageId INT UNSIGNED NULL AFTER sourceTemplateStageId, ADD COLUMN requiresProgressionApproval TINYINT(1) NOT NULL DEFAULT 1 AFTER nextWorkflowStageId, ADD COLUMN allowManualOverride TINYINT(1) NOT NULL DEFAULT 0 AFTER requiresProgressionApproval, ADD COLUMN approvalPrompt VARCHAR(500) NULL AFTER allowManualOverride, ADD INDEX idx_workflow_stage_next (tenantId,workflowId,nextWorkflowStageId)',
  'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Existing isRequired is the canonical "required for stage completion" flag.
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schemaName AND TABLE_NAME='tbl_template_tasks' AND COLUMN_NAME='responseRequired')=0,
  'ALTER TABLE tbl_template_tasks ADD COLUMN responseRequired TINYINT(1) NOT NULL DEFAULT 0 AFTER isRequired, ADD COLUMN responseType VARCHAR(30) NULL AFTER responseRequired',
  'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schemaName AND TABLE_NAME='tbl_tasks' AND COLUMN_NAME='responseRequired')=0,
  'ALTER TABLE tbl_tasks ADD COLUMN responseRequired TINYINT(1) NOT NULL DEFAULT 0 AFTER isRequired, ADD COLUMN responseType VARCHAR(30) NULL AFTER responseRequired, ADD COLUMN responseValue TEXT NULL AFTER responseType, ADD COLUMN wasBypassedOnStageProgression TINYINT(1) NOT NULL DEFAULT 0 AFTER responseValue',
  'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS tbl_record_stage_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenantId INT UNSIGNED NOT NULL,
  workflowId INT UNSIGNED NOT NULL,
  workflowTemplateId INT UNSIGNED NULL,
  fromStageId INT UNSIGNED NULL,
  toStageId INT UNSIGNED NOT NULL,
  transitionType VARCHAR(30) NOT NULL,
  readinessResult VARCHAR(30) NOT NULL,
  approvedByUserId INT UNSIGNED NOT NULL,
  approvalComment TEXT NULL,
  overrideReason TEXT NULL,
  blockingTaskCount INT UNSIGNED NOT NULL DEFAULT 0,
  onHoldTaskCount INT UNSIGNED NOT NULL DEFAULT 0,
  missingResponseCount INT UNSIGNED NOT NULL DEFAULT 0,
  transitionDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stage_history_record (tenantId,workflowId,transitionDate),
  KEY idx_stage_history_actor (tenantId,approvedByUserId,transitionDate),
  CONSTRAINT fk_stage_history_tenant FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id),
  CONSTRAINT fk_stage_history_workflow FOREIGN KEY (workflowId) REFERENCES tbl_workflows(id),
  CONSTRAINT fk_stage_history_actor FOREIGN KEY (approvedByUserId) REFERENCES tbl_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tbl_permissions
  (permissionCode,permissionKey,permissionName,permissionDescription,permissionScope,permissionGroup,isSensitive,isAssignable,description,isActive)
VALUES
  ('team.workflow.stage.approve','team.workflow.stage.approve','Approve stage progression','Approve a ready workflow stage within an authorised team.','team','workflows',0,1,'Approve a ready workflow stage within an authorised team.',1),
  ('tenant.workflow.stage.approve','tenant.workflow.stage.approve','Approve tenant stage progression','Approve a ready workflow stage across the tenant.','tenant','workflows',0,1,'Approve a ready workflow stage across the tenant.',1),
  ('team.workflow.stage.override','team.workflow.stage.override','Override stage requirements','Bypass stage requirements within an authorised team.','team','workflows',1,1,'Sensitive: bypass stage requirements within an authorised team.',1),
  ('tenant.workflow.stage.override','tenant.workflow.stage.override','Override tenant stage requirements','Bypass stage requirements across the tenant.','tenant','workflows',1,1,'Sensitive: bypass stage requirements across the tenant.',1)
ON DUPLICATE KEY UPDATE permissionName=VALUES(permissionName),permissionDescription=VALUES(permissionDescription),permissionScope=VALUES(permissionScope),permissionGroup=VALUES(permissionGroup),isSensitive=VALUES(isSensitive),isActive=1;

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r CROSS JOIN tbl_permissions p
WHERE r.roleKey='owner' AND p.permissionCode IN ('team.workflow.stage.approve','tenant.workflow.stage.approve','team.workflow.stage.override','tenant.workflow.stage.override');

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id FROM tbl_roles r CROSS JOIN tbl_permissions p
WHERE r.roleKey IN ('admin','department_head') AND p.permissionCode IN ('team.workflow.stage.approve','tenant.workflow.stage.approve');

-- Default existing templates to their next active stage while retaining explicit configurability.
UPDATE tbl_template_stages currentStage
SET currentStage.nextStageTemplateId=(
  SELECT nextStage.id FROM tbl_template_stages nextStage
  WHERE nextStage.tenantId=currentStage.tenantId AND nextStage.templateId=currentStage.templateId
    AND nextStage.status='active' AND nextStage.sortOrder>currentStage.sortOrder
  ORDER BY nextStage.sortOrder,nextStage.id LIMIT 1
)
WHERE currentStage.nextStageTemplateId IS NULL;

UPDATE tbl_workflow_stages currentStage
SET currentStage.nextWorkflowStageId=(
  SELECT nextStage.id FROM tbl_workflow_stages nextStage
  WHERE nextStage.tenantId=currentStage.tenantId AND nextStage.workflowId=currentStage.workflowId
    AND nextStage.sortOrder>currentStage.sortOrder
  ORDER BY nextStage.sortOrder,nextStage.id LIMIT 1
)
WHERE currentStage.nextWorkflowStageId IS NULL;

