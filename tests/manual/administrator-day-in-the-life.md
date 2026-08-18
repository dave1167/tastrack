# Administrator day-in-the-life manual test

This script tests a realistic working day by entering data through the Tastrack user interface. Do not enter test data directly into the database.

## Test record

Complete this section before starting.

| Item | Test value |
|---|---|
| Run reference | `ADMIN-DAY-YYYYMMDD-01` |
| Tenant | |
| Administrator | |
| Second tenant user | |
| Shared mailbox | |
| Browser used | |
| Test started | |

Use the run reference in the event name, reference code, email subject and messages. This makes the test records easy to find and remove later.

## Preconditions

- Use a test tenant, not a live tenant.
- The administrator must have owner or admin access.
- A second active user must belong to the same tenant.
- The tenant must have the Events, Locations and Team Chat modules enabled.
- Email Capture must be enabled to run Script 5.
- Script 5 requires a connected shared or departmental mailbox under **Setup → Email Integration**.
- Have a harmless PDF or text file available for the document upload test.
- Keep a second browser profile or private window available for the second user.

If a required menu item is absent, record the test as **Blocked** and check the tenant's modules and the user's permissions. Do not treat a missing module as a failed feature.

## Suggested test data

Replace `YYYYMMDD` with today's date.

| Field | Value |
|---|---|
| Event name | `Administrator Test Show YYYYMMDD` |
| Reference code | `ADMIN-DAY-YYYYMMDD-01` |
| Start date | Today |
| Show date | Seven days from today |
| Show start time | `19:30` |
| Contact name | `Alex Promoter Test` |
| Organisation | `Day in the Life Promotions` |
| Contact email | An address you control |
| Document title | `Test technical rider` |
| Email subject | `[ADMIN-DAY-YYYYMMDD-01] Updated arrival information` |
| Direct message | `ADMIN-DAY-YYYYMMDD-01: Please confirm the first task is visible.` |

## Result key

- **Pass** — the observed result matches the expected result.
- **Fail** — the feature was available but behaved incorrectly.
- **Blocked** — a prerequisite, module, permission or external connection was unavailable.

For a failure, capture the page URL, a screenshot, the exact error text and the time.

---

## Script 1 — Start the day and review events

1. Sign in as the administrator.
2. Open **Events** (`/workflows`).
3. Select **Open** in the event-state switch.
4. Search for an existing event by a word in its name or reference.
5. Move to another results page and repeat the search.
6. Select **Completed**.

Expected results:

- Open and completed events are separated correctly.
- Search finds matching tenant events regardless of the current results page.
- Completed event rows have the completed green treatment.
- No event belonging to another tenant is visible.

Result: **Pass / Fail / Blocked**  
Evidence/notes:

---

## Script 2 — Create and organise an event

1. From **Events**, choose **Add Event** and open `/workflows/create`.
2. Select a published template.
3. Enter the suggested event name and reference code.
4. Select an event type, owner team and status.
5. Enter the start date and show date.
6. Select a location, then a space, then a configuration without saving between selections.
7. Create the event.
8. On the event page, choose **Edit event**.
9. Confirm the saved fields are populated, set the show start time to `19:30`, and save.
10. Return to the event page.

Expected results:

- Space choices update after the location is selected.
- Configuration choices update after the space is selected.
- The event is created from the chosen template.
- The edit form reloads all saved values.
- The header shows the show date, `19:30`, and the location/space/configuration summary.
- Only locations belonging to the current tenant can be selected.

Result: **Pass / Fail / Blocked**  
Event ID/URL:  
Evidence/notes:

---

## Script 3 — Add a contact and a document

### Contact

1. Open the event's **Contacts** tab.
2. Link an existing contact, or use **Setup → Contacts** to create the suggested test contact and return to the event.
3. Set an appropriate relationship and make the contact primary if the option is available.
4. Refresh the event page.

Expected result: the contact remains on this event, its details are shown, and the Contacts badge increases.

### Document

1. Open the event's **Documents** tab.
2. Choose **Upload document**.
3. Enter `Test technical rider`, select an appropriate type, attach the harmless test file and submit.
4. Refresh the page and open or download the uploaded file.

Expected result: the document appears only on this event, the Documents badge increases, and the stored file can be opened by an authorised tenant user.

Result: **Pass / Fail / Blocked**  
Evidence/notes:

---

## Script 4 — Allocate and complete work

1. Open the event's **Tasks** tab.
2. Confirm the template phases are clearly labelled and ordered.
3. Expand the current phase and open its first task.
4. Assign the task to the second tenant user and set a due date and priority.
5. Save and return to the event.
6. In the second browser profile, sign in as the assigned user.
7. Open the task, update it to **In progress**, then **Complete**.
8. Return to the administrator browser and refresh the event.
9. Approve the phase when all its tasks are complete.

Expected results:

- The assignment and status changes persist.
- The administrator sees the task completion after refresh.
- A phase containing tasks cannot be approved while required tasks remain open.
- The next phase becomes current after approval.
- The activity/stage history identifies the user and action.

Result: **Pass / Fail / Blocked**  
Task ID/URL:  
Evidence/notes:

---

## Script 5 — Capture and link a real email

