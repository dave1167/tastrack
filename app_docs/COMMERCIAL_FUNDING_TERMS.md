# Commercial / Funding Terms

> Superseded for configurable business data by `CONFIGURABLE_FORMS.md`. The generic Record Form is now the active Commercial UI and typed-value source of truth; this earlier engine remains only for reviewing/migrating the uncommitted transitional work.

The `COMMERCIAL_DETAILS` tenant module now uses a configuration-driven terms engine. Dictionary entries control language; workflow-type configuration controls sections, options and responsibility definitions; workflow records store answers. Theatre-specific cost columns are not used.

## Wappler integration

- Event view: `views/partials/commercial_terms.ejs`, included by `views/workflows/view.ejs`.
- Tenant configuration: `/workflow-types/commercial?id=<workflowTypeId>`.
- Server Connect actions: `app/api/commercial/terms.json`, `saveAgreement.json`, `saveItem.json`, `removeItem.json`, `configuration.json`, and `saveConfiguration.json`.
- The actions call the Wappler custom module `extensions/server_connect/modules/commercialTerms.js` and use the configured `db` connection, Wappler session variables, CSRF protection and existing permission tables.
- No parallel Express routes, client framework, invoice engine or payment processor is introduced.

## Data model

`db/20260808_commercial_terms_engine.js` adds workflow-type section configuration, configurable agreement/responsibility options, responsibility item definitions, a structured agreement record and repeatable price, responsibility, adjustment, schedule and additional-value records. Amounts and percentages are numeric. All record and configuration access is tenant-scoped.

The migration is additive. Existing `tbl_workflow_commercial_details` and `tbl_workflow_price_entries` remain in place and useful legacy values are copied idempotently to the new model. The old event form is hidden as a rollback path until the new interface has been accepted.

## Permissions and audit

- `commercial.view`: read terms.
- Existing `commercial.manage` is accepted as the edit permission for compatibility.
- `commercial.configure`: configure a workflow type; seeded only to owner/admin roles.

Every mutation validates the authenticated tenant, workflow ownership and permission server-side. Changes are written to `tbl_activity_log` with before/after JSON where available. Child removal is a soft deactivation.

## Boundaries

This module records agreed commercial or funding terms. Contracts remain in the existing contract system and are summarized by status only. Payment schedules are agreement metadata, not transactions. No invoices, bookkeeping, settlement calculation, Stripe integration or payment collection are included.
