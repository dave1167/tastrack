# Location Integration Review

## Status

This review records how Tastrack currently stores and displays location-like information. It is the required discovery step before a structured Locations module is connected.

No database tables or production fields were created or altered during this review.

## Executive finding

The live `task_tracker` database already contains:

- `tbl_locations`
- `tbl_spaces`
- `tbl_space_configurations`
- `vw_location_space_configurations`

These are tenant-scoped and currently contain no catalogue records. The checked-in
Wappler database metadata is stale and should be refreshed through Wappler, not
edited by hand.

Tastrack now contains:

- workflow-level `locationId`, `spaceId` and `configurationId`
- task-level `locationMode`, `locationId`, `spaceId` and `configurationId`
- tenant-scoped dependent location option actions
- event create/detail location selection and effective-location display
- task location inheritance and tenant-validated override controls

Tastrack does not yet contain:

- a scheduled-occurrence table
- calendar pages or calendar Server Connect actions
- a Locations management interface

The only event venue in the current theatre workflow is a template custom field:

- field key: `venue`
- field type: text
- stored in: `tbl_workflow_field_values.valueText`

This is legacy free text and must remain available after structured locations are introduced.

## Existing authoritative catalogue

`tbl_locations` contains the name, type, full address, contact details,
directions, accessibility/general notes, ordering, active state and audit dates.
It has tenant-aware indexes and a unique location name per tenant.

`tbl_spaces` belongs to a location and contains its name, type, description,
default capacity, accessibility notes, ordering and active state. Its composite
foreign key requires the parent location to belong to the same tenant.

`tbl_space_configurations` belongs to a space and contains capacities, crew
allowance, setup/reset times, staffing/security requirements, accessibility and
operational notes, ordering, default state and active state. Its composite
foreign key requires the parent space to belong to the same tenant.

`vw_location_space_configurations` is the existing flattened read model.

## Current workflow location handling

### Storage

`tbl_workflows` stores workflow identity, ownership, status and dates. It has no location foreign keys.

`tbl_template_custom_fields` defines the reusable `venue` field for theatre templates:

- `db/amend_main_house_template.sql`
- `db/seed_alternative_test_template.sql`

Each live workflow receives a corresponding row in `tbl_workflow_field_values` when it is created:

- `app/api/workflows/create.json`

The venue value is held in `tbl_workflow_field_values.valueText` where `fieldKey='venue'`.

Demo venue text is populated by:

- `db/seed_six_demo_shows.sql`

### Create and edit actions

The standard workflow create and edit forms currently expose:

- workflow name
- reference code
- owner team
- status
- start date
- target date

They do not expose custom-field editing or structured locations:

- `views/workflows/create.ejs`
- `views/workflows/edit.ejs`
- `app/api/workflows/create.json`
- `app/api/workflows/update.json`

Historic venue text must therefore be treated as template/custom-field data, not silently moved or overwritten by those actions.

### Detail and list display

The event detail API currently reads the workflow row plus show date/time custom fields:

- `app/api/workflows/get.json`
- `views/workflows/view.ejs`

Venue is available in the configurable board as `field:venue` because all active template custom fields are included:

- `app/api/board_views/available.json`
- `app/api/board_views/board.json`
- `views/workflows/workflows.ejs`
- `db/seed_dynamic_board_columns.sql`

The board search searches all workflow custom-field values. A legacy venue can therefore already match event-board search.

## Current task location handling

`tbl_tasks` has no location fields. A task currently stores:

- parent workflow and stage
- name and description
- status and priority
- assignee
- due/start/completion dates

Task creation copies template tasks into a workflow, but no location value is inherited:

- `app/api/workflows/create.json`
- `app/api/workflows/create_task.json`

Task edit and list queries do not expose a location:

- `views/tasks/edit.ejs`
- `views/tasks/tasks.ejs`
- `app/api/tasks/get.json`
- `app/api/tasks/update.json`
- `app/api/tasks/inbox.json`

