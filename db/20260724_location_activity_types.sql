USE `task_tracker`;

INSERT INTO tbl_activity_types
  (tenantId, activityKey, activityName, activityCategory, description, icon, colour, isActive)
SELECT t.id, seed.activityKey, seed.activityName, 'locations', seed.description, seed.icon, '#0d6efd', 1
FROM tbl_tenants t
CROSS JOIN (
  SELECT 'location.created' activityKey, 'Location created' activityName, 'A location was created' description, 'fas fa-map-marker-alt' icon
  UNION ALL SELECT 'location.updated', 'Location updated', 'A location was updated', 'fas fa-map-marker-alt'
  UNION ALL SELECT 'space.created', 'Space created', 'A location space was created', 'fas fa-door-open'
  UNION ALL SELECT 'space.updated', 'Space updated', 'A location space was updated', 'fas fa-door-open'
  UNION ALL SELECT 'configuration.created', 'Configuration created', 'A space configuration was created', 'fas fa-chair'
  UNION ALL SELECT 'configuration.updated', 'Configuration updated', 'A space configuration was updated', 'fas fa-chair'
  UNION ALL SELECT 'workflow.location_changed', 'Event location changed', 'An event location was changed', 'fas fa-map-marked-alt'
  UNION ALL SELECT 'task.location_changed', 'Task location changed', 'A task location setting was changed', 'fas fa-map-marked-alt'
) seed
WHERE 1=1
ON DUPLICATE KEY UPDATE
  activityName=VALUES(activityName),
  activityCategory=VALUES(activityCategory),
  description=VALUES(description),
  icon=VALUES(icon),
  colour=VALUES(colour),
  isActive=1;
