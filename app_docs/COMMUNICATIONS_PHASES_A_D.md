# Metipath Communications Layer — Phases A–D

## Phase A — architecture review

Metipath already provides the permanent application architecture. The communications work reuses:

- tenancy and membership: `tbl_tenants`, `tbl_user_tenants`;
- roles and permissions: `tbl_user_tenant_roles`, `tbl_roles`, `tbl_permissions`, `tbl_role_permissions`;
- teams: `tbl_teams`, `tbl_team_members`, team roles and permissions;
- entitlements: `tbl_modules`, `tbl_tenant_modules`, and the existing module guard library;
- workflow records: tenant-scoped `tbl_workflows` with generic integer IDs;
- audit and notifications: `tbl_activity_log`, `tbl_activity_types`, `tbl_notifications`;
- contacts: `tbl_contacts` and `tbl_workflow_contacts`; email addresses remain attributes, not identities;
- documents: `tbl_documents` stores metadata/path only; binaries remain outside MySQL;
- key metadata: `tbl_tenant_keys` stores references and versions, never master key material;
- security/session: Wappler Security Provider plus server-side `USER_ID`/`TENANT_ID` and membership/permission checks;
- Server Connect: feature APIs under `app/api`, reusable libraries under `app/api/library`, and narrowly-scoped Node extensions only where Wappler actions are insufficient.

No existing generic communication, communication-link, or communication-thread tables were found. Team chat is a separate interactive feature and is not suitable as the permanent communications record. No configured DigitalOcean Spaces provider was found; current documents use local storage while retaining provider/path fields suitable for a later Spaces adapter.

Permanent boundary: source adapter → `tbl_communications` → generic entity links → workflow/entity. Nylas is only the Version 1 email source. Source connection IDs on generic tables are intentionally polymorphic and have no email-only foreign key.

## Phase B — database foundation

The Wappler/Knex schema migration is `db/20260807_communications_foundation.js`. It adds email connections, communications, threads, email metadata, generic communication/thread/document links, and communication attachments. It extends `tbl_documents` with encrypted original-filename components, checksum, encryption/key versions, and deletion date.

Lifecycle columns support `observed`, `pending_review`, `matched`, `ignored`, and `archived` without implementing processing. The email idempotency key is unique on `(emailConnectionId, nylasMessageId)`. There is no unique tenant/mailbox constraint, so a tenant can have multiple connections. No queue, channel UI, matching workflow, or new contact subsystem is included.

The migration uses Knex schema-builder calls compatible with Wappler's Node database layer; it contains no handwritten SQL. Refresh the Development database schema in Wappler Database Manager after applying it.

## Phase C — encryption foundation

`metipathSecurity` provides AES-256-GCM encrypt/decrypt/verify and deterministic HMAC-SHA-256 blind indexes. A 32-byte Base64 master key is loaded only from server environment variables. HKDF-SHA-256 derives separate tenant-, version-, context-, and purpose-specific encryption/blind-index keys. Tenant/context/version are authenticated as AAD. Random 96-bit IVs prevent repeat plaintext from producing repeat ciphertext.

Master keys are not stored in MySQL or accepted as action inputs. `tbl_tenant_keys` remains metadata-only. Full-text encrypted search is not provided. Callers must supply `TENANT_ID` from the authenticated server session, never a browser tenant value.

## Phase D — Nylas Sandbox foundation

Environment templates are separate for development, staging, and production. Nylas v3 uses the application API key, API URI, client/application ID, and registered callback URI. A webhook secret is included as a future destination-generated value, but no webhook endpoint is implemented in A–D. Sandbox applications have preconfigured connectors; no production mailbox is connected.

Real secrets belong in Wappler target/server environment configuration and must never be committed, returned through App Connect, logged, or stored in MySQL. The example staging/production hostnames must be replaced during deployment. The callback path is reserved for Phase E and does not exist yet.

## A–D completion inventory

1. Files: migration, security extension/action definitions, security tests, environment templates, and this document.
2. Database: seven new tables plus encryption/checksum metadata on `tbl_documents`.
3. Indexes/constraints: tenant/status/date lookup indexes, generic entity indexes, tenant-aware IDs, and Nylas message idempotency.
4. Server Connect: four reusable low-level security actions; no business workflow actions.
5. App Connect: none.
6. Environment: `METIPATH_ENCRYPTION_KEY_VERSION`, versioned master key, and five Nylas variables.
7. Packages: none; Node's built-in `crypto` is used.
8. Custom Node: `metipathSecurity.js` only.
9. Custom-code reason: Server Connect formatters do not provide reusable tenant-derived AES-GCM with AAD, rotation metadata, and blind indexes.
10. Security: authenticated encryption, tenant/context isolation, HKDF separation, deterministic exact-match hashes, no plaintext logging.
11. Tests: syntax, round trip, randomized ciphertext, tamper rejection, wrong-tenant rejection, deterministic normalization, tenant-separated hashes, JSON/diff validation, and schema migration execution.
12. Results: record actual migration/test results in the delivery report.
13. Limitations: no production secret provisioning, Spaces adapter, key rotation job, full-text search, or Phase E functionality.
14. Phase E recommendation: add permission/module-gated connection workflow, OAuth state validation and callback exchange, then retryable tenant-scoped ingestion behind a small Nylas adapter.
