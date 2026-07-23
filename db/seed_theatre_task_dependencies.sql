USE `task_tracker`;

SET @templateId := (
  SELECT id FROM tbl_workflow_templates
  WHERE TRIM(templateName)='Main House Standard Show' AND status='published'
  ORDER BY id DESC LIMIT 1
);
SET @tenantId := (SELECT tenantId FROM tbl_workflow_templates WHERE id=@templateId);

-- Template dependencies affect workflows created from this template in future.
INSERT INTO tbl_template_task_dependencies
  (tenantId,templateId,templateTaskId,dependsOnTemplateTaskId,dependencyType)
SELECT @tenantId,@templateId,task.id,prerequisite.id,'finish_to_start'
FROM (
  SELECT 'Receive Jotform' taskName,'Issue Jotform' prerequisiteName UNION ALL
  SELECT 'Confirm show information','Receive Jotform' UNION ALL
  SELECT 'Confirm deal','Confirm show information' UNION ALL
  SELECT 'Issue contract','Confirm deal' UNION ALL
  SELECT 'Receive signed contract','Issue contract' UNION ALL
  SELECT 'Put show on sale','Receive signed contract' UNION ALL
  SELECT 'Issue settlement statement','Put show on sale' UNION ALL
  SELECT 'Receive invoice','Issue settlement statement' UNION ALL
  SELECT 'Make payment','Receive invoice' UNION ALL
  SELECT 'Review final comments','Make payment' UNION ALL
  SELECT 'Review final comments','Record seats sold'
) chain
INNER JOIN tbl_template_tasks task
  ON task.tenantId=@tenantId AND task.templateId=@templateId AND task.taskName=chain.taskName
INNER JOIN tbl_template_tasks prerequisite
  ON prerequisite.tenantId=@tenantId AND prerequisite.templateId=@templateId AND prerequisite.taskName=chain.prerequisiteName
WHERE @templateId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tbl_template_task_dependencies d
    WHERE d.tenantId=@tenantId AND d.templateId=@templateId
      AND d.templateTaskId=task.id AND d.dependsOnTemplateTaskId=prerequisite.id
  );

-- Backfill matching dependencies into every existing live workflow from the template.
INSERT INTO tbl_task_dependencies
  (tenantId,workflowId,taskId,dependsOnTaskId,dependencyType)
SELECT w.tenantId,w.id,task.id,prerequisite.id,td.dependencyType
FROM tbl_workflows w
INNER JOIN tbl_template_task_dependencies td
  ON td.tenantId=w.tenantId AND td.templateId=w.templateId
INNER JOIN tbl_tasks task
  ON task.tenantId=w.tenantId AND task.workflowId=w.id AND task.sourceTemplateTaskId=td.templateTaskId
INNER JOIN tbl_tasks prerequisite
  ON prerequisite.tenantId=w.tenantId AND prerequisite.workflowId=w.id AND prerequisite.sourceTemplateTaskId=td.dependsOnTemplateTaskId
WHERE w.tenantId=@tenantId AND w.templateId=@templateId
  AND NOT EXISTS (
    SELECT 1 FROM tbl_task_dependencies d
    WHERE d.tenantId=w.tenantId AND d.workflowId=w.id
      AND d.taskId=task.id AND d.dependsOnTaskId=prerequisite.id
  );

SELECT task.taskName,prerequisite.taskName AS dependsOnTask,td.dependencyType
FROM tbl_template_task_dependencies td
INNER JOIN tbl_template_tasks task ON task.id=td.templateTaskId AND task.tenantId=td.tenantId
INNER JOIN tbl_template_tasks prerequisite ON prerequisite.id=td.dependsOnTemplateTaskId AND prerequisite.tenantId=td.tenantId
WHERE td.tenantId=@tenantId AND td.templateId=@templateId
ORDER BY task.templateStageId,task.sortOrder;
