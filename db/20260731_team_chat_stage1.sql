INSERT INTO tbl_modules
    (moduleCode,moduleName,moduleDescription,moduleCategory,isCore,isBillable,isActive,currencyCode,displayOrder)
VALUES
    ('TEAM_CHAT','Direct Chat','Private conversations between users in the same organisation.','COMMUNICATIONS',0,1,1,'GBP',220)
ON DUPLICATE KEY UPDATE
    moduleName=VALUES(moduleName),
    moduleDescription=VALUES(moduleDescription),
    moduleCategory=VALUES(moduleCategory),
    isBillable=VALUES(isBillable),
    isActive=1,
    displayOrder=VALUES(displayOrder);

INSERT INTO tbl_tenant_modules
    (tenantId,moduleId,status,billingInterval,currencyCode,enabledDate)
SELECT t.id,m.id,'ACTIVE','MONTHLY','GBP',CURRENT_TIMESTAMP
FROM tbl_tenants t
INNER JOIN tbl_modules m ON m.moduleCode='TEAM_CHAT'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_tenant_modules tm
    WHERE tm.tenantId=t.id AND tm.moduleId=m.id
);

INSERT INTO tbl_permissions
    (permissionCode,permissionKey,permissionName,permissionDescription,permissionScope,permissionGroup,isSensitive,isAssignable,description,isActive)
VALUES
    ('chat.view','chat.view','View chat','View permitted event and team conversations.','tenant','communications',0,1,'View event and team chat.',1),
    ('chat.send','chat.send','Send chat messages','Send messages to permitted event and team conversations.','tenant','communications',0,1,'Send event and team chat messages.',1)
ON DUPLICATE KEY UPDATE
    permissionName=VALUES(permissionName),
    permissionDescription=VALUES(permissionDescription),
    description=VALUES(description),
    isActive=1;

INSERT IGNORE INTO tbl_role_permissions (roleId,permissionId)
SELECT r.id,p.id
FROM tbl_roles r
INNER JOIN tbl_permissions p ON p.permissionCode IN ('chat.view','chat.send')
WHERE r.isActive=1
  AND r.roleKey IN ('owner','admin','department_head','editor','operations','team_member');

CREATE TABLE IF NOT EXISTS tbl_chat_conversations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    conversationType ENUM('workflow','team','direct') NOT NULL,
    workflowId INT UNSIGNED NULL,
    teamId INT UNSIGNED NULL,
    directKey VARCHAR(50) NULL,
    conversationName VARCHAR(180) NULL,
    isActive TINYINT(1) NOT NULL DEFAULT 1,
    createdByUserId INT UNSIGNED NULL,
    modifiedByUserId INT UNSIGNED NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_chat_conversation_workflow (tenantId,conversationType,workflowId),
    UNIQUE KEY uq_chat_conversation_team (tenantId,conversationType,teamId),
    UNIQUE KEY uq_chat_conversation_direct (tenantId,conversationType,directKey),
    KEY ix_chat_conversation_tenant (tenantId,isActive,modifiedDate),
    CONSTRAINT fk_chat_conversation_tenant FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_conversation_workflow FOREIGN KEY (workflowId) REFERENCES tbl_workflows(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_conversation_team FOREIGN KEY (teamId) REFERENCES tbl_teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tbl_chat_participants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    conversationId BIGINT UNSIGNED NOT NULL,
    userId INT UNSIGNED NOT NULL,
    lastReadMessageId BIGINT UNSIGNED NULL,
    lastReadDate DATETIME NULL,
    isMuted TINYINT(1) NOT NULL DEFAULT 0,
    isActive TINYINT(1) NOT NULL DEFAULT 1,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_chat_participant (tenantId,conversationId,userId),
    KEY ix_chat_participant_user (tenantId,userId,isActive),
    CONSTRAINT fk_chat_participant_tenant FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_participant_conversation FOREIGN KEY (conversationId) REFERENCES tbl_chat_conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_participant_user FOREIGN KEY (userId) REFERENCES tbl_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tbl_chat_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    conversationId BIGINT UNSIGNED NOT NULL,
    senderUserId INT UNSIGNED NOT NULL,
    messageText VARCHAR(4000) NULL,
    messageCiphertext TEXT NULL,
    messageIv VARCHAR(24) NULL,
    messageAuthTag VARCHAR(24) NULL,
    messageKeyVersion SMALLINT UNSIGNED NULL,
    isDeleted TINYINT(1) NOT NULL DEFAULT 0,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_chat_message_conversation (tenantId,conversationId,id),
    KEY ix_chat_message_sender (tenantId,senderUserId,createdDate),
    CONSTRAINT fk_chat_message_tenant FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_message_conversation FOREIGN KEY (conversationId) REFERENCES tbl_chat_conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_message_sender FOREIGN KEY (senderUserId) REFERENCES tbl_users(id) ON DELETE RESTRICT
);

ALTER TABLE tbl_chat_conversations
    MODIFY COLUMN conversationType ENUM('workflow','team','direct') NOT NULL,
    ADD COLUMN IF NOT EXISTS directKey VARCHAR(50) NULL AFTER teamId;

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_conversation_direct
    ON tbl_chat_conversations (tenantId,conversationType,directKey);

ALTER TABLE tbl_user_tenants
    ADD COLUMN IF NOT EXISTS chatAvailability ENUM('available','do_not_disturb','unavailable') NOT NULL DEFAULT 'available',
    ADD COLUMN IF NOT EXISTS chatStatusMessage VARCHAR(120) NULL,
    ADD COLUMN IF NOT EXISTS chatStatusModifiedDate DATETIME NULL;

ALTER TABLE tbl_chat_messages
    MODIFY COLUMN messageText VARCHAR(4000) NULL,
    ADD COLUMN IF NOT EXISTS messageCiphertext TEXT NULL AFTER messageText,
    ADD COLUMN IF NOT EXISTS messageIv VARCHAR(24) NULL AFTER messageCiphertext,
    ADD COLUMN IF NOT EXISTS messageAuthTag VARCHAR(24) NULL AFTER messageIv,
    ADD COLUMN IF NOT EXISTS messageKeyVersion SMALLINT UNSIGNED NULL AFTER messageAuthTag;
