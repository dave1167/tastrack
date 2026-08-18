# Demo and trial lifecycle foundations (H1)

`tbl_tenants.tenantType` classifies a tenant as `live`, `demo` or `trial`. `lifecycleStatus` independently records `active`, `expired`, `read_only`, `suspended` or `closed`. Existing tenants default to `live` and `active`. Access, expiry, retention, cleanup-eligibility and conversion dates are tenant-level metadata; H1 does not perform cleanup.

Lifecycle changes are restricted to active platform administrators and are written to `tbl_tenant_lifecycle_history`. Tenant users cannot extend or reactivate themselves. The reusable actions under `app/api/library/security/` expose lifecycle context, tenant-write permission and active-demo eligibility. H1 applies the write check to scenario progression and workflow creation as the representative protected business write. Remaining mutating Server Connect actions must adopt the same check in later phases; UI hiding is not security enforcement.

Scenario definitions are versioned in `tbl_scenario_packs` and `tbl_scenario_steps`. Progress belongs to a tenant-specific `tbl_scenario_instances` row. `tbl_scenario_executions` has a unique tenant/idempotency key so a one-time step cannot produce duplicate execution records. Scenario APIs derive tenant identity from `$_SESSION.TENANT_ID` and never accept a tenant ID from the browser.

H1 seeds only `TEST_DEMO_V1`, a neutral three-step narrative test. It creates no simulated users, messages, communications, tasks, documents or reset behaviour. A future simulated actor must be marked at tenant-membership level, must have no usable credentials, and must never pass normal authentication.

Platform administrators manage lifecycle data at `/platform/tenant-lifecycle`. Active demo tenants with an assigned scenario can use `/demo/test-scenario`. Trial-to-live conversion retains the same tenant ID and all tenant-owned data; billing conversion is outside H1.

The development Wappler database definition was found to lag later applied migrations. H1 therefore uses an additive migration with table/column existence checks and does not rewrite historical migrations.
