-- TasTrack local login repair.
-- Run this in DBeaver against the Wappler database.
--
-- Wappler connection currently uses:
--   database: task_tracker
--
-- Development password for these users after running:
--   password

USE task_tracker;

INSERT INTO tbl_users
  (email, displayName, passwordHash, status)
VALUES
  ('ops@local.com', 'Operations User', 'password', 'active'),
  ('owner@tasktracker.local', 'Owner User', 'password', 'active'),
  ('admin@tasktracker.local', 'Admin User', 'password', 'active')
ON DUPLICATE KEY UPDATE
  displayName = VALUES(displayName),
  passwordHash = VALUES(passwordHash),
  status = VALUES(status);

SELECT
  id,
  email,
  displayName,
  passwordHash,
  status
FROM tbl_users
WHERE email IN (
  'ops@local.com',
  'owner@tasktracker.local',
  'admin@tasktracker.local'
)
ORDER BY email;
