# Email Integration — Phase F completion

Phase F adds a Wappler Server Connect/App Connect live mailbox browser at `/communications/mailbox`. It lists 25 recent messages through the connected tenant-owned grant and retrieves one message only when opened. No email content is written to MySQL, `tbl_communications`, `tbl_documents`, files, or caches.

## Implementation

- Server Connect: `app/api/email/mailbox/messages.json` and `message.json`.
- App Connect/EJS: mailbox list and message detail pages using the existing `main_shell`.
- Navigation: Communications appears when the existing `EMAIL_INTEGRATION` entitlement is active.
- Technical adapter: `nylasEmailAdapter.js` performs only list/get HTTPS calls.
- Application service: `mailboxBrowser.js` enforces session tenant, membership, module, `email.integration.view`, candidate connection ownership, active/usable status, data minimisation, opaque pagination/message tokens, safe errors and response shaping.

The list uses `GET /v3/grants/{grant}/messages` with `limit=25`, field selection, optional sender/subject/unread/attachment filters and Nylas cursor pagination. Detail uses `GET /v3/grants/{grant}/messages/{message}`. Attachment metadata comes from the message response; binaries are never requested.

HTML bodies are converted server-side to bounded plain text. The UI renders with `dmx-text`, never `dmx-html`, so scripts, event handlers, iframes and remote images cannot execute or load. This intentionally sacrifices rich formatting in Phase F.

Provider message IDs and pagination cursors are never exposed directly. They are AES-GCM authenticated, tenant-bound opaque tokens. Browser-supplied tenant, user, grant, mailbox/provider identity and connection ownership are ignored or revalidated.

## Database and environment

No database or environment-variable changes. No dependency was added.

## Tests

Phase F security tests cover token round-trip, wrong tenant, tampering, malicious HTML stripping and incoming/outgoing direction. Existing Phase C/E suites cover encryption, state/session binding, module denial and browser-value attacks. Live provider pagination/detail requires a connected Sandbox mailbox.

## Limitations and Phase G

Previous-page navigation is omitted because the provider exposes forward cursors. Date filters are supported by the service but not yet surfaced in the compact UI. Direction uses the provider-returned sender identity compared with the connected mailbox; unusual delegated-send scenarios may need additional provider metadata later. Phase G should add an explicit, permission-checked Link to Record action that deliberately creates an encrypted communication; browsing alone must remain non-persistent.
