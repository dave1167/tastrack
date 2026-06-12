# Database Schema

This schema is for a Wappler Node.js SaaS application using MySQL or MariaDB. It models a generic, template-driven workflow and task tracker. The first seeded workflow can support theatre show booking and event delivery, but the core tables avoid theatre-specific names so the product can later support other operational workflows.

The design uses a single database with tenant-scoped rows. Tenant-owned tables include `tenantId`, and future Wappler Server Connect queries should take that value from the authenticated session, not from browser-submitted form data.

## Design Principles

- Organisations are represented by tenants.
- Users can belong to multiple tenants through tenant memberships.
- Workflow templates define stages, tasks, dependencies, fields, reminders and automation rules.
- Workflow instances snapshot template stages and tasks at creation time, so later template edits do not break live workflows.
- Custom fields are typed and can be marked sensitive or encrypted.
- Billing and usage tables exist from day one, while Stripe remains optional during development.
- Table names use `tbl_`, columns use camelCase, and tenant-owned records include `tenantId`.
- Tables use integer auto-increment primary keys, InnoDB and `utf8mb4`.

## A. Tenancy And Users

`tbl_tenants` stores each customer organisation. It includes status, timezone, locale and default currency fields that will be used for date handling, billing and reporting.

`tbl_users` stores login identities. Passwords are stored only as `passwordHash`; the schema does not include encrypted password fields.

`tbl_tenant_users` links users to tenants, supports multi-tenant users, and stores per-tenant membership status.

`tbl_roles`, `tbl_permissions` and `tbl_role_permissions` provide role-based access control. Roles may be tenant-specific or global system defaults.

`tbl_teams` groups tenant members for assignment, ownership and notifications.

## B. Workflow Templates

`tbl_workflow_templates` defines reusable workflow blueprints. Templates can be draft, published or archived, and include a version number to make controlled changes easier.

`tbl_template_stages` defines ordered stages in a template.

`tbl_template_tasks` defines reusable task blueprints. It supports default ownership, due-date rules, priority, reminders and task metadata.

`tbl_template_task_dependencies` defines task ordering inside a template, for example one task cannot start until another is complete.

`tbl_template_custom_fields` defines flexible typed fields for workflows, stages or tasks. This is where spreadsheet-derived fields such as event date, venue, contact email, contract returned, invoice received or payment made should be configured.

`tbl_template_custom_field_options` stores dropdown choices for custom fields.

`tbl_template_automation_rules` stores provider-neutral automation rule metadata. Rule logic is held as JSON so Wappler actions can later interpret it.

## C. Live Workflows

`tbl_workflows` stores live workflow instances. These are generic records with a name, optional reference code, workflow dates and ownership fields.

`tbl_workflow_stages` stores copied stage instances for a workflow. Stage names and settings are copied from the template so live workflows remain stable even if the template changes.

`tbl_tasks` stores copied or manually created live tasks. Ownership can be by user, team or role.

`tbl_task_dependencies` stores dependencies between live tasks.

`tbl_workflow_field_values` stores typed custom field values for each workflow. Plain values use type-specific columns. Sensitive values can use `encryptedValue`, `encryptionIv`, `encryptionAuthTag` and `keyVersion`.

## D. Contacts And Documents

`tbl_contacts` stores reusable tenant contacts without assuming a theatre-specific role.

`tbl_workflow_contacts` links contacts to workflows with a flexible relationship label such as primary contact, supplier, finance contact or venue contact.

`tbl_documents` stores document metadata and storage references. The actual storage provider integration is intentionally deferred.

## E. Activity And Notifications

`tbl_activity_log` stores an audit trail of workflow, task, document, billing and user activity.

`tbl_notifications` stores in-app or email notification records.

`tbl_task_reminders` stores scheduled reminders for tasks.

## F. Billing And Pricing

`tbl_plans` stores plan definitions such as trial, founder, starter, team, professional and enterprise.

`tbl_plan_prices` stores monthly, annual or manual plan pricing. Stripe price identifiers are nullable so development can proceed without Stripe.

`tbl_plan_features` stores plan limits and feature flags such as maximum users, active workflows, encrypted fields and API access.

`tbl_tenant_subscriptions` stores the active subscription state for a tenant. Stripe identifiers are nullable.

`tbl_tenant_subscription_items` stores item-level subscription details for future metered or multi-price billing.

`tbl_tenant_usage_snapshot` stores periodic usage counts for plan enforcement and reporting.

`tbl_usage_events` stores append-only usage events for features such as workflow creation, document uploads or automation runs.

`tbl_billing_customers`, `tbl_billing_invoices` and `tbl_billing_payments` store billing-provider metadata and manual billing records.

## G. Encryption And Key Metadata

`tbl_tenant_keys` stores metadata about per-tenant encryption keys. It does not store plain text keys. The application should keep actual encryption key material in a secure external secret store or key management service.

Sensitive custom fields are represented by `isSensitive` and `isEncrypted` on `tbl_template_custom_fields`, with encrypted values stored in `tbl_workflow_field_values`.

## Wappler Implementation Notes

Wappler Server Connect queries should always scope tenant-owned queries by the session tenant, for example `tenantId = $_SESSION.tenantId`. Do not trust `tenantId` values posted from forms or supplied in query strings.

Recommended query pattern:

1. Resolve the active tenant from the authenticated session and membership table.
2. Apply `tenantId = session.tenantId` to every tenant-owned select, insert, update and delete.
3. For inserts, set `tenantId` server-side from the session.
4. For updates and deletes, include both the record `id` and `tenantId` in the `WHERE` clause.
5. For joined records, ensure both the parent workflow and child table are tenant-scoped.
6. Use role and permission checks from `tbl_tenant_users`, `tbl_roles`, `tbl_permissions` and `tbl_role_permissions` before changing workflow, billing or user administration data.
7. Keep encrypted custom field handling in server-side modules; never decrypt sensitive field values in browser-side code unless the user is authorised to view them.

## Not Included Yet

- Full Stripe webhook processing and checkout flows.
- Document storage provider integration for local, S3, Spaces or other services.
- UI screens, Wappler pages or Server Connect actions.
- Seed data for the first example workflow template.
- Detailed reporting views and materialised analytics tables.
- Password reset, magic link and MFA tables.
- External API tokens and OAuth connection tables.
- Row-level database security; tenant isolation will initially be enforced in application queries.

## Review Decisions

- `currentStageId` on `tbl_workflows` is indexed but does not have a foreign key, avoiding a circular dependency during initial schema creation.
- Template and live workflow data are intentionally separate, so live records can snapshot copied stage and task names.
- Billing tables are provider-neutral with nullable Stripe columns.
- Custom field values support both typed plain values and encrypted values in the same table.