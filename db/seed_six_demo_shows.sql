USE `task_tracker`;

-- Six repeatable theatre demo records for the configurable workflow board.
-- References DEMO-SHOW-001 through DEMO-SHOW-006 make this script idempotent.
SET @templateId := (
  SELECT id FROM tbl_workflow_templates
  WHERE TRIM(templateName)='Main House Standard Show' AND status='published'
  ORDER BY id DESC LIMIT 1
);
SET @tenantId := (SELECT tenantId FROM tbl_workflow_templates WHERE id=@templateId);
SET @templateVersion := (SELECT versionNumber FROM tbl_workflow_templates WHERE id=@templateId);
SET @ownerUserId := COALESCE(
  (SELECT ownerUserId FROM tbl_workflows WHERE tenantId=@tenantId AND ownerUserId IS NOT NULL ORDER BY id LIMIT 1),
  (SELECT createdByUserId FROM tbl_workflow_templates WHERE id=@templateId),
  (SELECT userId FROM tbl_user_tenant_roles WHERE tenantId=@tenantId AND isActive=1 ORDER BY id LIMIT 1)
);
SET @ownerTeamId := (SELECT id FROM tbl_teams WHERE tenantId=@tenantId AND isActive=1 ORDER BY id LIMIT 1);

INSERT INTO tbl_workflows
  (tenantId,templateId,templateVersionNumber,workflowName,referenceCode,status,ownerUserId,ownerTeamId,startDate,targetDate,createdByUserId)
SELECT @tenantId,@templateId,@templateVersion,d.workflowName,d.referenceCode,d.status,@ownerUserId,@ownerTeamId,d.startDate,d.targetDate,@ownerUserId
FROM (
  SELECT 'The Northern Lights' workflowName,'DEMO-SHOW-001' referenceCode,'in_progress' status,DATE_ADD(CURRENT_DATE,INTERVAL 5 DAY) startDate,DATE_ADD(CURRENT_DATE,INTERVAL 45 DAY) targetDate UNION ALL
  SELECT 'Comedy Gala Live','DEMO-SHOW-002','in_progress',DATE_ADD(CURRENT_DATE,INTERVAL 2 DAY),DATE_ADD(CURRENT_DATE,INTERVAL 18 DAY) UNION ALL
  SELECT 'A Midsummer Night''s Dream','DEMO-SHOW-003','in_progress',DATE_SUB(CURRENT_DATE,INTERVAL 20 DAY),DATE_ADD(CURRENT_DATE,INTERVAL 10 DAY) UNION ALL
  SELECT 'The Electric Ballroom','DEMO-SHOW-004','in_progress',DATE_SUB(CURRENT_DATE,INTERVAL 7 DAY),DATE_ADD(CURRENT_DATE,INTERVAL 24 DAY) UNION ALL
  SELECT 'Community Showcase 2026','DEMO-SHOW-005','not_started',CURRENT_DATE,NULL UNION ALL
  SELECT 'Jazz at Midnight','DEMO-SHOW-006','in_progress',DATE_SUB(CURRENT_DATE,INTERVAL 30 DAY),DATE_ADD(CURRENT_DATE,INTERVAL 60 DAY)
) d
WHERE @templateId IS NOT NULL AND @ownerUserId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tbl_workflows w
    WHERE w.tenantId=@tenantId AND w.referenceCode=d.referenceCode
  );

-- Snapshot active template stages into each new demo workflow.
INSERT INTO tbl_workflow_stages
  (tenantId,workflowId,sourceTemplateStageId,stageName,description,sortOrder,status,colour)
SELECT w.tenantId,w.id,s.id,s.stageName,s.description,s.sortOrder,'not_started',s.colour
FROM tbl_workflows w
INNER JOIN tbl_template_stages s
  ON s.tenantId=w.tenantId AND s.templateId=w.templateId AND s.status='active'
WHERE w.tenantId=@tenantId AND w.referenceCode LIKE 'DEMO-SHOW-00_'
  AND NOT EXISTS (
    SELECT 1 FROM tbl_workflow_stages ws
    WHERE ws.tenantId=w.tenantId AND ws.workflowId=w.id AND ws.sourceTemplateStageId=s.id
  );

-- Snapshot active template tasks. Default due dates are spread ahead of the show date.
INSERT INTO tbl_tasks
  (tenantId,workflowId,workflowStageId,sourceTemplateTaskId,taskName,description,status,priority,isRequired,assignedToUserId,assignedToTeamId,assignedToRoleId,dueDate,createdByUserId)
SELECT w.tenantId,w.id,ws.id,tt.id,tt.taskName,tt.description,'not_started',tt.priority,tt.isRequired,
  CASE WHEN tt.defaultOwnerType IN ('workflow_owner','specific_user') THEN COALESCE(tt.defaultOwnerId,w.ownerUserId) ELSE NULL END,
  CASE WHEN tt.defaultOwnerType='team' THEN tt.defaultOwnerId ELSE NULL END,
  CASE WHEN tt.defaultOwnerType='role' THEN tt.defaultOwnerId ELSE NULL END,
  CASE WHEN w.targetDate IS NULL THEN NULL ELSE DATE_SUB(w.targetDate,INTERVAL GREATEST(3,35-(ws.sortOrder*5)-(tt.sortOrder*2)) DAY) END,
  @ownerUserId
