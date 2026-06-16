# AGENTS.md

This repository contains **Tastrack**, a Wappler Node.js multi-tenant workflow and task tracking app.

Before making changes, read:

1. `PROJECT_OVERVIEW.md`
2. `.github/copilot-instructions.md`

Use this file for quick working rules. If there is a conflict, follow `PROJECT_OVERVIEW.md` unless the user gives a direct instruction.

## Project Summary

* App name: **Tastrack**
* Backend: Node.js using Wappler Server Connect
* Views: EJS templates
* UI: Bootstrap 5.3.3
* Icons: Font Awesome 5.15.4
* Database: MySQL/MariaDB
* Database name: `task_tracker`

Tastrack is a multi-tenant workflow and task tracking system. Tenants contain users, roles, teams, workflows, tasks, documents and activity history.

## Important Folders

* `views/` — EJS pages, layouts and partials.
* `views/layouts/` — shared layout wrappers.
* `views/partials/` — reusable EJS fragments.
* `app/api/` — Wappler Server Connect action JSON files.
* `public/` — public web assets, CSS, client JS and images.
* `custom/` — reusable slot-based custom UI elements.
* `.wappler/` — Wappler project metadata and targets.

## Critical Wappler Rules

* Do not replace Wappler project configuration with generic Node.js configuration.
* Do not overwrite `.wappler/project.json` unless explicitly asked.
* Do not alter or delete `.wappler/targets/` unless explicitly asked.
* Do not invent route structures that bypass Wappler routing.
* Prefer Wappler Server Connect actions before adding custom Node.js code.
* Keep Wappler JSON action files valid and compatible with Wappler.

## Security Rules

* Wappler Security Provider is used for authentication.
* Tenant-level security must not use `tbl_roles` alone.
* `tbl_roles` only lists available roles.
* User tenant membership is defined through `tbl_tenant_users`.
* User tenant roles are defined through `tbl_tenant_user_roles`.
* Team membership is defined through `tbl_team_members`.
* Always scope tenant-owned data by `tenantId`.
* Do not trust `tenantId` posted from the browser for protected actions.

Every protected API should:

1. Restrict to logged-in users.
2. Read `USER_ID` and `TENANT_ID` from session.
3. Validate that the user belongs to the tenant.
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

The endpoint `/api/security/context` reads these values for front-end session display.

## Database Rules

* Use database: `task_tracker`.
* SQL scripts intended for DBeaver/manual running should include:

```sql
USE `task_tracker`;
```

* Tables use the `tbl_` prefix.
* Primary key is usually `id`.
* Foreign keys use camelCase, for example `tenantId`, `userId`, `tenantUserId`.
* Use `isActive` for active/inactive status.
* Use `createdDate` and `modifiedDate` for audit fields where appropriate.

## Naming Rules

* EJS page names: lowercase snake_case, for example `create_user.ejs`.
* Server action filenames: camelCase, for example `createUser.json`.
* Custom elements: kebab-case filenames and tag names.
* Feature folders should be clear and domain-based, for example `users`, `teams`, `security`, `workflows`.

## Development Rules

* Make small, focused changes.
* Explain risky structural changes before making them.
* Do not rewrite large parts of the project unless explicitly asked.
* Preserve existing Wappler conventions.
* Add concise comments only for non-obvious logic.
* Keep documentation in sync with implementation changes.

## Git and Safety Rules

* Do not commit secrets, passwords, `.env` files or private connection details.
* Do not remove `.gitignore` rules without explaining why.
* If a merge conflict involves Wappler configuration, stop and ask before resolving.
* Prefer clear commit messages that describe the change.

## Done Means

A task is complete when:

* The requested change has been made.
* Relevant Wappler files remain valid.
* Tenant/security rules have not been weakened.
* Any SQL includes the correct database context where needed.
* Documentation is updated if architecture, database, security or folder conventions changed.