This is a manual end-to-end email test. It uses a real test email and the connected mailbox; it does not insert a row directly into the database.

### Check the connection

1. As the administrator, open **Setup → Email Integration** (`/settings/integrations/email`).
2. Confirm the test shared mailbox is shown as connected and enabled.
3. Choose **Test connection**.

Expected result: the connection test succeeds and its last-success information updates. If no mailbox is connected, stop and mark this script **Blocked**.

### Send an email that should match

1. From an external email account, send a plain test email to the connected mailbox.
2. Use the exact subject `[ADMIN-DAY-YYYYMMDD-01] Updated arrival information`.
3. In the body write: `Please attach this message to Administrator Test Show YYYYMMDD. Arrival is now 16:30.`
4. Attach a harmless small text or PDF file if attachment capture is in scope.
5. Wait until the message has arrived in the mailbox itself.
6. In Tastrack, open **Communications** (`/communications/mailbox`).
7. Choose **Process Recent Email** once.

Expected results:

- The processing action completes without a server error.
- The incoming message is either linked safely to one unambiguous event or appears under **Unmatched email**.
- Repeating **Process Recent Email** does not create a duplicate communication.

### Manually resolve an unmatched email

1. If the message appears under **Unmatched email**, review its sender, subject and date.
2. Choose **Assign to Event**.
3. Search for at least two characters from the run reference or event name.
4. Select the test event and confirm **Assign to Event**.
5. Open the test event and review its email/communication history.

Expected results:

- Search returns the test event but no event outside the tenant.
- The message disappears from Unmatched after assignment.
- The event shows the email with sender, recipient, subject, date, direction and body.
- Any captured attachment is associated with the correct communication/event.
- The assignment is represented in the activity history.

### Negative check

1. Send another harmless email with no event reference and an unrelated sender.
2. Process recent email.
3. Choose **Not Relevant** for that message.

Expected result: an ambiguous email is not automatically linked, and **Not Relevant** removes it from the review queue without attaching it to an event.

Result: **Pass / Fail / Blocked**  
Communication subject/time:  
Evidence/notes:

---

## Script 6 — Internal direct messaging

1. In the administrator browser, select the **Messages** icon in the top bar.
2. Select the second tenant user.
3. Send `ADMIN-DAY-YYYYMMDD-01: Please confirm the first task is visible.`
4. Confirm the new message appears once in the conversation.
5. In the second user's browser, refresh or navigate to another Tastrack page.
6. Confirm an unread message indicator appears.
7. Open **Messages**, read the message and reply: `Confirmed for ADMIN-DAY-YYYYMMDD-01.`
8. Return to the administrator browser and open the reply.
9. Set a temporary availability/status message and save it.
10. Archive the test conversation.

Expected results:

- Only users in the current tenant are offered as recipients.
- The recipient sees the unread count and the correct sender.
- Reading the conversation clears its unread state.
- Messages retain their order, content and timestamps.
- The reply is visible to the administrator.
- Availability changes persist.
- Archiving removes the conversation from the active list without deleting its message history.

Result: **Pass / Fail / Blocked**  
Evidence/notes:

---

## Script 7 — Approve an empty final phase and complete the event

Use a template whose final phase deliberately contains no tasks.

1. Complete and approve each earlier phase in order.
2. Open the empty final phase.
3. Use its approval/completion action once.
4. Refresh the event page.
5. Return to **Events**, choose **Completed**, and search for the run reference.

Expected results:

- The empty final phase can be completed by approval; it does not remain **Not Started** merely because it has `0/0` tasks.
- A single click completes the phase and event without competing requests or a 500 response.
- After refresh, the final phase shows **Complete**.
- The event appears in the Completed view with a green completed row and does not appear in Open.

Result: **Pass / Fail / Blocked**  
Evidence/notes:

---

## Script 8 — Audit and tenant-security checks

1. As the administrator, open **Activity Log** (`/activity-log`).
2. Filter/search for the event or run reference where the page permits it.
3. Confirm the important actions from this test are present: event creation/change, contact/document activity, task updates, phase approvals and email assignment.
4. Sign in as a standard user without owner/admin permission and try to open `/activity-log` directly.
5. If a second test tenant is available, search its Events and Communications screens for the run reference.

Expected results:

- Audit entries identify the correct tenant, user, action and time.
- A standard unauthorised user cannot view the activity log.
- The second tenant cannot see the event, contact, document, email or messages created in this test.

Result: **Pass / Fail / Blocked**  
Evidence/notes:

---

## End-of-test summary

| Script | Result | Defect/reference |
|---|---|---|
| 1. Review events | | |
| 2. Create event | | |
| 3. Contact and document | | |
| 4. Tasks and phases | | |
| 5. Email capture | | |
| 6. Direct messaging | | |
| 7. Complete event | | |
| 8. Audit/security | | |

Overall result: **Pass / Fail / Blocked**  
Tester:  
Completed at:  
Summary notes:

## Cleanup

Keep failed records until evidence has been collected. After the run:

1. Archive or clearly mark the test event as test data according to the tenant's retention policy.
2. Remove the test contact only if it is not linked elsewhere.
3. Remove local copies of any test attachment containing personal data.
4. Restore the users' availability messages.
5. Do not disconnect the shared mailbox if it is used by other tests or users.

