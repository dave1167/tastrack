# Tastrack roles and permissions: first delivery

## Implemented

- Authentication remains with the existing Wappler Security Provider.
- `tbl_user_tenants` now separates tenant membership from role assignment.
- Tenant users can hold multiple active tenant roles.
- Team memberships can hold multiple team roles through `tbl_team_member_roles`.
- Team roles receive permissions through `tbl_team_role_permissions`.
- The permission catalogue now distinguishes tenant and team scopes.
- Protected owner roles are identified structurally with `isOwnerRole`; authority is not inferred from display text.
- Active tenant membership is checked on login, tenant selection and permission checks.
- Reusable Wappler Library Actions provide current context, tenant checks, team checks, required-permission handling and audit inserts.
- A secure effective-permissions endpoint supports App Connect navigation and button visibility.
- Tenant user list, invitation, role options, user detail and multiple-role update actions use standard Server Connect steps.
- Role choices are filtered to prevent assignment of powers the acting user does not hold.
- Users cannot update their own tenant-role assignments.
- The final active owner role cannot be removed.
- Legacy single-role create/edit endpoints return a controlled `410` response and cannot bypass the new checks.
- All Server Connect APIs now require Security Restrict except the intended login/session bootstrap actions.
- CSRF protection is enabled for state-changing requests.
- Platform pages require the explicit platform-administrator Security Provider permission.

## Compatibility

Legacy single-role columns and mappings remain in place so existing Wappler pages can be migrated incrementally. New work must use `tbl_user_tenants`, `tbl_user_tenant_roles`, `tbl_team_member_roles` and the permission mapping tables.

The migration files are:

- `db/20260728_wappler_roles_permissions_phase2.sql`
- `db/20260728_wappler_roles_permissions_indexes.sql`

## Next delivery

The following deliberately remain for the next incremental phase:

- Secure suspend and reactivate membership actions with final-owner protection.
- Tenant custom-role create/edit/archive and permission-assignment pages.
- Multiple-team and multiple-team-role assignment interface.
- Incremental replacement of remaining legacy owner/admin page visibility rules with effective-permission-driven App Connect visibility.
- Permission-specific checks on the remaining lower-risk write actions.
- Invitation email delivery after a successful database transaction.

Server-side actions remain authoritative. App Connect visibility must never be treated as the security boundary.
