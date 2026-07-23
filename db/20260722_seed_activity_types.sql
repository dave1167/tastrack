INSERT INTO tbl_activity_types (tenantId,activityKey,activityName,activityCategory,description,icon,colour)
SELECT tenant.id,activity.activityKey,activity.activityName,activity.activityCategory,activity.description,activity.icon,activity.colour
FROM tbl_tenants tenant CROSS JOIN (
  SELECT 'seed_created' activityKey,'Seed data created' activityName,'system' activityCategory,'Initial demonstration data was created.' description,'fa-database' icon,'secondary' colour
  UNION ALL SELECT 'user.login','User logged in','security','A user entered this tenant.','fa-sign-in-alt','success'
  UNION ALL SELECT 'user.logout','User logged out','security','A user logged out of this tenant.','fa-sign-out-alt','secondary'
  UNION ALL SELECT 'user.created','User created','users','A user was added to the tenant.','fa-user-plus','success'
  UNION ALL SELECT 'user.updated','User updated','users','User details or access changed.','fa-user-edit','primary'
  UNION ALL SELECT 'workflow.created','Event created','workflow','A new event was created.','fa-calendar-plus','success'
  UNION ALL SELECT 'workflow.updated','Event updated','workflow','Event details changed.','fa-edit','primary'
  UNION ALL SELECT 'workflow.status_changed','Event status changed','workflow','The event status changed.','fa-exchange-alt','info'
  UNION ALL SELECT 'stage.status_changed','Phase status changed','stage','The phase status changed.','fa-stream','info'
  UNION ALL SELECT 'task.created','Task created','task','A task was created.','fa-plus-circle','success'
  UNION ALL SELECT 'task.updated','Task updated','task','Task details changed.','fa-edit','primary'
  UNION ALL SELECT 'task.status_changed','Task status changed','task','The task status changed.','fa-check-circle','info'
  UNION ALL SELECT 'task.team_changed','Task team changed','task','Responsibility moved to another team.','fa-users','warning'
  UNION ALL SELECT 'contact.created','Contact created','contact','A contact was added.','fa-address-card','success'
  UNION ALL SELECT 'contact.updated','Contact updated','contact','Contact information changed.','fa-address-card','primary'
  UNION ALL SELECT 'template.updated','Template updated','template','An event template changed.','fa-project-diagram','warning'
  UNION ALL SELECT 'document.uploaded','Document uploaded','document','A document was uploaded.','fa-file-upload','success'
  UNION ALL SELECT 'record.archived','Record archived','record','A record was archived.','fa-archive','warning'
  UNION ALL SELECT 'record.deleted','Record deleted','record','A record was deleted.','fa-trash-alt','danger'
  UNION ALL SELECT 'import.completed','Import completed','import','A data import completed.','fa-file-import','success'
  UNION ALL SELECT 'system.automatic_update','Automatic update','system','The system automatically updated a record.','fa-cog','secondary'
) activity
WHERE 1=1
ON DUPLICATE KEY UPDATE activityName=VALUES(activityName),activityCategory=VALUES(activityCategory),description=VALUES(description),icon=VALUES(icon),colour=VALUES(colour),isActive=1;
