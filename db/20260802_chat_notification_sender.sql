-- Keep a direct-chat notification linked to the colleague who sent it.
ALTER TABLE tbl_notifications
    ADD COLUMN IF NOT EXISTS relatedUserId INT UNSIGNED NULL AFTER taskId;

CREATE INDEX IF NOT EXISTS ix_notifications_related_user
    ON tbl_notifications (tenantId, userId, relatedUserId, notificationType);

UPDATE tbl_notifications n
INNER JOIN tbl_user_tenants ut
    ON ut.tenantId = n.tenantId
   AND ut.isActive = 1
INNER JOIN tbl_users u
    ON u.id = ut.userId
   AND u.isActive = 1
   AND CONCAT('New message from ', COALESCE(NULLIF(u.displayName, ''), CONCAT_WS(' ', u.fName, u.lName), u.email)) = n.title
SET n.relatedUserId = u.id
WHERE n.notificationType = 'chat_message'
  AND n.relatedUserId IS NULL;
