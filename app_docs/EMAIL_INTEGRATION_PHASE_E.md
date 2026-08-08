# Email Integration — Phase E completion

## Outcome

Phase E connects one authorised tenant workflow mailbox through server-side Hosted OAuth. It stops at secure connection management: no messages, threads, attachments, webhooks, matching, timelines, sending, replies, queues or mailbox browsing are implemented.

## Files created

- `db/20260807_email_integration_phase_e.js`
- `extensions/server_connect/modules/workflowMailbox.js` and five Wappler action definitions
- `app/api/email/integration/{status,connect,disconnect,updatePurpose}.json`
- `app/api/email/oauth/callback.json`
- `views/settings/email_integration.ejs`
- `tests/workflowMailbox.security.test.js`
- `tests/workflowMailbox.integration.test.js`

## Files modified

- `app/config/routes.json`
- `app/config/moduleCodes.json`
- `views/configuration/index.ejs`
- `package.json`

## Database changes

`tbl_email_oauth_states` stores only hashed OAuth state/session bindings and tenant-encrypted PKCE verifiers with ten-minute expiry and single-use timestamps. The migration also registers the optional billable `EMAIL_INTEGRATION` module, creates `email.integration.view` and `email.integration.manage`, and grants them through the existing owner/admin role architecture. No tenant entitlement is enabled automatically.

## Security

- Authentication, active tenant membership, module entitlement and existing permissions are rechecked inside every state-changing endpoint.
- Tenant/user identity comes exclusively from the server session.
- OAuth state is random, hashed at rest, bound to tenant, user and exact server session, expires after ten minutes and is consumed once.
- PKCE S256 is used; the verifier is AES-256-GCM encrypted using the Phase C tenant-derived key.
- Browser values for tenant, user, grant, provider and mailbox identity are ignored.
- Grant ID, provider and mailbox address come from the server-to-server token/grant responses.
- Mailbox address and display name are encrypted; the exact-match address index is tenant-derived HMAC.
- API keys and encryption keys are loaded only from server environment variables. The Development API key was moved from tracked Wappler JSON to the ignored `.env` file.
- Disconnect deletes the remote grant, marks the local record inactive and preserves historical communications.
- Reconnect updates the same local connection record.
- Audit rows contain no decrypted mailbox value.

## Environment

Required locally: `NYLAS_API_KEY`, `NYLAS_CLIENT_ID`, `NYLAS_API_URI`, `NYLAS_CALLBACK_URL`, `METIPATH_ENCRYPTION_KEY_VERSION`, and the matching versioned master key. API URI, callback, API key and a generated Development encryption key are configured in ignored `.env`. `NYLAS_CLIENT_ID` must still be supplied before live OAuth testing.

## Tests and results

- Phase C encryption: 7 assertions passed.
- OAuth state/session/tenant validation: 8 assertions passed.
- Database-backed module denial and secure-start integration: 10 assertions passed.
- JavaScript syntax and JSON validation passed.
- Phase E migration applied to local `task_tracker` and module/permission records verified.
- Customer-facing views contain no external integration-provider branding.

## App Connect

One read-only Server Connect data source displays module, permission and connection status. Connect/reconnect use a server redirect; disconnect and purpose changes use CSRF-protected POST forms.

## Dependencies and custom code

No package was added. Built-in `crypto` and `https` are used. Custom Node code is required for cryptographic OAuth state, PKCE, exact session binding, constant-time comparison, server-to-server token/grant/revoke calls, and safe orchestration that standard Server Connect formatters cannot express reliably.

## Known limitations

- Live Hosted OAuth cannot start until `NYLAS_CLIENT_ID` is configured and the exact callback URI is registered.
- The optional module must be enabled for the test tenant through existing platform module administration.
- Only one mailbox is exposed in Phase E; the database remains multi-mailbox capable.
- No provider grant health polling exists yet, so `reauthentication_required` will be set by later grant lifecycle/webhook work.

## Recommended Phase F

Implement tenant-scoped, retryable observation of selected mailbox messages behind an email adapter, without turning Metipath into a mailbox client. Keep message retrieval, thread capture and matching out of the Phase E connection service.