FROM tbl_workflows w
INNER JOIN tbl_template_tasks tt
  ON tt.tenantId=w.tenantId AND tt.templateId=w.templateId AND tt.status='active'
INNER JOIN tbl_workflow_stages ws
  ON ws.tenantId=w.tenantId AND ws.workflowId=w.id AND ws.sourceTemplateStageId=tt.templateStageId
WHERE w.tenantId=@tenantId AND w.referenceCode LIKE 'DEMO-SHOW-00_'
  AND NOT EXISTS (
    SELECT 1 FROM tbl_tasks t
    WHERE t.tenantId=w.tenantId AND t.workflowId=w.id AND t.sourceTemplateTaskId=tt.id
  );

-- Snapshot configurable fields, then populate the theatre template values.
INSERT INTO tbl_workflow_field_values (tenantId,workflowId,templateCustomFieldId,fieldKey)
SELECT w.tenantId,w.id,f.id,f.fieldKey
FROM tbl_workflows w
INNER JOIN tbl_template_custom_fields f
  ON f.tenantId=w.tenantId AND f.templateId=w.templateId AND f.status='active'
WHERE w.tenantId=@tenantId AND w.referenceCode LIKE 'DEMO-SHOW-00_'
  AND NOT EXISTS (
    SELECT 1 FROM tbl_workflow_field_values v
    WHERE v.tenantId=w.tenantId AND v.workflowId=w.id AND v.templateCustomFieldId=f.id
  );

UPDATE tbl_workflow_field_values v
INNER JOIN tbl_workflows w ON w.id=v.workflowId AND w.tenantId=v.tenantId
SET
  v.valueText=CASE v.fieldKey
    WHEN 'show_name' THEN w.workflowName
    WHEN 'venue' THEN CASE w.referenceCode
      WHEN 'DEMO-SHOW-001' THEN 'Main House'
      WHEN 'DEMO-SHOW-002' THEN 'Main House'
      WHEN 'DEMO-SHOW-003' THEN 'Studio Theatre'
      WHEN 'DEMO-SHOW-004' THEN 'Main House'
      WHEN 'DEMO-SHOW-005' THEN 'Community Hall'
      WHEN 'DEMO-SHOW-006' THEN 'Studio Theatre' END
    WHEN 'contact_email' THEN CONCAT(LOWER(REPLACE(SUBSTRING_INDEX(w.workflowName,' ',2),' ','.')),'@example.test')
    WHEN 'event_type' THEN CASE WHEN w.referenceCode='DEMO-SHOW-005' THEN 'Workshop / community event' ELSE 'Performance' END
    WHEN 'deal' THEN CASE WHEN w.referenceCode IN ('DEMO-SHOW-002','DEMO-SHOW-004') THEN 'Guarantee plus box-office split' ELSE 'Fixed guarantee' END
    WHEN 'marketing_lead' THEN CASE WHEN w.referenceCode IN ('DEMO-SHOW-001','DEMO-SHOW-006') THEN 'Alex Morgan' ELSE 'Jamie Patel' END
    WHEN 'comments' THEN 'Demonstration record generated for board and risk testing.'
    ELSE v.valueText END,
  v.valueDate=CASE v.fieldKey
    WHEN 'show_date' THEN w.targetDate
    WHEN 'announcement_embargo_date' THEN DATE_SUB(w.targetDate,INTERVAL 35 DAY)
    WHEN 'on_sale_date' THEN DATE_SUB(w.targetDate,INTERVAL 28 DAY)
    ELSE v.valueDate END,
  v.valueBoolean=CASE v.fieldKey
    WHEN 'deposit_required' THEN IF(w.referenceCode IN ('DEMO-SHOW-002','DEMO-SHOW-004'),1,0)
    WHEN 'include_new_on_sale' THEN 1
    WHEN 'social_post_required' THEN IF(w.referenceCode<>'DEMO-SHOW-005',1,0)
    WHEN 'accommodation_required' THEN IF(w.referenceCode IN ('DEMO-SHOW-003','DEMO-SHOW-006'),1,0)
    ELSE v.valueBoolean END,
  v.modifiedDate=CURRENT_TIMESTAMP
WHERE w.tenantId=@tenantId AND w.referenceCode LIKE 'DEMO-SHOW-00_';

-- Establish deliberately varied progress and RAG outcomes.
-- 001: green/on track; initial tasks complete, remaining work safely in the future.
UPDATE tbl_tasks t INNER JOIN tbl_workflows w ON w.id=t.workflowId AND w.tenantId=t.tenantId
SET t.status=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract'),'complete','not_started'),
    t.completedDate=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract'),CURRENT_TIMESTAMP,NULL),
    t.dueDate=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract'),DATE_SUB(CURRENT_DATE,INTERVAL 2 DAY),DATE_ADD(CURRENT_DATE,INTERVAL 14 DAY))
WHERE w.referenceCode='DEMO-SHOW-001';

