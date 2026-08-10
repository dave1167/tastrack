# Configurable Record and Task Forms

## Architecture

The generic form system is the source of configurable Record and Task business data. Core workflow/task identity, status, ownership, dates, location and audit information remain normal columns. Administrator-created scalar values use typed rows in `tbl_record_form_values` and `tbl_task_form_values`; multi-select, document-reference arrays and controlled repeatable rows use `valueJson` only.

Apply `db/20260808_configurable_forms.js`, then `db/20260808_seed_event_record_form.js`, and refresh the `db` connection schema in Wappler Database Manager. The seed is idempotent and creates the tenant-level Event Information example without making the engine event-specific.

Normal endpoints are Wappler Server Connect actions under `app/api/forms/`. They use the existing `db` connection and Security Provider. Tenant identity is always read from `TENANT_ID`; posted tenant IDs are ignored. Form-definition changes require `forms.manage`, granted to tenant Owner/Admin roles by the migration.

Published forms are immutable through the service. Duplicate a published form to make structural changes. Task responses retain both form ID and version. Clearing a field deletes its current typed-value row inside the same transaction, preventing stale values from returning.

## Essential custom code

`extensions/server_connect/modules/configurableForms.js` is called only by the thin Server Connect actions in `app/api/forms/`. Wappler Database Insert/Update actions require statically known columns and validation rules; an administrator-defined field collection is dynamic at runtime. This isolated module therefore performs the essential schema-driven work: tenant ownership checks, field/type validation, server-side condition evaluation, typed-column selection, and atomic upserts/deletes. It uses Wappler's existing Knex connection and session and defines no Express route.

`public/js/configurable-forms.js` handles immediate conditional visibility and repeatable-table Add/Delete Row interaction. It contains no permissions, database access or authoritative business validation. The server repeats all validation and condition decisions.

## Wappler maintenance

- Pages are EJS/App Connect/Bootstrap under `views/forms/` and `views/partials/configurable_form.ejs`.
- Dynamic sections and fields use App Connect repeat regions and dynamic attributes.
- Server actions remain visible/editable in Wappler under `app/api/forms/`.
- No frontend framework, ORM, bespoke Express API or arbitrary expression evaluator was added.
- Document fields store references only; file binaries continue to use Metipath's document subsystem.

## Commercial and Task integration

Workflow Templates select a published Record Form. The real workflow Commercial tab renders sections whose `displayLocation` is `commercial` and saves to `tbl_record_form_values`; the hidden legacy form is not submitted and is retained temporarily only as non-active rollback markup pending physical schema cleanup.

Task Templates select a published Task Form and one of `manual`, `require_before_completion`, or `complete_on_submission`. New real tasks snapshot this association. Task Form save and completion run in one transaction, and the normal task update endpoint refuses completion when a required response is not complete.

## Verification

Run `npm run test:configurable-forms` for deterministic type, validation, condition and repeatable-row tests. The Playwright Commercial test covers Revenue Split visibility, percentage persistence, repeatable ticket rows, reload, Forms administration, and typed-value database rows.
