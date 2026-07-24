# Structured Location Migration Proposal

## Purpose

This proposal lists the database changes required to integrate structured locations with Tastrack's existing workflows, tasks, dates, board views and permission model.

The workflow and task reference changes described below were applied to the
local development database on 24 July 2026 by
`db/20260724_workflow_task_locations.sql`. The occurrence and permission changes
remain proposals and have not been applied.

All new tenant-owned tables and references must use the session tenant in protected actions. Browser-posted `tenantId` must never establish authority.

## Existing authoritative tables

The live database already contains `tbl_locations`, `tbl_spaces`,
`tbl_space_configurations` and `vw_location_space_configurations`. These objects
must be retained and must not be recreated by this migration. The field lists
below document the existing catalogue rather than proposing parallel tables.

### `tbl_locations`

Existing core fields:

| Field | Requirement |
| --- | --- |
| `id` | Primary key |
| `tenantId` | Required FK to `tbl_tenants.id` |
| `locationName` | Required |
| `locationType` | Optional classification |
| `addressLine1`, `addressLine2` | Optional |
| `townCity`, `countyRegion`, `postcode`, `country` | Optional |
| `telephone`, `email`, `website`, `directions` | Optional |
| `accessibilityNotes`, `generalNotes` | Optional |
| `sortOrder` | Required |
| `isActive` | Required, default 1 |
| `createdDate`, `modifiedDate` | Audit fields |

Existing indexes:

- unique or tenant-scoped lookup on `(tenantId, locationName)`
- `(tenantId, isActive, locationName)`
- `(tenantId, locationType)`

### `tbl_spaces`

Existing core fields:

| Field | Requirement |
| --- | --- |
| `id` | Primary key |
| `tenantId` | Required FK to `tbl_tenants.id` |
| `locationId` | Required FK to `tbl_locations.id` |
| `spaceName` | Required |
| `spaceType` | Optional |
| `defaultCapacity` | Optional |
| `description`, `accessibilityNotes` | Optional |
| `sortOrder` | Required |
| `isActive` | Required, default 1 |
| `createdDate`, `modifiedDate` | Audit fields |

Existing indexes and constraints:

- unique or tenant-scoped lookup on `(tenantId, locationId, spaceName)`
- `(tenantId, locationId, isActive, spaceName)`

The application must validate both `tenantId` and `locationId`; a foreign key alone does not prove the selected location belongs to the session tenant.

### `tbl_space_configurations`

Existing core fields:

| Field | Requirement |
| --- | --- |
| `id` | Primary key |
| `tenantId` | Required FK to `tbl_tenants.id` |
| `spaceId` | Required FK to `tbl_spaces.id` |
| `configurationName` | Required |
| `seatedCapacity`, `standingCapacity`, `maximumTotalCapacity` | Optional |
| `staffCrewAllowance`, `setupMinutes`, `resetMinutes` | Optional |
| `minimumStaff`, `minimumSecurityStaff` | Optional |
| `description`, `accessibilityNotes`, `operationalNotes` | Optional |
| `sortOrder`, `isDefault`, `defaultMarker` | Ordering/default fields |
| `isActive` | Required, default 1 |
| `createdDate`, `modifiedDate` | Audit fields |

Existing indexes and constraints:

- unique or tenant-scoped lookup on `(tenantId, spaceId, configurationName)`
- `(tenantId, spaceId, isActive, configurationName)`

## Existing-table changes

### `tbl_workflows`

| Proposed field | Required? | Relationship | Index |
| --- | --- | --- | --- |
| `locationId` | Optional | FK to `tbl_locations.id`, `ON DELETE RESTRICT` | `(tenantId, locationId)` |
| `spaceId` | Optional | FK to `tbl_spaces.id`, `ON DELETE RESTRICT` | `(tenantId, spaceId)` |
| `configurationId` | Optional | FK to `tbl_space_configurations.id`, `ON DELETE RESTRICT` | `(tenantId, configurationId)` |

Validation:

- location may be set without space/configuration
- space requires its parent location to match `locationId`
- configuration requires its parent space to match `spaceId`
- every referenced row must match `tbl_workflows.tenantId`

Legacy approach:

- keep the existing `tbl_workflow_field_values` row where `fieldKey='venue'`
- do not overwrite or delete it
- display it as legacy location until a structured location is selected
- optionally provide a reviewed matching tool later; do not automatically match by name

Code affected:

- workflow create/update/get/list actions
- workflow create/edit/detail pages
- dashboard and board queries
- reports and exports that display workflow location

### `tbl_tasks`

| Proposed field | Required? | Relationship | Index |
| --- | --- | --- | --- |
| `locationMode` | Required, default `inherit` | enum-like value: `inherit` or `override` | `(tenantId, locationMode)` |
| `locationId` | Optional | FK to `tbl_locations.id`, used for override | `(tenantId, locationId)` |
| `spaceId` | Optional | FK to `tbl_spaces.id` | `(tenantId, spaceId)` |
| `configurationId` | Optional | FK to `tbl_space_configurations.id` | `(tenantId, configurationId)` |

Rules:

