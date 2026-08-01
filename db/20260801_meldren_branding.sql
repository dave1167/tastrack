-- Move only legacy Tastrack defaults to the Meldren brand.
-- Tenant-specific colour and logo choices are deliberately preserved.

UPDATE tbl_tenant_branding
SET
    primaryColour = CASE WHEN UPPER(primaryColour) = '#18B99A' THEN '#14B8A6' ELSE primaryColour END,
    accentColour = CASE WHEN UPPER(accentColour) = '#00D7A3' THEN '#2563EB' ELSE accentColour END,
    headerColour = CASE WHEN UPPER(headerColour) = '#073F3C' THEN '#0D1B2A' ELSE headerColour END,
    sidebarColour = CASE WHEN UPPER(sidebarColour) = '#092F2D' THEN '#0D1B2A' ELSE sidebarColour END,
    logoPath = CASE WHEN logoPath = '/assets/images/tastrack_logo.png' THEN '/assets/images/meldren_logo_dark.png' ELSE logoPath END,
    contractLogoPath = CASE WHEN contractLogoPath = '/assets/images/tastrack_logo.png' THEN '/assets/images/meldren_logo_light.png' ELSE contractLogoPath END,
    modifiedDate = CURRENT_TIMESTAMP
WHERE
    UPPER(primaryColour) = '#18B99A'
    OR UPPER(accentColour) = '#00D7A3'
    OR UPPER(headerColour) = '#073F3C'
    OR UPPER(sidebarColour) = '#092F2D'
    OR logoPath = '/assets/images/tastrack_logo.png'
    OR contractLogoPath = '/assets/images/tastrack_logo.png';
