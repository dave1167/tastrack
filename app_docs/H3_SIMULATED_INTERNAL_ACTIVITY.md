# H3 simulated colleagues and internal activity

## Design

Simulated colleagues are genuine `tbl_users` rows for compatibility with existing foreign keys, display names, tasks, chat and audit history. Their tenant relationship is explicitly marked `tbl_user_tenants.actorType='simulated'`. Every scenario instance receives its own actor rows and `tbl_scenario_actor_mappings` entries keyed by stable scenario keys such as `operations_coordinator` and `technical_coordinator`; reusable packs never contain database user IDs.

H3 uses the neutral `TEST_INTERNAL_ACTIVITY_V1` pack. It creates Alex Morgan (Operations Coordinator) and Sam Taylor (Technical Coordinator) only when their first action executes. Addresses use the non-deliverable `.invalid` domain. Password hash and verification token remain `NULL`; actors are never platform administrators.

## Authentication and account management

Normal login access resolution, tenant selection and tenant options require `actorType='human'`. The H2 central write guard also requires a human membership, so a forged simulated-user session cannot perform tenant writes. The scenario engine independently requires the initiating prospect to have a human membership.

Simulated actors have no invitation, verification or password-reset token. No password-reset endpoint exists in the current application. Existing invite APIs reject an existing membership, including a simulated membership. The tenant-user administration list shows a **Simulated** badge and does not offer its normal Edit action for these actors.

## Scenario actions and genuine domain records

`scenarioActivity` implements the narrow orchestration that Server Connect cannot safely express without duplicating a large transaction:

- `task_complete` resolves `technical_coordinator`, creates/maps the neutral `review_task`, applies genuine task completion fields and workflow/stage roll-up, and writes normal activity history as Sam Taylor.
- `chat_message_send` resolves `operations_coordinator`, creates/reuses the normal direct conversation, creates normal participants, encrypts through the existing `chatCrypto` AES-256-GCM implementation, inserts a normal chat message, creates a normal in-app notification, and writes normal activity history as Alex Morgan.
- `wait_chat_read` inspects the normal participant `lastReadMessageId`; progression remains blocked until the prospect opens the message through normal chat.

Database records and notifications remain authoritative if realtime socket delivery is unavailable. H3 introduces no demo-only chat, notification, task or websocket implementation and no continuous polling.

## Isolation, lifecycle and idempotency

Every operation starts from a session tenant plus scenario instance, verifies an active `demo` tenant and access dates, verifies the initiating human membership, then resolves actors/resources using tenant and instance together. Live tenants, trials, expired/suspended demos and cross-tenant IDs are rejected.

`tbl_scenario_executions` remains the idempotency authority. The action, scenario execution, generated message/notification/activity and scenario progression share one database transaction. Unique scenario-execution indexes prevent duplicate generated records. A completed action retry returns its recorded result without rerunning side effects.

## Provenance and future H5 reset

Chat messages, notifications and activity records carry `scenarioInstanceId` and `scenarioExecutionId`. Pre-existing tasks are not silently overwritten: H3 creates and maps its neutral task through `tbl_scenario_resource_mappings`, while the execution result records its previous state. A future H5 reset must handle, in dependency-safe tenant/instance scope:

1. scenario executions;
2. scenario-linked activity and notifications;
3. mapped encrypted chat messages, participants and conversations where no retained human data depends on them;
4. mapped scenario tasks and their workflow/stage roll-up effects;
5. resource and actor mappings;
6. simulated role/team memberships, tenant memberships and user rows when no other retained reference exists.

H3 deliberately performs none of this deletion.

## Billing and email

No current seat-limit or paid-user counting implementation was found. Billing must explicitly exclude `actorType='simulated'` when introduced. H3 sends no transactional or external email, creates no Nylas data and creates no mailbox account.

## Database and Wappler

Migration `db/20260818_h3_simulated_internal_activity.js` adds:

- `tbl_user_tenants.actorType` and tenant/actor index;
- `tbl_scenario_actor_mappings`;
- `tbl_scenario_resource_mappings`;
- nullable scenario provenance columns on chat messages, notifications and activity history;
- unique tenant/execution indexes for generated records;
- the neutral H3 technical scenario pack and five steps.

After applying the migration in each environment through the normal reviewed migration process, refresh Wappler's database schema from the target database: select the target, open Database Manager, select `db`, choose **Refresh/Reload Schema from Database**, review the detected changes and save. Never push stale development metadata into another environment.

## Verification

- `node tests/h3SimulatedActivity.test.js`
- `node tests/h1DemoLifecycle.test.js`
- `node tests/h2TenantLifecycle.test.js`
- `node tests/e2e/setup/run-e2e.js h3-simulated-activity.spec.js --workers=1`

The integration test proves two concurrent demos with identical actor names/different IDs, encrypted messaging, real notifications, task completion/audit attribution, user-action gating, idempotency, cross-tenant rejection and lifecycle/type rejection. The Playwright test follows the scenario in the normal UI and separately proves that even a simulated membership temporarily given a usable test password hash cannot select a tenant session.
