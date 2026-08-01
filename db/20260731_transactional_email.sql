CREATE TABLE IF NOT EXISTS tbl_tenant_email_settings (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    replyToAddress VARCHAR(254) NULL,
    archiveBccAddress VARCHAR(254) NULL,
    copyInitiatingUser TINYINT(1) NOT NULL DEFAULT 0,
    copyWorkflowOwner TINYINT(1) NOT NULL DEFAULT 0,
    emailFooterHtml TEXT NULL,
    rowVersion INT UNSIGNED NOT NULL DEFAULT 1,
    createdByUserId INT UNSIGNED NULL,
    modifiedByUserId INT UNSIGNED NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tenant_email_settings_tenant (tenantId),
    CONSTRAINT fk_tenant_email_settings_tenant
        FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE
);

ALTER TABLE tbl_contract_templates
    ADD COLUMN IF NOT EXISTS outputType ENUM('contract','email','letter','report') NOT NULL DEFAULT 'contract' AFTER description,
    ADD COLUMN IF NOT EXISTS templateKey VARCHAR(100) NULL AFTER outputType,
    ADD COLUMN IF NOT EXISTS subjectTemplate VARCHAR(255) NULL AFTER templateKey,
    ADD COLUMN IF NOT EXISTS textTemplate LONGTEXT NULL AFTER bodyHtml;

ALTER TABLE tbl_contract_template_versions
    ADD COLUMN IF NOT EXISTS outputType ENUM('contract','email','letter','report') NOT NULL DEFAULT 'contract' AFTER description,
    ADD COLUMN IF NOT EXISTS templateKey VARCHAR(100) NULL AFTER outputType,
    ADD COLUMN IF NOT EXISTS subjectTemplate VARCHAR(255) NULL AFTER templateKey,
    ADD COLUMN IF NOT EXISTS textTemplate LONGTEXT NULL AFTER bodyHtml;

CREATE TABLE IF NOT EXISTS tbl_email_queue (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    templateId INT UNSIGNED NULL,
    relatedEntityType VARCHAR(80) NULL,
    relatedEntityId BIGINT UNSIGNED NULL,
    workflowId INT UNSIGNED NULL,
    contractId INT UNSIGNED NULL,
    recipientName VARCHAR(180) NULL,
    recipientEmail VARCHAR(254) NOT NULL,
    ccAddresses TEXT NULL,
    bccAddresses TEXT NULL,
    replyToAddress VARCHAR(254) NULL,
    fromAddressSnapshot VARCHAR(254) NULL,
    fromNameSnapshot VARCHAR(180) NULL,
    subjectSnapshot VARCHAR(255) NOT NULL,
    htmlSnapshot LONGTEXT NOT NULL,
    textSnapshot LONGTEXT NULL,
    status ENUM('queued','preview','sending','sent','delivered','failed','bounced','complained','suppressed') NOT NULL DEFAULT 'queued',
    provider VARCHAR(40) NOT NULL DEFAULT 'resend',
    providerMessageId VARCHAR(180) NULL,
    attemptCount INT UNSIGNED NOT NULL DEFAULT 0,
    queuedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sentDate DATETIME NULL,
    deliveredDate DATETIME NULL,
    failedDate DATETIME NULL,
    failureMessage TEXT NULL,
    initiatedByUserId INT UNSIGNED NULL,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_email_queue_tenant_status (tenantId, status, queuedDate),
    KEY ix_email_queue_provider_message (providerMessageId),
    KEY ix_email_queue_workflow (tenantId, workflowId),
    KEY ix_email_queue_contract (tenantId, contractId),
    CONSTRAINT fk_email_queue_tenant
        FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_email_queue_template
        FOREIGN KEY (templateId) REFERENCES tbl_contract_templates(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tbl_email_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenantId INT UNSIGNED NOT NULL,
    emailQueueId BIGINT UNSIGNED NOT NULL,
    eventType VARCHAR(80) NOT NULL,
    providerEventId VARCHAR(180) NULL,
    eventPayloadJson LONGTEXT NULL,
    eventDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_email_events_provider_event (providerEventId),
    KEY ix_email_events_queue (tenantId, emailQueueId, eventDate),
    CONSTRAINT fk_email_events_tenant
        FOREIGN KEY (tenantId) REFERENCES tbl_tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_email_events_queue
        FOREIGN KEY (emailQueueId) REFERENCES tbl_email_queue(id) ON DELETE CASCADE
);

INSERT INTO tbl_permissions
    (permissionCode, permissionKey, permissionName, permissionDescription, permissionScope, permissionGroup, isSensitive, isAssignable, description, isActive)
VALUES
    ('email.configure', 'email.configure', 'Configure email', 'Manage tenant email defaults and templates.', 'tenant', 'Notifications', 1, 1, 'Manage transactional email configuration.', 1),
    ('email.send', 'email.send', 'Send email', 'Queue and send transactional email.', 'tenant', 'Notifications', 1, 1, 'Send auditable transactional email.', 1)
ON DUPLICATE KEY UPDATE
    permissionName = VALUES(permissionName),
    permissionDescription = VALUES(permissionDescription),
    permissionGroup = VALUES(permissionGroup),
    isActive = 1;

INSERT IGNORE INTO tbl_role_permissions (roleId, permissionId)
SELECT r.id, p.id
FROM tbl_roles r
INNER JOIN tbl_permissions p ON p.permissionCode IN ('email.configure','email.send')
WHERE r.roleKey IN ('owner','admin')
  AND r.isActive = 1;

INSERT INTO tbl_contract_templates
    (tenantId, templateKey, templateName, description, outputType, subjectTemplate, bodyHtml, textTemplate, versionNumber, isActive)
SELECT
    t.id,
    seed.templateKey,
    seed.templateName,
    'System transactional email template',
    'email',
    seed.subjectTemplate,
    seed.htmlTemplate,
    seed.textTemplate,
    1,
    1
FROM tbl_tenants t
CROSS JOIN (
    SELECT
        'user_invitation' templateKey,
        'User invitation' templateName,
        'You have been invited to {{tenant.name}}' subjectTemplate,
        '<p>Hello {{user.name}},</p><p>You have been invited to join {{tenant.name}}.</p><p><a href="{{invitation.url}}">Accept invitation</a></p>' htmlTemplate,
        'Hello {{user.name}}, You have been invited to join {{tenant.name}}. Accept your invitation: {{invitation.url}}' textTemplate
    UNION ALL
    SELECT
        'contract_issued',
        'Contract issued',
        '{{contract.name}} is ready',
        '<p>Hello {{recipient.name}},</p><p>{{contract.name}} for {{event.name}} is ready.</p><p><a href="{{contract.url}}">View contract</a></p>',
        'Hello {{recipient.name}}, {{contract.name}} for {{event.name}} is ready: {{contract.url}}'
) seed
WHERE NOT EXISTS (
    SELECT 1
    FROM tbl_contract_templates existing
    WHERE existing.tenantId = t.id
      AND existing.templateKey = seed.templateKey
);
