# Project Context
- Refer to `PROJECT_OVERVIEW.md` for complete project standards, architecture, and conventions.
- Use this file as quick operational guidance; defer to the overview when details conflict or are unclear.

## Folder Guidance

### `views/`
- Build page templates and partials with EJS.
- Use layout wrappers from `views/layouts/` for shared page structure.
- Follow Bootstrap 5.3.3 patterns and utilities for UI composition.
- Keep naming clear and consistent with feature intent.
- Prefer lowercase snake_case page names (example: `create_user.ejs`).

### `app/api/`
- Implement modular Server Connect actions with focused responsibilities.
- Prefer camelCase filenames for new action files.
- Organize actions by feature folder (`app/api/<feature>/...`).
- Add inline comments for non-obvious logic or assumptions.

### `custom/`
- Build reusable slot-based custom elements.
- Use kebab-case filenames and custom element naming.
- Maintain a changelog for reusable components.
- Keep component APIs (slots/attributes) documented and stable.

## Architectural Patterns (Required)
- **Slot-based custom elements** for reusable, composable UI.
- **Modular server actions** for maintainable backend workflows.
- **Layout wrappers** to centralize shared page structure and reduce duplication.

## Documentation Practices
- Always reference `PROJECT_OVERVIEW.md` before major changes.
- Add inline comments for complex or non-obvious implementation details.
- Maintain changelogs for reusable components in `custom/`.
- Keep naming and structure documentation aligned with actual code.

## AI Output Expectations
- Follow established naming, folder, and architecture conventions.
- Respect slot-based components, modular server actions, and layout wrapper patterns.
- Prefer concise, maintainable updates with clear intent.
- When uncertain, refer to `PROJECT_OVERVIEW.md` and align output to it.

# Project Context

* Application name: **Tastrack**
* Refer to `PROJECT_OVERVIEW.md` for complete project standards, architecture, database model, security model, and conventions.
* Use this file as quick operational guidance; defer to the overview when details conflict or are unclear.
* Tastrack is a **Wappler Node.js multi-tenant workflow and task tracking app**.

## Critical Wappler Rules

* Do not replace Wappler project configuration with generic Node.js configuration.
* Do not overwrite `.wappler/project.json` unless explicitly asked.
* Do not alter or delete `.wappler/targets/` unless explicitly asked.
* Do not invent non-Wappler route structures or project metadata.
* Preserve the Wappler folder structure:

  * `views/` for EJS views
  * `app/api/` for Server Connect action JSON files
  * `public/` for public assets
  * `custom/` for reusable custom UI elements
* Prefer Wappler Server Connect actions before adding custom Node.js code.

## Folder Guidance

### `views/`

* Build page templates and partials with EJS.
* Use layout wrappers from `views/layouts/` for shared page structure.
* Follow Bootstrap 5.3.3 patterns and utilities for UI composition.
* Keep naming clear and consistent with feature intent.
* Prefer lowercase snake_case page names, for example `create_user.ejs`.

### `app/api/`

* Implement modular Server Connect actions with focused responsibilities.
* Prefer camelCase filenames for new action files.
* Organize actions by feature folder, for example `app/api/users/`, `app/api/teams/`, `app/api/security/`.
* Add inline comments for non-obvious logic or assumptions.
* Protected APIs must check login, tenant membership and role/permission rules server-side.

### `custom/`

* Build reusable slot-based custom elements.
* Use kebab-case filenames and custom element naming.
* Maintain a changelog for reusable components.
* Keep component APIs, including slots and attributes, documented and stable.

## Multi-Tenant Rules

* Always scope tenant-owned data by `tenantId`.
* Do not trust `tenantId` values posted from the browser for protected operations.
* Use session tenant values where appropriate.
* A user becomes a tenant member through `tbl_tenant_users`.
* A tenant user gets roles through `tbl_tenant_user_roles`.
* A tenant user becomes a team member through `tbl_team_members`.
* `tbl_roles` is only the list of available roles; it does not prove a user has a role.

## Security Rules

* Wappler Security Provider is used for authentication.
* Tenant-level role checks must use:

  * `tbl_tenant_users`
  * `tbl_tenant_user_roles`
  * `tbl_roles`
* Do not use `tbl_roles` alone as Wappler provider permissions for tenant-level security.
* Every protected API should:

  1. Restrict to logged-in users.
  2. Read `USER_ID` and `TENANT_ID` from session.
  3. Validate the user belongs to the tenant.
  4. Check the required role or permission.
  5. Continue only if authorised.

## Session Variables

After login, the app should populate:

* `USER_ID`
* `TENANT_ID`
* `TENANT_USER_ID`
* `TENANT_NAME`
* `TENANT_SLUG`
* `ROLE`
* `ROLES`
* `PERMISSIONS`

The `/api/security/context` endpoint reads these values for front-end session display.

## Database Rules

* Database name: `task_tracker`.
* Table prefix: `tbl_`.
* Primary key field is usually `id`.
* Foreign key fields use camelCase, for example `tenantId`, `userId`, `tenantUserId`.
* Use `isActive` where soft active/inactive status is needed.
* Use `createdDate` and `modifiedDate` where audit fields are needed.
* When producing SQL scripts for DBeaver or manual execution, include:

```sql
USE `task_tracker`;
```

## Architectural Patterns Required

* **Slot-based custom elements** for reusable, composable UI.
* **Modular server actions** for maintainable backend workflows.
* **Layout wrappers** to centralize shared page structure and reduce duplication.
* **Reusable security/library actions** for repeated tenant and role checks.

## Documentation Practices

* Always reference `PROJECT_OVERVIEW.md` before major changes.
* Add inline comments for complex or non-obvious implementation details.
* Maintain changelogs for reusable components in `custom/`.
* Keep naming and structure documentation aligned with actual code.
* Update documentation when database, session, security or folder conventions change.

## Git and Safety Rules

* Do not commit secrets, passwords, `.env` files or private connection details.
* Do not remove `.gitignore` rules without explaining why.
* Prefer small commits with clear messages.
* Explain risky structural changes before making them.
* If a merge conflict involves Wappler configuration, stop and ask before resolving.

## AI Output Expectations

* Follow established naming, folder and architecture conventions.
* Respect slot-based components, modular server actions and layout wrapper patterns.
* Prefer concise, maintainable updates with clear intent.
* Do not rewrite large sections of the app unless explicitly asked.
* When uncertain, refer to `PROJECT_OVERVIEW.md` and align output to it.
