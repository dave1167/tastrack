# Email Integration — Phase G

Phase G adds the controlled communications layer around the existing Nylas mailbox connection and browser.

## Implemented

- Provider-neutral communications, threads and record links remain the core model.
- Mailbox governance: shared/departmental/workflow/individual/sensitive type, owning team, record/team/restricted access mode, sensitivity flag and unmatched-retention setting.
- Encrypted communication participants and attachment metadata.
- Nylas `message.created*` webhook receiver with exact-body HMAC-SHA256 verification, challenge response, event-id deduplication and retry-safe status logging.
- Incoming ingestion with encrypted subject/body/participant fields.
- Deterministic matching by already-linked provider thread, then exact workflow reference.
- Known-contact suggestions without ambiguous auto-linking.
- Unmatched incoming queue, manual record assignment and Not Relevant action.
- Every unmatched card exposes Assign to Event, one-click suggested-event assignment, and a Search Events modal covering event name/reference plus linked contact, promoter, organisation and email fields. Assignment atomically links both the communication and provider thread.
- Unmatched outgoing suppression; outgoing messages on a linked thread follow the thread link.
- Record Email tab with mailbox attribution, direction, participants, attachment indicator and a server-authorised plain-text preview limited to 500 characters.
- Module entitlement, tenant scoping, mailbox/team restrictions, sensitive-mailbox permission and audited administrative actions.

## Webhook setup

Endpoint: `/api/email/webhook/nylas`

Nylas requires a public HTTPS URL; localhost cannot receive sandbox webhooks without a supported tunnel or deployed development URL. Subscribe to `message.created`. After Nylas verifies the challenge, store its generated secret as the Wappler server environment variable `NYLAS_WEBHOOK_SECRET`. Never put the secret in App Connect or browser code.

## Attachments

Phase G stores encrypted attachment metadata only. Binary download is deliberately not enabled until private DigitalOcean Spaces credentials, bucket, region and retention policy are configured. No attachment is written to the core database and no public object URL is generated.

## Reply support

Users continue to reply through Outlook/Gmail or another normal client. Replies seen on a linked provider thread are attached automatically. Sending from Metipath is intentionally deferred because Phase G describes it as optional and no tenant mailbox-send permission policy has yet been selected.

## Data minimisation

Unmatched email has a per-mailbox retention-days foundation (default 30). Automated purge is not activated until the tenant retention policy and audit requirements are approved. Ignored messages leave the working queue immediately.
