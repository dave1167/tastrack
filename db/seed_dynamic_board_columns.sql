USE `task_tracker`;

SET @templateId := (SELECT id FROM tbl_workflow_templates WHERE TRIM(templateName)='Main House Standard Show' ORDER BY id DESC LIMIT 1);
SET @tenantId := (SELECT tenantId FROM tbl_workflow_templates WHERE id=@templateId);

-- Give every current default view useful theatre columns. Users can subsequently
-- hide, relabel, reorder or resize any of them from Configure columns.
INSERT INTO tbl_board_view_columns (boardViewId,fieldKey,columnLabel,isVisible,sortOrder,width)
SELECT v.id,c.fieldKey,c.columnLabel,1,c.sortOrder,c.width
FROM tbl_board_views v
JOIN (
  SELECT 'field:venue' fieldKey,'Venue' columnLabel,25 sortOrder,170 width UNION ALL
  SELECT 'field:event_type','Event type',27,170 UNION ALL
  SELECT 'currentPhase','Current phase',35,180 UNION ALL
  SELECT 'task:Receive signed contract','Contract',45,150 UNION ALL
  SELECT 'stage:Marketing & On Sale','Marketing',47,160 UNION ALL
  SELECT 'task:Make payment','Payment',49,140
) c
WHERE v.tenantId=@tenantId AND v.templateId IS NULL AND v.isDefault=1
ON DUPLICATE KEY UPDATE columnLabel=VALUES(columnLabel),isVisible=1,sortOrder=VALUES(sortOrder),width=VALUES(width);
