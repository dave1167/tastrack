# Switchable tenant modules

Tastrack core functionality remains available through the permanent `CORE` module. Optional functionality is represented by catalogue records in `tbl_modules` and tenant entitlements in `tbl_tenant_modules`; no module Boolean columns are added to `tbl_tenants`.

## Canonical module codes

The canonical codes are stored in `app/config/moduleCodes.json`:

- `CORE`
- `LOCATIONS`
- `CONTRACT_GENERATION`
- `ADVANCED_NOTIFICATIONS`
- `WHITE_LABEL_EMAIL`

Module codes are permanent identifiers and must not be renamed after use.

`LOCATIONS` controls the location, space and configuration catalogue plus event venue assignment. It is initially included for every existing tenant. When disabled, existing event location information remains visible read-only, but catalogue changes and venue reassignment are blocked.

## Runtime access

`app/api/library/modules/checkTenantModule.json` checks the active session tenant and returns the effective entitlement.

`app/api/library/modules/requireTenantModule.json` rejects unavailable module access with HTTP 403. Every future paid-module Server Connect action must perform this check before reading or changing module-owned data. Normal user permissions remain a separate, additional requirement.

`app/api/modules/currentTenantModules.json` is the shared interface data source. The main layout loads it once as `scTenantModules`; module-specific navigation and buttons should bind to this source rather than issuing page-specific database queries.

## Platform administration

Platform administrators are identified by `tbl_users.isPlatformAdmin`. This is separate from tenant roles. The first migration bootstraps one active owner only when no platform administrator exists.

- `/platform/modules` manages the catalogue.
- `/platform/tenant-modules` manages tenant status, billing interval, price overrides, trials and access dates.

Entitlement changes run in a database transaction and append to `tbl_tenant_module_history`. Core cannot be disabled. Required dependencies are checked before activation and active dependants block deactivation.

## New tenants

The `trg_tbl_tenants_assign_core` database trigger creates an included, active Core entitlement inside the same database transaction as every new tenant insert. If Core cannot be assigned, tenant creation fails and rolls back.

## Disabling modules

Set the tenant entitlement status to `DISABLED`, `SUSPENDED` or `EXPIRED`. Never delete the entitlement or module-owned business records. Contract Generation will use a read-only policy for retained final documents when its write entitlement is unavailable.

## Contract Generation

`CONTRACT_GENERATION` provides tenant-scoped, versioned contract templates and event merge fields.

- Owners and admins manage templates at `/contract-templates`.
- Templates use Summernote and approved tokens such as `{{event.name}}` and `{{location.name}}`.
- Server Connect replaces only supported tokens using tenant-scoped event data.
- Generated contracts are immutable HTML snapshots in `tbl_generated_contracts`.
- Generated contracts appear in the event Documents tab and record `contract.generated` activity.
- Saving an existing template creates a version snapshot before updating it.
- The Clause Library stores tenant-owned reusable wording in `tbl_contract_clauses`.
- Inserting a clause copies its wording into the template and records its source and order in `tbl_contract_template_clauses`.
- Clause headings and top-level ordered-list items are renumbered before every template save.
- Library edits never rewrite existing template content or generated contracts.
## Contracting entities

Owners and administrators can manage multiple legal organisations under **Setup → Contracting Entities**. One active entity can be the tenant default, while each event can select a different entity.

Contract templates may merge legal name, trading name, registration and VAT numbers, registered address, signatory, payment terms and footer fields. When a contract is generated, the selected entity and a JSON snapshot of its legal details are stored on `tbl_generated_contracts`; later Setup changes therefore do not alter the historical contract record.

Bank details are deliberately excluded from this first version.
