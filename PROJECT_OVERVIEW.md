# Project Overview

## Tech Stack
- **Backend:** Node.js (Wappler Server Connect)
- **UI Framework:** Bootstrap 5.3.3
- **Icons:** Font Awesome 5.15.4

## Folder Structure

### `views/`
- Stores EJS page templates and UI structure.
- Includes:
  - `layouts/` for shared layout wrappers
  - `partials/` for reusable page fragments
  - feature/page folders for grouped templates

### `app/api/`
- Stores Server Connect action files (`.json`) exposed as API endpoints.
- Organized by feature (for example: `users/`, `teams/`, `login/`).
- Supports modular, reusable backend workflows.

### `custom/`
- Stores reusable custom frontend elements and shared UI building blocks.
- Intended for slot-based custom elements and encapsulated component logic.
- Use for cross-page UI reuse outside standard page templates.

## Naming Conventions

### Pages
- Use clear, feature-oriented names.
- Prefer lowercase snake_case for page/template filenames (example: `create_user.ejs`).
- Group related pages in feature folders under `views/`.

### Components
- Use descriptive names that reflect UI purpose.
- For custom elements, use lowercase kebab-case filenames and tag names.
- Keep component names consistent with their functional domain.

### Server Actions
- Keep actions modular and task-focused.
- Use camelCase filenames for new server actions.
- Group actions by feature under `app/api/<feature>/`.

## Architectural Patterns
- **Slot-based custom elements:** Build reusable UI components with named slots for flexible composition.
- **Modular server actions:** Split backend logic into focused actions for maintainability and reuse.
- **Layout wrappers:** Centralize shared structure in `views/layouts/` and keep content pages focused.

## Documentation Practices
- Add concise inline comments for non-obvious logic.
- Maintain changelog notes for reusable components (especially in `custom/`).
- Keep docs synchronized with implementation updates.
- Use this file as the baseline reference for architecture and conventions.

Application Identity
Application name: Tastrack
Purpose: Multi-tenant workflow and task tracking application.
Core concept: Tenants contain users, teams, workflow templates, workflows, tasks, documents and activity history.
Primary use case: Track work from initial enquiry or setup through stages, task assignment, completion, review and close-out.
Multi-Tenant Model
tbl_tenants stores organisations/customers.
tbl_users stores login users.
tbl_tenant_users links users to tenants.
tbl_tenant_user_roles links tenant users to roles.
tbl_roles stores available role types.
tbl_teams stores teams within a tenant.
tbl_team_members links tenant users to teams.

Always scope tenant data by tenantId. Do not trust tenant IDs passed from the browser where a session tenant value should be used.

Security Pattern
Wappler Security Provider is used for authentication only.
Tenant and role checks are handled through custom Server Connect queries/library actions.
Do not use tbl_roles directly as Wappler provider permissions for tenant-level access.
Every protected API should:
Restrict to logged-in users.
Read USER_ID and TENANT_ID from session.
Validate that the user belongs to the tenant.
Check required role or permission.
Continue only if authorised.
Session Variables

After login, the app should populate:

USER_ID
TENANT_ID
TENANT_USER_ID
TENANT_NAME
TENANT_SLUG
ROLE
ROLES
PERMISSIONS

The /api/security/context endpoint reads these session values for front-end display.

Database Conventions
Database name: task_tracker
Table prefix: tbl_
Primary key field is usually id.
Foreign key fields use camelCase, for example tenantId, userId, tenantUserId.
Use isActive for soft enable/disable status where appropriate.
Use createdDate and modifiedDate for audit fields where appropriate.
Wappler-Specific Rules
Do not invent generic Node project structures that conflict with Wappler.
Do not overwrite .wappler/project.json with non-Wappler JSON.
Do not change .wappler/targets/ unless specifically asked.
Server Connect actions live in app/api/.
EJS views live in views/.
Public frontend assets live in public/.
Use Wappler-compatible expressions and bindings.
Prefer Wappler Server Connect actions before adding custom Node code.
Git and Safety Rules
Do not commit secrets, database passwords, .env files or private connection details.
Keep .gitignore suitable for Node/Wappler projects.
Commit documentation changes alongside related code changes.
Before large structural changes, explain the plan first.