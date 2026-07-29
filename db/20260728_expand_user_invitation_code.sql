-- UUID invitation codes require 36 characters. Allow room for future token formats.
ALTER TABLE tbl_users
    MODIFY COLUMN verifycode VARCHAR(128) NULL;