-- 002: amber; a high-priority contract task is due in three days.
UPDATE tbl_tasks t INNER JOIN tbl_workflows w ON w.id=t.workflowId AND w.tenantId=t.tenantId
SET t.status=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract'),'complete','not_started'),
    t.completedDate=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract'),CURRENT_TIMESTAMP,NULL),
    t.dueDate=CASE WHEN t.taskName='Receive signed contract' THEN DATE_ADD(CURRENT_DATE,INTERVAL 3 DAY) ELSE DATE_ADD(CURRENT_DATE,INTERVAL 12 DAY) END
WHERE w.referenceCode='DEMO-SHOW-002';

-- 003: red; a high-priority signed-contract task is overdue.
UPDATE tbl_tasks t INNER JOIN tbl_workflows w ON w.id=t.workflowId AND w.tenantId=t.tenantId
SET t.status=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract'),'complete','not_started'),
    t.completedDate=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract'),CURRENT_TIMESTAMP,NULL),
    t.dueDate=CASE WHEN t.taskName='Receive signed contract' THEN DATE_SUB(CURRENT_DATE,INTERVAL 4 DAY) ELSE DATE_ADD(CURRENT_DATE,INTERVAL 9 DAY) END
WHERE w.referenceCode='DEMO-SHOW-003';

-- 004: red; Wappler's existing waiting status represents an externally blocked task.
UPDATE tbl_tasks t INNER JOIN tbl_workflows w ON w.id=t.workflowId AND w.tenantId=t.tenantId
SET t.status=CASE WHEN t.taskName='Confirm show information' THEN 'waiting' WHEN t.taskName IN ('Issue Jotform','Receive Jotform') THEN 'complete' ELSE 'not_started' END,
    t.completedDate=IF(t.taskName IN ('Issue Jotform','Receive Jotform'),CURRENT_TIMESTAMP,NULL),
    t.dueDate=CASE WHEN t.taskName='Confirm show information' THEN DATE_SUB(CURRENT_DATE,INTERVAL 1 DAY) ELSE DATE_ADD(CURRENT_DATE,INTERVAL 15 DAY) END
WHERE w.referenceCode='DEMO-SHOW-004';

-- 005: grey; not started and intentionally has no target date or task deadlines.
UPDATE tbl_tasks t INNER JOIN tbl_workflows w ON w.id=t.workflowId AND w.tenantId=t.tenantId
SET t.status='not_started',t.completedDate=NULL,t.dueDate=NULL
WHERE w.referenceCode='DEMO-SHOW-005';

-- 006: green; contracting complete with later delivery tasks ahead.
UPDATE tbl_tasks t INNER JOIN tbl_workflows w ON w.id=t.workflowId AND w.tenantId=t.tenantId
SET t.status=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract','Receive signed contract'),'complete','not_started'),
    t.completedDate=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract','Receive signed contract'),CURRENT_TIMESTAMP,NULL),
    t.dueDate=IF(t.taskName IN ('Issue Jotform','Receive Jotform','Confirm show information','Confirm deal','Issue contract','Receive signed contract'),DATE_SUB(CURRENT_DATE,INTERVAL 7 DAY),DATE_ADD(CURRENT_DATE,INTERVAL 21 DAY))
WHERE w.referenceCode='DEMO-SHOW-006';

-- Roll up stages and point each workflow at its first incomplete stage.
UPDATE tbl_workflow_stages ws
SET ws.status=CASE
  WHEN NOT EXISTS (SELECT 1 FROM tbl_tasks t WHERE t.workflowStageId=ws.id AND t.tenantId=ws.tenantId) THEN 'not_started'
  WHEN NOT EXISTS (SELECT 1 FROM tbl_tasks t WHERE t.workflowStageId=ws.id AND t.tenantId=ws.tenantId AND t.status NOT IN ('complete','skipped','cancelled')) THEN 'complete'
  WHEN EXISTS (SELECT 1 FROM tbl_tasks t WHERE t.workflowStageId=ws.id AND t.tenantId=ws.tenantId AND t.status IN ('complete','in_progress','waiting')) THEN 'in_progress'
  ELSE 'not_started' END,
  ws.modifiedDate=CURRENT_TIMESTAMP
WHERE ws.tenantId=@tenantId
  AND EXISTS (SELECT 1 FROM tbl_workflows w WHERE w.id=ws.workflowId AND w.tenantId=ws.tenantId AND w.referenceCode LIKE 'DEMO-SHOW-00_');

UPDATE tbl_workflows w
SET w.currentStageId=(
      SELECT ws.id FROM tbl_workflow_stages ws
      WHERE ws.workflowId=w.id AND ws.tenantId=w.tenantId AND ws.status<>'complete'
      ORDER BY ws.sortOrder,ws.id LIMIT 1
    ),
    w.modifiedDate=CURRENT_TIMESTAMP
WHERE w.tenantId=@tenantId AND w.referenceCode LIKE 'DEMO-SHOW-00_';

SELECT id,workflowName,referenceCode,status,targetDate
FROM tbl_workflows
WHERE tenantId=@tenantId AND referenceCode LIKE 'DEMO-SHOW-00_'
ORDER BY referenceCode;
