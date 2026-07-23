USE `task_tracker`;

SET @templateId := (SELECT id FROM tbl_workflow_templates WHERE templateName='Main House Standard Show ' ORDER BY id DESC LIMIT 1);
SET @tenantId := (SELECT tenantId FROM tbl_workflow_templates WHERE id=@templateId);

UPDATE tbl_template_stages
SET sortOrder=sortOrder+100,status='archived',modifiedDate=CURRENT_TIMESTAMP
WHERE tenantId=@tenantId AND templateId=@templateId
  AND stageName NOT IN ('Information Collection','Contract & Deal','Marketing & On Sale','Accommodation & Logistics','Settlement & Payment','Closed')
  AND sortOrder<100;

INSERT INTO tbl_template_stages (tenantId,templateId,stageName,description,sortOrder,status,colour,requiresAllTasksComplete)
SELECT @tenantId,@templateId,s.stageName,s.description,s.sortOrder,'active',s.colour,1
FROM (
  SELECT 'Information Collection' stageName,'Collect and confirm show information.' description,1 sortOrder,'#6c757d' colour UNION ALL
  SELECT 'Contract & Deal','Agree terms and complete contracting.',2,'#0d6efd' UNION ALL
  SELECT 'Marketing & On Sale','Manage announcement, on-sale and marketing requirements.',3,'#6f42c1' UNION ALL
  SELECT 'Accommodation & Logistics','Arrange accommodation where required.',4,'#fd7e14' UNION ALL
  SELECT 'Settlement & Payment','Complete settlement, invoice and payment.',5,'#198754' UNION ALL
  SELECT 'Closed','Capture final results and close the workflow.',6,'#212529'
) s
WHERE @templateId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tbl_template_stages x WHERE x.tenantId=@tenantId AND x.templateId=@templateId AND x.stageName=s.stageName);

INSERT INTO tbl_template_custom_fields
  (tenantId,templateId,fieldKey,fieldLabel,fieldType,helpText,sortOrder,isRequired,status)
SELECT @tenantId,@templateId,f.fieldKey,f.fieldLabel,f.fieldType,f.helpText,f.sortOrder,f.isRequired,'active'
FROM (
  SELECT 'notes' fieldKey,'Notes' fieldLabel,'long_text' fieldType,NULL helpText,1 sortOrder,0 isRequired UNION ALL
  SELECT 'show_info','Show information','long_text',NULL,2,0 UNION ALL
  SELECT 'show_name','Show name','text',NULL,3,1 UNION ALL
  SELECT 'show_date','Date of show','date','Milestone date',4,1 UNION ALL
  SELECT 'show_time','Time of show','text',NULL,5,0 UNION ALL
  SELECT 'venue','Venue of show','text',NULL,6,1 UNION ALL
  SELECT 'contact_email','Contact email','email',NULL,7,1 UNION ALL
  SELECT 'event_type','Performance, workshop or event','dropdown',NULL,8,1 UNION ALL
  SELECT 'deal','Deal','long_text',NULL,9,0 UNION ALL
  SELECT 'deposit_required','Deposit required?','yes_no','Yes activates the deposit task; No makes it not applicable.',10,0 UNION ALL
  SELECT 'announcement_embargo_date','Announcement / embargo date','date','Milestone date',11,0 UNION ALL
  SELECT 'on_sale_date','On-sale date','date','Milestone date',12,0 UNION ALL
  SELECT 'include_new_on_sale','Include in New & On Sale?','yes_no','Yes activates the listing task.',13,0 UNION ALL
  SELECT 'social_post_required','Social post required?','yes_no','Yes activates the social post task.',14,0 UNION ALL
  SELECT 'marketing_lead','Marketing lead','text',NULL,15,0 UNION ALL
  SELECT 'accommodation_required','Accommodation required?','yes_no','Yes activates the booking task.',16,0 UNION ALL
  SELECT 'comments','Comments','long_text',NULL,17,0 UNION ALL
  SELECT 'seats_sold','Number of seats sold','number','Final result',18,0
) f
WHERE @templateId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tbl_template_custom_fields x WHERE x.tenantId=@tenantId AND x.templateId=@templateId AND x.fieldKey=f.fieldKey);

INSERT INTO tbl_template_tasks
  (tenantId,templateId,templateStageId,taskName,description,sortOrder,priority,status,isRequired,defaultOwnerType,conditionalLogicJson)
SELECT @tenantId,@templateId,s.id,t.taskName,t.description,t.sortOrder,t.priority,'active',t.isRequired,'unassigned',t.conditionalLogicJson
FROM (
  SELECT 'Information Collection' stageName,'Issue Jotform' taskName,'Send the show information form.' description,1 sortOrder,'normal' priority,1 isRequired,NULL conditionalLogicJson UNION ALL
  SELECT 'Information Collection','Receive Jotform','Confirm the completed form has been returned.',2,'normal',1,NULL UNION ALL
  SELECT 'Information Collection','Confirm show information','Check show name, date, time, venue, contact and event type.',3,'high',1,NULL UNION ALL
  SELECT 'Contract & Deal','Confirm deal','Record and approve the agreed deal.',1,'high',1,NULL UNION ALL
  SELECT 'Contract & Deal','Issue contract','Send the contract for signature.',2,'high',1,NULL UNION ALL
  SELECT 'Contract & Deal','Receive signed contract','Confirm the signed contract has been returned.',3,'high',1,NULL UNION ALL
  SELECT 'Contract & Deal','Confirm deposit paid','Record receipt of the required deposit.',4,'normal',0,'{"fieldKey":"deposit_required","operator":"equals","value":true,"whenFalse":"skip"}' UNION ALL
  SELECT 'Marketing & On Sale','Confirm announcement / embargo','Confirm the announcement can proceed against the milestone date.',1,'high',1,NULL UNION ALL
  SELECT 'Marketing & On Sale','Add to New & On Sale','Include the show in New & On Sale.',2,'normal',0,'{"fieldKey":"include_new_on_sale","operator":"equals","value":true,"whenFalse":"skip"}' UNION ALL
  SELECT 'Marketing & On Sale','Put show on sale','Complete the on-sale activity against the milestone date.',3,'high',1,NULL UNION ALL
  SELECT 'Marketing & On Sale','Publish social post','Create and publish the required social post.',4,'normal',0,'{"fieldKey":"social_post_required","operator":"equals","value":true,"whenFalse":"skip"}' UNION ALL
  SELECT 'Accommodation & Logistics','Book accommodation','Arrange and confirm accommodation.',1,'normal',0,'{"fieldKey":"accommodation_required","operator":"equals","value":true,"whenFalse":"skip"}' UNION ALL
  SELECT 'Settlement & Payment','Issue settlement statement','Prepare and issue the settlement statement.',1,'high',1,NULL UNION ALL
  SELECT 'Settlement & Payment','Receive invoice','Confirm the invoice has been received.',2,'high',1,NULL UNION ALL
  SELECT 'Settlement & Payment','Make payment','Complete and record payment.',3,'high',1,NULL UNION ALL
  SELECT 'Closed','Record seats sold','Enter the final number of seats sold.',1,'normal',1,NULL UNION ALL
  SELECT 'Closed','Review final comments','Record final notes and close-out comments.',2,'normal',1,NULL
) t
INNER JOIN tbl_template_stages s ON s.tenantId=@tenantId AND s.templateId=@templateId AND s.stageName=t.stageName
WHERE @templateId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tbl_template_tasks x WHERE x.tenantId=@tenantId AND x.templateId=@templateId AND x.templateStageId=s.id AND x.taskName=t.taskName);
