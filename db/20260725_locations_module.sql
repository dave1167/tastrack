USE `task_tracker`;

INSERT INTO `tbl_modules`
(`moduleCode`,`moduleName`,`moduleDescription`,`moduleCategory`,`isCore`,`isBillable`,`isActive`,`defaultMonthlyPrice`,`defaultAnnualPrice`,`currencyCode`,`displayOrder`)
VALUES
('LOCATIONS','Locations','Locations, spaces, configurations and event venue assignment.','OPERATIONS',0,0,1,NULL,NULL,'GBP',40)
ON DUPLICATE KEY UPDATE
`moduleName`=VALUES(`moduleName`),`moduleDescription`=VALUES(`moduleDescription`),`moduleCategory`=VALUES(`moduleCategory`),
`isBillable`=VALUES(`isBillable`),`isActive`=VALUES(`isActive`),`displayOrder`=VALUES(`displayOrder`);

INSERT INTO `tbl_tenant_modules`
(`tenantId`,`moduleId`,`status`,`billingInterval`,`currencyCode`,`enabledDate`)
SELECT t.id,m.id,'ACTIVE','INCLUDED','GBP',CURRENT_TIMESTAMP
FROM `tbl_tenants` t
INNER JOIN `tbl_modules` m ON m.moduleCode='LOCATIONS'
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_tenant_modules` tm WHERE tm.tenantId=t.id AND tm.moduleId=m.id
);
