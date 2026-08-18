# H4 Simulated External Communications

## Architecture

`TEST_EXTERNAL_COMMUNICATION_V1` is a neutral seven-step scenario pack. The scenario executor delegates incoming-message work to the narrow `scenarioCommunication` module. That module creates tenant-owned scenario resources and calls the existing `communicationEmail.ingest` domain path. It does not call or imitate the Nylas webhook endpoint.

The genuine communications implementation continues to provide encryption, participants, contact suggestions, the unmatched queue, manual allocation, thread links and workflow communication lists. The H4 source marker is `scenario`; platform/developer queries can also use `scenarioInstanceId` and `scenarioExecutionId`.

## Safe scenario mailbox and entitlement

An active demo instance receives one internal `tbl_email_connections` row with provider `scenario`, connection type `scenario_internal`, a tenant-encrypted `.invalid` address and no Nylas grant. The row exists because the established communication schema requires a source connection. The scenario enables the existing `EMAIL_INTEGRATION` tenant module only for its already-authorised active demo tenant, allowing the genuine UI and permissions to remain authoritative. Live, trial, expired, suspended and closed tenants cannot execute the action. The real mailbox sync control is hidden for a scenario provider; genuine entitlements and mailbox connections are unchanged.

## External contact mapping

The stable pack key `external_contact_1` resolves through `tbl_scenario_resource_mappings` to a tenant-owned `tbl_contacts` row for Jordan Reed (`jordan.reed@example.invalid`). The contact is linked to the mapped target workflow with the normal `tbl_workflow_contacts` relation, which produces the existing known-contact suggestion. Identical names and addresses in another demo resolve to different tenant-specific IDs.

The target workflow is mapped as `communication_record`. H4 reuses the tenant's first workflow where one exists. A neutral technical workflow and status are created and mapped only when the tenant has no workflow.

## Encryption and synthetic identifiers

Subject, body, sender, recipients, participant names/addresses and the scenario mailbox use `metipathSecurity`, the same AES-256-GCM tenant-derived encryption contexts as genuine communications. No sensitive message value is stored in plaintext.

Synthetic identifiers are deterministic inside an instance:

- thread: `scenario:{scenarioInstanceId}:{threadKey}:thread`;
- message: `scenario:{scenarioInstanceId}:{messageKey}:message`.

The source connection is tenant/instance-specific, so identical pack keys cannot collide between tenants. The existing unique email-metadata key plus scenario execution idempotency prevents duplicate messages.

## Unmatched allocation and trigger

The first message has no reference in its content, so normal ingestion leaves it `unmatched`/`pending_review`. The mapped contact creates a normal suggested workflow. The user allocates it through `/communications/mailbox` and `/api/communications/assign`; that endpoint creates both the communication link and provider-thread link, updates status, resolves suggestions and writes its normal activity entry.

The next scenario action `wait_communication_linked` queries the authoritative tenant-scoped communication link. A click cannot bypass allocation, and the state survives refresh or a later login.

## Thread auto-linking

The second incoming message uses the same synthetic thread. Normal ingestion finds the existing thread's workflow link and creates the second communication as `linked`/`matched` with relationship `linked_thread`. H4 adds no demo-only auto-link rule.

## Notifications and activity

Current genuine incoming ingestion does not create an in-app notification, so H4 does not invent one. Manual allocation continues to create the existing `EMAIL_MANUALLY_LINKED` activity. The communication and thread retain scenario provenance for support and future reset.

## Simulated time

`occurredDate` uses `tbl_scenario_instances.simulatedDateTime` when configured; insertion and audit timestamps continue to use actual database time. No process or database clock is changed.

## H5 reset inventory

H5 must operate in authenticated tenant and scenario-instance scope and account for:

- `tbl_scenario_executions` and `tbl_scenario_resource_mappings`;
- scenario-created `tbl_contacts` and `tbl_workflow_contacts`;
- a scenario-created workflow/status only when H4 had to create them;
- scenario `tbl_email_connections` and any scenario-created `tbl_tenant_modules` entitlement;
- `tbl_communication_threads`, `tbl_communications`, email metadata and participants;
- match suggestions, communication links and thread links;
- allocation activity records and any future notifications;
- the scenario instance's progress and simulated time.

H4 intentionally implements no deletion, cleanup or reset.

## Deployment and Wappler

Apply `db/20260818_h4_simulated_external_communications.js`, then in the Wappler Development target open Database Manager, select `db`, and use **Refresh/Reload Schema from Database**. No external mailbox, Nylas grant, new dependency, worker or storage service is required.