- `inherit` means the task stores no duplicate location IDs and uses its parent workflow
- `override` permits its own validated IDs
- clearing an override returns the task to `inherit`
- one-off and template-generated tasks default to `inherit`

Code affected:

- task get/update/inbox/overview actions
- one-off task creation
- task edit and list pages
- task search
- effective-location partial

### Scheduled occurrences

No existing record can represent several dated workflow activities with different locations. Custom date fields and task due dates are not occurrence records.

Proposed table: `tbl_workflow_occurrences`

| Proposed field | Required? |
| --- | --- |
| `id` | Primary key |
| `tenantId` | Required FK |
| `workflowId` | Required FK |
| `taskId` | Optional FK when occurrence belongs to a task |
| `occurrenceType` | Required key such as rehearsal, performance, touring date |
| `title` | Required |
| `startDateTime`, `endDateTime` | Start required; end optional |
| `allDay` | Required, default 0 |
| `locationId`, `spaceId`, `configurationId` | Optional validated FKs |
| `legacyLocationText` | Optional external/customer-supplied text |
| `status` | Required |
| `notes` | Optional |
| `createdDate`, `modifiedDate` | Audit fields |

Required indexes:

- `(tenantId, startDateTime)`
- `(tenantId, workflowId, startDateTime)`
- `(tenantId, taskId, startDateTime)`
- `(tenantId, locationId, startDateTime)`
- `(tenantId, spaceId, startDateTime)`
- `(tenantId, status, startDateTime)`

This table should be the relational extension of existing workflow/task dates used by the future calendar. It must not create separate event or task records.

Initial migration should not convert custom milestone dates automatically. A reviewed mapping can optionally create occurrences from fields such as `show_date` and `on_sale_date` after their business meaning is confirmed.

## Effective-location query

Create a reusable Server Connect library action or shared SQL pattern returning:

- effective `locationId`, `spaceId`, `configurationId`
- names and location type
- source: `occurrence`, `task_override`, `workflow`, `legacy` or `none`
- inactive flags

Precedence:

1. occurrence structured values
2. task override values
3. workflow structured values
4. workflow legacy `venue` value
5. none

Every join must include matching `tenantId`.

## Shared dependent-option actions

Proposed Server Connect actions:

- `app/api/locations/options.json`
- `app/api/locations/spaceOptions.json`
- `app/api/locations/configurationOptions.json`

Rules:

- read `TENANT_ID` from session
- active-only by default
- accept a selected ID so an inactive currently linked value can still be returned during editing
- validate space belongs to selected location
- validate configuration belongs to selected space
- selecting records and managing records must use separate permission checks

## Permissions

Proposed permission keys:

- `locations.view`
- `locations.manage`
- `locations.spaces.manage`
- `locations.configurations.manage`
- `locations.select`

Role grants should be seeded separately and reviewed by tenant role.

Protected actions must:

1. require Wappler login
2. read `USER_ID` and `TENANT_ID` from session
3. validate active tenant membership through the existing tenant-role membership table
4. join role permissions through `tbl_role_permissions` and `tbl_permissions`
5. scope every location/space/configuration query by session tenant

Users with event/task edit permission and `locations.select` may select existing records without receiving management permission.

## Board and saved-view integration

Extend the existing catalogue in `app/api/board_views/available.json` with:

- `locationName`
- `spaceName`
- `configurationName`
- `effectiveLocation`
- `locationType`

Extend `app/api/board_views/board.json` with tenant-scoped joins or page-scoped location cells. Continue storing visibility, order, label and width in `tbl_board_view_columns`.

Do not create a location-specific saved-view table.

Location filtering should be added to the existing board request and persisted using the existing personal-view approach when filter persistence is implemented generally.

## Search integration

Workflow-board search should add `EXISTS` predicates for:

- location name
- space name
- configuration name
- town/city
- postcode

Task search should apply the effective-location precedence and search the effective structured location plus legacy venue fallback.

Search results must continue opening the workflow, task or occurrence—not the location record—unless the user explicitly searches within Location administration.

## Archiving

Use `isActive=0`; do not delete referenced locations, spaces or configurations.

Before archive, query counts for:

- active workflows
- future workflow occurrences
- open tasks using overrides

Historic references remain displayable. New-record dropdowns exclude inactive rows, while edit forms include their currently linked inactive selection and show an inactive warning.

Foreign keys should use `ON DELETE RESTRICT` for location catalogue references.

## Recommended migration sequence

1. Refresh Wappler's database metadata from the live database.
2. Add location permission records and reviewed role grants.
3. Add optional workflow references.
4. Add task inheritance/override fields.
5. Create the occurrence extension.
6. Add indexes and foreign keys for the new references.
7. Add shared option/effective-location actions and reusable partials.
8. Update workflow forms and displays while retaining legacy venue text.
9. Update task forms and displays.
10. Extend board/search.
11. Build the calendar on occurrences plus existing task dates.
12. Add location detail pages using filtered existing event/task queries.
13. Offer a reviewed legacy venue matching tool.

Each database step should be supplied as a separate manual migration containing:

```sql
USE `task_tracker`;
```

No migration should erase or overwrite `fieldKey='venue'` data.
