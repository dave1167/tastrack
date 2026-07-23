USE `task_tracker`;

SET @sourceTemplateId := (SELECT id FROM tbl_workflow_templates WHERE templateName='Main House Standard Show ' ORDER BY id DESC LIMIT 1);
SET @tenantId := (SELECT tenantId FROM tbl_workflow_templates WHERE id=@sourceTemplateId);

INSERT INTO tbl_workflow_templates
  (tenantId,templateName,templateKey,description,versionNumber,status,isDefault,createdByUserId)
SELECT @tenantId,'Alternative Show Workflow - Test','alternative-show-test','Compact test workflow for validating milestones, yes/no questions, conditional tasks and automatic status roll-up.',1,'published',0,MIN(w.ownerUserId)
FROM tbl_workflows w
WHERE w.tenantId=@tenantId
  AND NOT EXISTS (SELECT 1 FROM tbl_workflow_templates wt WHERE wt.tenantId=@tenantId AND wt.templateKey='alternative-show-test')
HAVING MIN(w.ownerUserId) IS NOT NULL;

SET @templateId := (SELECT id FROM tbl_workflow_templates WHERE tenantId=@tenantId AND templateKey='alternative-show-test' LIMIT 1);

INSERT INTO tbl_template_stages (tenantId,templateId,stageName,description,sortOrder,status,colour,requiresAllTasksComplete)
SELECT @tenantId,@templateId,s.stageName,s.description,s.sortOrder,'active',s.colour,1
FROM (
  SELECT 'Setup' stageName,'Capture and confirm the show information.' description,1 sortOrder,'#6c757d' colour UNION ALL
  SELECT 'Contracting','Agree the deal and complete contracting.',2,'#0d6efd' UNION ALL
  SELECT 'On Sale & Logistics','Complete marketing and optional accommodation.',3,'#6f42c1' UNION ALL
  SELECT 'Settlement','Settle, pay and close the show.',4,'#198754'
) s
WHERE NOT EXISTS (SELECT 1 FROM tbl_template_stages x WHERE x.tenantId=@tenantId AND x.templateId=@templateId AND x.stageName=s.stageName);

INSERT INTO tbl_template_custom_fields
  (tenantId,templateId,fieldKey,fieldLabel,fieldType,helpText,sortOrder,isRequired,status)
SELECT @tenantId,@templateId,f.fieldKey,f.fieldLabel,f.fieldType,f.helpText,f.sortOrder,f.isRequired,'active'
FROM (
  SELECT 'show_name' fieldKey,'Show name' fieldLabel,'text' fieldType,NULL helpText,1 sortOrder,1 isRequired UNION ALL
  SELECT 'show_date','Show date','date','Milestone date',2,1 UNION ALL
  SELECT 'venue','Venue','text',NULL,3,1 UNION ALL
  SELECT 'contact_email','Contact email','email',NULL,4,1 UNION ALL
  SELECT 'on_sale_date','On-sale date','date','Milestone date',5,0 UNION ALL
  SELECT 'deposit_required','Deposit required?','yes_no','Yes activates Confirm deposit paid.',6,0 UNION ALL
  SELECT 'social_post_required','Social post required?','yes_no','Yes activates Publish social post.',7,0 UNION ALL
  SELECT 'accommodation_required','Accommodation required?','yes_no','Yes activates Book accommodation.',8,0 UNION ALL
  SELECT 'seats_sold','Seats sold','number','Final result',9,0 UNION ALL
  SELECT 'comments','Comments','long_text',NULL,10,0
) f
WHERE NOT EXISTS (SELECT 1 FROM tbl_template_custom_fields x WHERE x.tenantId=@tenantId AND x.templateId=@templateId AND x.fieldKey=f.fieldKey);

INSERT INTO tbl_template_tasks
  (tenantId,templateId,templateStageId,taskName,description,sortOrder,priority,status,isRequired,defaultOwnerType,conditionalLogicJson)
SELECT @tenantId,@templateId,s.id,t.taskName,t.description,t.sortOrder,t.priority,'active',t.isRequired,'unassigned',t.conditionalLogicJson
FROM (
  SELECT 'Setup' stageName,'Confirm show details' taskName,'Confirm show name, date, venue and contact.' description,1 sortOrder,'high' priority,1 isRequired,NULL conditionalLogicJson UNION ALL
  SELECT 'Setup','Receive completed information form','Confirm the show information form has been returned.',2,'normal',1,NULL UNION ALL
  SELECT 'Contracting','Issue contract','Send the contract for signature.',1,'high',1,NULL UNION ALL
  SELECT 'Contracting','Receive signed contract','Confirm receipt of the signed contract.',2,'high',1,NULL UNION ALL
  SELECT 'Contracting','Confirm deposit paid','Record the required deposit payment.',3,'normal',0,'{"fieldKey":"deposit_required","operator":"equals","value":true,"whenFalse":"skip"}' UNION ALL
  SELECT 'On Sale & Logistics','Put show on sale','Complete the on-sale activity against the milestone date.',1,'high',1,NULL UNION ALL
  SELECT 'On Sale & Logistics','Publish social post','Publish the required social post.',2,'normal',0,'{"fieldKey":"social_post_required","operator":"equals","value":true,"whenFalse":"skip"}' UNION ALL
  SELECT 'On Sale & Logistics','Book accommodation','Book and confirm accommodation.',3,'normal',0,'{"fieldKey":"accommodation_required","operator":"equals","value":true,"whenFalse":"skip"}' UNION ALL
  SELECT 'Settlement','Issue settlement statement','Prepare and issue the settlement statement.',1,'high',1,NULL UNION ALL
  SELECT 'Settlement','Receive invoice','Confirm receipt of the invoice.',2,'high',1,NULL UNION ALL
  SELECT 'Settlement','Make payment','Complete and record payment.',3,'high',1,NULL UNION ALL
  SELECT 'Settlement','Record seats sold and close','Record seats sold, add comments and complete the workflow.',4,'normal',1,NULL
) t
INNER JOIN tbl_template_stages s ON s.tenantId=@tenantId AND s.templateId=@templateId AND s.stageName=t.stageName
WHERE NOT EXISTS (SELECT 1 FROM tbl_template_tasks x WHERE x.tenantId=@tenantId AND x.templateId=@templateId AND x.templateStageId=s.id AND x.taskName=t.taskName);
