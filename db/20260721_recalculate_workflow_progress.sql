UPDATE tbl_workflow_stages ws
LEFT JOIN (
  SELECT workflowStageId,COUNT(id) total,
    SUM(status NOT IN ('complete','skipped','cancelled')) openCount,
    SUM(status NOT IN ('complete','skipped','cancelled') AND dueDate<CURRENT_TIMESTAMP) overdueCount,
    SUM(status='in_progress') progressCount,SUM(status='waiting') waitingCount
  FROM tbl_tasks GROUP BY workflowStageId
) a ON a.workflowStageId=ws.id
SET ws.status=CASE WHEN COALESCE(a.total,0)=0 THEN 'not_started' WHEN a.openCount=0 THEN 'complete' WHEN a.overdueCount>0 THEN 'overdue' WHEN a.progressCount>0 THEN 'in_progress' WHEN a.waitingCount>0 THEN 'waiting' ELSE 'not_started' END,
    ws.startedDate=CASE WHEN COALESCE(a.progressCount,0)>0 OR COALESCE(a.total,0)>COALESCE(a.openCount,0) THEN COALESCE(ws.startedDate,CURRENT_TIMESTAMP) ELSE ws.startedDate END,
    ws.completedDate=CASE WHEN COALESCE(a.total,0)>0 AND a.openCount=0 THEN COALESCE(ws.completedDate,CURRENT_TIMESTAMP) ELSE NULL END,
    ws.modifiedDate=CURRENT_TIMESTAMP;

UPDATE tbl_workflows w
LEFT JOIN (
  SELECT workflowId,COUNT(id) total,
    SUM(status NOT IN ('complete','skipped','cancelled')) openCount,
    SUM(status NOT IN ('complete','skipped','cancelled') AND dueDate<CURRENT_TIMESTAMP) overdueCount,
    SUM(status='in_progress') progressCount,SUM(status='waiting') waitingCount
  FROM tbl_tasks GROUP BY workflowId
) a ON a.workflowId=w.id
SET w.status=CASE WHEN COALESCE(a.total,0)=0 THEN 'not_started' WHEN a.openCount=0 THEN 'complete' WHEN a.overdueCount>0 THEN 'overdue' WHEN a.progressCount>0 THEN 'in_progress' WHEN a.waitingCount>0 THEN 'waiting' ELSE 'not_started' END,
    w.completedDate=CASE WHEN COALESCE(a.total,0)>0 AND a.openCount=0 THEN COALESCE(w.completedDate,CURRENT_TIMESTAMP) ELSE NULL END,
    w.currentStageId=(SELECT ws.id FROM tbl_workflow_stages ws WHERE ws.workflowId=w.id AND ws.tenantId=w.tenantId AND ws.status<>'complete' ORDER BY ws.sortOrder,ws.id LIMIT 1),
    w.modifiedDate=CURRENT_TIMESTAMP;
