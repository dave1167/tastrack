-- Adds authenticated field-level encryption storage for chat messages.
-- Existing plaintext rows must be migrated or removed before encrypted-only chat is enabled.

ALTER TABLE tbl_chat_messages
    MODIFY COLUMN messageText VARCHAR(4000) NULL,
    ADD COLUMN IF NOT EXISTS messageCiphertext TEXT NULL AFTER messageText,
    ADD COLUMN IF NOT EXISTS messageIv VARCHAR(24) NULL AFTER messageCiphertext,
    ADD COLUMN IF NOT EXISTS messageAuthTag VARCHAR(24) NULL AFTER messageIv,
    ADD COLUMN IF NOT EXISTS messageKeyVersion SMALLINT UNSIGNED NULL AFTER messageAuthTag;
