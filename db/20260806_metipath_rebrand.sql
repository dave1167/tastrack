-- Rebrand saved tenant defaults to MetiPath.
-- This updates only known legacy system logo paths and leaves uploaded organisation logos alone.

UPDATE tbl_tenant_branding
SET
    logoPath = CASE
        WHEN logoPath IN ('/assets/images/tastrack_logo.png', '/assets/images/meldren_logo_dark.png', '/assets/images/meldren_logo_light.png') THEN '/assets/images/metipath_logo.png'
        ELSE logoPath
    END,
    contractLogoPath = CASE
        WHEN contractLogoPath IN ('/assets/images/tastrack_logo.png', '/assets/images/meldren_logo_dark.png', '/assets/images/meldren_logo_light.png') THEN '/assets/images/metipath_logo.png'
        ELSE contractLogoPath
    END,
    updatedDate = CURRENT_TIMESTAMP
WHERE
    logoPath IN ('/assets/images/tastrack_logo.png', '/assets/images/meldren_logo_dark.png', '/assets/images/meldren_logo_light.png')
    OR contractLogoPath IN ('/assets/images/tastrack_logo.png', '/assets/images/meldren_logo_dark.png', '/assets/images/meldren_logo_light.png');
