USE `task_tracker`;

ALTER TABLE `tbl_contacts`
  ADD COLUMN `contactCategoryId` INT NULL AFTER `tenantId`;

UPDATE `tbl_contacts` AS contact
INNER JOIN `tbl_contact_categories` AS category
  ON category.`tenantId` = contact.`tenantId`
 AND CONVERT(category.`categoryName` USING utf8mb4) COLLATE utf8mb4_unicode_ci
     = CONVERT(contact.`contactType` USING utf8mb4) COLLATE utf8mb4_unicode_ci
SET contact.`contactCategoryId` = category.`contactCategoryId`
WHERE contact.`contactCategoryId` IS NULL;

ALTER TABLE `tbl_contact_categories`
  ADD UNIQUE KEY `uq_contact_categories_tenant_category` (`tenantId`, `contactCategoryId`);

ALTER TABLE `tbl_contacts`
  ADD KEY `idx_contacts_tenant_category` (`tenantId`, `contactCategoryId`),
  ADD CONSTRAINT `fk_contacts_tenant_category`
    FOREIGN KEY (`tenantId`, `contactCategoryId`)
    REFERENCES `tbl_contact_categories` (`tenantId`, `contactCategoryId`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
