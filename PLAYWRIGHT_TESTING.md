# Meldren Playwright testing

Phase 1 covers authentication, logout, isolated simultaneous sessions, tenant isolation, direct record access, tenant administration permissions, read-only access and a principal-page smoke check. Phase 2 adds workflow, task, concurrency, location, saved-view and audit-history coverage. Phase 3 covers contracts, clauses, versioning and PDF documents.

## Prerequisites

- Node.js and the project's npm dependencies
- MySQL/MariaDB accessible on a local test host
- A development schema that can be cloned to create the isolated test schema
- Chromium installed with `npx playwright install chromium`

## Configure the test environment

1. Copy `.env.test.example` to `.env.test`.
2. Supply local test database details and dedicated E2E credentials.
3. Keep `E2E_TEST_ENV=true` and use a database name ending in `_e2e`.
4. Keep the test URL local and separate from the development application (the example uses port 3100).

`.env.test` is ignored by Git. Never place production passwords, API keys or live service credentials in it.

The safety validator refuses to run unless the explicit test flag is enabled. It also rejects remote application/database hosts, production-like database names, a source and test schema with the same name, and test schemas without the `_e2e` suffix.

## Run the tests

The normal command rebuilds the test database, starts an isolated copy of Meldren, runs Chromium headlessly and stops the isolated server:

```text
npm run test:e2e
```

Other commands:

```text
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:report
npm run test:e2e:phase1
npm run test:e2e:phase2
npm run test:e2e:phase3
npm run test:e2e:contracts
npm run test:e2e:workflows
npm run test:e2e:concurrency
npm run test:e2e:tasks
```

The suite starts its own application on `E2E_BASE_URL`; do not start the normal development application for the suite. The runtime copy is created under `tmp/e2e-runtime`. It uses only the E2E database and disables email delivery and live external services.

To rebuild only the deterministic test data:

```text
npm run test:e2e:seed
```

## Test data reset

Before each normal suite run, `tests/e2e/setup/seed-test-data.js` validates the target name, drops only the designated `_e2e` schema, clones the development schema, clears session data and creates two recognisable tenants with dedicated users, workflows, tasks, teams and locations. IDs are written to the ignored `tests/e2e/.state/test-data.json` file.

The reset is destructive only to the explicitly configured E2E schema. Never point `E2E_DB_NAME` at a schema containing data that must be retained.

## Reports and failure evidence

- HTML report: `playwright-report/`
- Screenshots, retained videos and traces: `test-results/`
- Open the last HTML report with `npm run test:e2e:report`

Screenshots are captured on failure, videos are retained on failure, and a trace is captured on the first CI retry. Local runs do not retry; CI runs retry twice.

## Add another role-based test

1. Add the user and membership deterministically in `seed-test-data.js`.
2. Expose the user through `testUsers()` in `tests/e2e/fixtures/meldren.js`.
3. Use `loginAs()` or `newAuthenticatedContext()` rather than duplicating login code.
4. Verify both visible navigation and a direct protected page or Server Connect request.
5. Confirm the resulting database state where a mutation was attempted.
6. Use accessible labels or a small Wappler-compatible `data-testid`; avoid generated IDs and positional selectors.

## Phase 1 application defects found and corrected

- The existing sign-out link opened the login page without destroying the server session. It now uses a standard Server Connect logout action.
- Inactive or unassigned accounts could authenticate before later login steps failed. The login action now clears the authentication state and redirects those accounts to the controlled unauthorised page.
- The tenant role-options action allowed an ordinary member to reach the action and returned an internal error. It now has a standard owner/admin restriction.
- The workflow edit page and versioned update action did not consistently enforce edit permission. Both the route and mutation action now enforce it.

## Phase 1 assumptions and boundaries

- The existing global role records are used by the deterministic test tenants.
- Workflows currently have no delete/archive endpoint, so the suite records that boundary and verifies view/update refusal and unchanged database state instead of inventing an endpoint.
- Chromium is the only browser in Phase 1.
- Email and third-party delivery are outside this phase and remain disabled.

## Phase 2 coverage

- Workflow creation, editing, required-field validation, duplicate submission protection and cancellation
- Workflow optimistic locking, including conflict detection and a safe reload-and-retry path
- Task creation, editing, assignment, status changes, completion details and parallel updates
- Tenant isolation for workflows, tasks, locations, spaces, configurations, saved views and audit records
- Location, space and configuration creation and workflow assignment
- Personal and tenant-default board column preferences
- Audit entries for significant workflow and task changes

Seven numbered scenarios are intentionally reported as skipped, rather than pretending that unsupported behaviour passed:

- P2-4: the product has no confirmed cross-field workflow date rule to test
- P2-10 to P2-12: required-task phase completion and approval/rejection are not implemented
- P2-24 to P2-26: workflow archive, restore and protected permanent deletion are not implemented

Two tests document known defects as expected failures while continuing to run on every suite:

- P2-18: an inactive location remains visible historically, but a direct workflow update can still assign it to a new record
- P2-23: the activity-list action isolates tenants but does not yet require the dedicated `tenant.audit.view` permission

## Phase 2 application defects found and corrected

- Workflow creation accepted missing required values through a direct Server Connect request. Standard Wappler required validation now protects those fields server-side.
- New personal board views used the wrong insert-result property, preventing their selected columns from being saved. The standard database insert ID is now used.
- Long suites could occasionally encounter a transient login-page reload while the isolated server settled. The login fixture allows up to three controlled attempts without weakening any authentication assertion.

## Phase 3 coverage

- Contract detail and editor tenant isolation
- Draft HTML/name persistence and row-version increments
- Library-clause duplicate protection and contract-specific custom wording
- Optimistic locking for simultaneous draft editors
- Refusal of draft mutations by users without contract-edit permission
- Issuing, immutable version snapshots, SHA-256 metadata and PDF download
- Cross-tenant PDF refusal
- Locking issued wording and creating a new draft revision without changing issued history
- Permanent deletion of a never-issued draft, including associated clause snapshots

P3-2 is explicitly skipped because `/api/contracts/generate` does not complete in the isolated runtime and times out before inserting a draft. This is a product defect, not a test limitation; it needs fixing before the generation and merge-field scenario can pass.

## Latest verified result

Command used by the normal npm script:

```text
node tests\e2e\setup\run-e2e.js --reporter=line
```

Phase 1 result on 1 August 2026: **10 passed in 30.9 seconds**.

Phase 2 result on 1 August 2026: **19 passed and 7 explicitly skipped in 1.2 minutes**. The 19 passing results include the two documented expected-failure checks, which succeeded by reproducing the known defects.

Both runs use the isolated `task_tracker_e2e` database and local test server. The wrapper confirms that the isolated server closes after every run.

Combined verification on 1 August 2026: **29 passed and 7 explicitly skipped across 36 scenarios in 1.5 minutes**, with a successful exit status.

Phase 3 result on 1 August 2026: **8 passed and 1 explicitly skipped in 1.5 minutes**. PDF creation, stored-file integrity, version snapshots and tenant-protected download all passed.

Across the independently completed phase runs there are now **37 passing checks and 8 explicit skips across 45 scenarios**. During the final combined invocation, all Phase 1 and Phase 2 scenarios completed and Phase 3 reached PDF issuing before the outer five-minute command limit stopped the process; no test failure was reported. For dependable local verification, run the three phase commands separately.
