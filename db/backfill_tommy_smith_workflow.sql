USE `task_tracker`;

SET @workflowId := (SELECT id FROM tbl_workflows WHERE workflowName='Tommy Smith A New World' AND tenantId=6 ORDER BY id DESC LIMIT 1);
SET @tenantId := (SELECT tenantId FROM tbl_workflows WHERE id=@workflowId);
SET @templateId := (SELECT templateId FROM tbl_workflows WHERE id=@workflowId);
SET @ownerUserId := (SELECT ownerUserId FROM tbl_workflows WHERE id=@workflowId);
SET @startDate := (SELECT startDate FROM tbl_workflows WHERE id=@workflowId);
SET @targetDate := (SELECT targetDate FROM tbl_workflows WHERE id=@workflowId);

UPDATE tbl_workflow_stages ws
LEFT JOIN tbl_template_stages s ON s.id=ws.sourceTemplateStageId AND s.tenantId=ws.tenantId
SET ws.sortOrder=ws.sortOrder+100,ws.modifiedDate=CURRENT_TIMESTAMP
WHERE ws.workflowId=@workflowId AND ws.tenantId=@tenantId
  AND (s.id IS NULL OR s.status<>'active') AND ws.sortOrder<100;

DELETE ws FROM tbl_workflow_stages ws
LEFT JOIN tbl_template_stages s ON s.id=ws.sourceTemplateStageId AND s.tenantId=ws.tenantId
LEFT JOIN tbl_tasks t ON t.workflowStageId=ws.id AND t.tenantId=ws.tenantId
WHERE ws.workflowId=@workflowId AND ws.tenantId=@tenantId
  AND (s.id IS NULL OR s.status<>'active') AND t.id IS NULL;

INSERT INTO tbl_workflow_stages
  (tenantId,workflowId,sourceTemplateStageId,stageName,description,sortOrder,status,colour)
SELECT @tenantId,@workflowId,s.id,s.stageName,s.description,s.sortOrder,'not_started',s.colour
FROM tbl_template_stages s
WHERE s.templateId=@templateId AND s.tenantId=@tenantId AND s.status='active'
  AND NOT EXISTS (
    SELECT 1 FROM tbl_workflow_stages ws
    WHERE ws.tenantId=@tenantId AND ws.workflowId=@workflowId AND ws.sourceTemplateStageId=s.id
  );

INSERT INTO tbl_tasks
  (tenantId,workflowId,workflowStageId,sourceTemplateTaskId,taskName,description,status,priority,isRequired,assignedToUserId,assignedToTeamId,assignedToRoleId,dueDate,createdByUserId)
SELECT @tenantId,@workflowId,ws.id,tt.id,tt.taskName,tt.description,'not_started',tt.priority,tt.isRequired,
  CASE WHEN tt.defaultOwnerType='workflow_owner' THEN @ownerUserId WHEN tt.defaultOwnerType='specific_user' THEN tt.defaultOwnerId ELSE NULL END,
  CASE WHEN tt.defaultOwnerType='team' THEN tt.defaultOwnerId ELSE NULL END,
  CASE WHEN tt.defaultOwnerType='role' THEN tt.defaultOwnerId ELSE NULL END,
  CASE tt.dueOffsetType
    WHEN 'workflow_creation_date' THEN DATE_ADD(CURRENT_DATE,INTERVAL (CASE WHEN tt.dueRelation='before' THEN -1 ELSE 1 END)*COALESCE(tt.dueOffsetDays,0) DAY)
    WHEN 'workflow_start_date' THEN DATE_ADD(@startDate,INTERVAL (CASE WHEN tt.dueRelation='before' THEN -1 ELSE 1 END)*COALESCE(tt.dueOffsetDays,0) DAY)
    WHEN 'event_target_date' THEN DATE_ADD(@targetDate,INTERVAL (CASE WHEN tt.dueRelation='before' THEN -1 ELSE 1 END)*COALESCE(tt.dueOffsetDays,0) DAY)
    ELSE NULL
  END,
  @ownerUserId
FROM tbl_template_tasks tt
INNER JOIN tbl_workflow_stages ws
  ON ws.workflowId=@workflowId AND ws.tenantId=@tenantId AND ws.sourceTemplateStageId=tt.templateStageId
WHERE tt.templateId=@templateId AND tt.tenantId=@tenantId AND tt.status='active'
  AND NOT EXISTS (
    SELECT 1 FROM tbl_tasks t
    WHERE t.tenantId=@tenantId AND t.workflowId=@workflowId AND t.sourceTemplateTaskId=tt.id
  );

INSERT INTO tbl_workflow_field_values (tenantId,workflowId,templateCustomFieldId,fieldKey)
SELECT @tenantId,@workflowId,f.id,f.fieldKey
FROM tbl_template_custom_fields f
WHERE f.templateId=@templateId AND f.tenantId=@tenantId AND f.status='active'
  AND NOT EXISTS (
    SELECT 1 FROM tbl_workflow_field_values v
    WHERE v.tenantId=@tenantId AND v.workflowId=@workflowId AND v.templateCustomFieldId=f.id
  );

UPDATE tbl_workflows w
SET w.status='not_started',
    w.currentStageId=(SELECT ws.id FROM tbl_workflow_stages ws WHERE ws.workflowId=w.id AND ws.tenantId=w.tenantId AND ws.sourceTemplateStageId IS NOT NULL ORDER BY ws.sortOrder,ws.id LIMIT 1),
    w.completedDate=NULL,
    w.modifiedDate=CURRENT_TIMESTAMP
WHERE w.id=@workflowId AND w.tenantId=@tenantId;