There is therefore no current way to distinguish inherited and overridden task locations.

## Dates, scheduling and calendar

Tastrack currently represents dates through:

- `tbl_workflows.startDate`
- `tbl_workflows.targetDate`
- custom date fields in `tbl_workflow_field_values`, including `show_date`, `announcement_embargo_date` and `on_sale_date`
- `tbl_tasks.dueDate`, `startedDate` and `completedDate`
- `tbl_task_reminders.reminderDate`

There is no occurrence record that can represent several dated activities with separate locations. Custom date fields describe milestones but are not individual relational records.

There is currently no calendar view, calendar API, repeating-event model or calendar filter system in the repository.

## Contact addresses are not event locations

`tbl_contacts` stores postal address fields:

- `addressLine1`
- `addressLine2`
- `city`
- `region`
- `postcode`
- `country`

These fields describe a contact or organisation. They must not be reused as the authoritative event-location catalogue. A venue contact may remain linked to a workflow through `tbl_workflow_contacts`, but that relationship does not prove which location, space or configuration is used by the event.

## Existing board and saved-view model

Tastrack already has the correct saved-view foundation:

- `tbl_board_views`
- `tbl_board_view_columns`
- `app/api/board_views/available.json`
- `app/api/board_views/board.json`
- `app/api/board_views/setColumn.json`
- `app/api/board_views/savePersonal.json`

Structured Location, Space, Configuration, Effective location and Location type columns should be added to this catalogue. A separate location-specific saved-view system must not be created.

## Search

Current event-board search covers:

- workflow name
- reference code
- task name
- all workflow custom-field scalar text/number values

Current task search covers:

- task name and description
- workflow name and reference
- stage
- assignee

After migration, both searches need tenant-scoped joins to the structured
location tables. Town/city and postcode already exist on `tbl_locations`, but
cannot yet be associated with an event.

## Permissions

Page routes use Wappler Security Provider login restrictions and, for administration pages, broad provider permissions such as `owner-admin`.

Task updates additionally perform a server-side tenant/team/owner authority query in `app/api/tasks/update.json`.

The database has `tbl_permissions` and `tbl_role_permissions`, but no location permission keys are currently defined in repository migrations. The proposed location permissions must be checked in Server Connect actions using tenant membership and role-permission joins; frontend visibility alone is insufficient.

## Precedence after migration

All display queries and the reusable effective-location component should use:

1. Scheduled occurrence location
2. Task override location
3. Parent workflow location
4. Legacy `fieldKey='venue'` text
5. No location recorded

Legacy text must be labelled clearly when it supplies the effective value, for example:

> Legacy location: Grand Theatre, Blackpool

## Files affected after migration approval

### Workflows

- `views/workflows/create.ejs`
- `views/workflows/edit.ejs`
- `views/workflows/view.ejs`
- `views/workflows/workflows.ejs`
- `app/api/workflows/create.json`
- `app/api/workflows/update.json`
- `app/api/workflows/get.json`
- `app/api/workflows/list.json`

### Tasks

- `views/tasks/edit.ejs`
- `views/tasks/tasks.ejs`
- `app/api/tasks/get.json`
- `app/api/tasks/update.json`
- `app/api/tasks/inbox.json`
- `app/api/workflows/create_task.json`
- `app/api/workflows/tasks.json`

### Board and search

- `app/api/board_views/available.json`
- `app/api/board_views/board.json`
- existing task and workflow search actions

### New shared application components

After the reference fields and permissions exist, create reusable partials under
`views/partials/locations/` for:

- dependent location/space/configuration selector
- effective-location display
- location badge
- inactive-location warning
- location filter

The dependent selector should use shared tenant-scoped Server Connect option actions. It must not duplicate option queries inside each feature.

## Implementation status

The catalogue option layer, event assignment and task inheritance/override
controls are implemented against the existing tables. Occurrence locations,
structured board columns and the calendar remain later integration stages.
Catalogue IDs are never written into free-text fields.
