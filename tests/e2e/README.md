# Tastrack browser regression tests

These tests run against a disposable local database whose name ends in `_e2e`. The runner refuses non-local URLs, production-looking database names, and a test database that matches the source database. Credentials belong in `.env.test`; never put them in a spec.

## Template, event and task journey

Run the complete journey without displaying the browser:

```powershell
npm run test:e2e:template-show
```

Watch the browser perform the test:

```powershell
npm run test:e2e:template-show:headed
```

Use Playwright's interactive test runner:

```powershell
npm run test:e2e:template-show:ui
```

The test creates a uniquely named published template through the UI, adds four phases and six question types, creates an event, allocates the copied tasks between two users, signs in as each user, answers and completes their tasks, and verifies the event snapshots and source template. It does not modify the normal development database.

The HTML report is written to `playwright-report`. Failure screenshots, video and traces are written to `test-results`.

```powershell
npm run test:e2e:report
```
