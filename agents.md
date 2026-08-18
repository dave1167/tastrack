# Metipath Codex Development Instructions

## 1. Project Identity

The current product name is **Metipath**.

The project folder, repository, database objects, files, routes or legacy code may still contain the previous internal/product name **TasTrack**.

Do not rename legacy files, folders, routes, database tables, identifiers or code solely to replace TasTrack with Metipath unless explicitly instructed.

Metipath is a **generic multi-tenant workflow and case-management SaaS platform**.

It is intended to support many different sectors and workflows, including:

* theatre and event management;
* grant funding and grant administration;
* sales pipeline management;
* wedding planning;
* applications;
* projects;
* contracts;
* compliance;
* procurement;
* membership;
* supplier/customer management;
* internal organisational workflows.

Never design Metipath as a theatre-only or event-only application.

---

# 2. Technology Stack

Metipath currently uses:

* Wappler;
* Node.js;
* Wappler Server Connect;
* Wappler App Connect;
* EJS;
* Bootstrap 5;
* MySQL;
* DigitalOcean.

Development must remain compatible with the existing Wappler project wherever reasonably possible.

---

# 3. Core Development Rule

Before modifying any feature:

1. Inspect the existing implementation.
2. Understand how it currently works.
3. Identify existing related functionality.
4. Reuse and extend working functionality wherever possible.
5. Avoid rebuilding or replacing working modules unnecessarily.
6. Test existing behaviour after making changes.

The default approach is:

**inspect → understand → extend → test**

not:

**replace → rebuild**

If an existing implementation is genuinely unsuitable, explain why before performing a substantial rewrite.

---

# 4. Wappler Compatibility

Prefer Wappler-native functionality wherever practical, including:

* Server Connect;
* App Connect;
* Wappler database queries;
* Wappler conditions;
* repeat regions;
* Bootstrap components;
* Wappler-supported Node.js functionality.

Avoid unnecessary:

* custom JavaScript;
* direct DOM manipulation;
* custom AJAX/fetch implementations;
* additional front-end frameworks;
* libraries duplicating Wappler functionality.

Custom code may be used when genuinely necessary, but must:

* have a clear reason;
* remain compatible with Wappler;
* be kept small and isolated;
* be documented;
* not make future Wappler editing unnecessarily difficult.

---

# 5. Generic Architecture

Metipath must remain one generic platform.

Sector-specific behaviour should preferably be achieved through:

* terminology;
* templates;
* phases;
* task definitions;
* form definitions;
* tenant settings;
* configuration;
* feature flags;
* scenario packs.

Avoid creating separate versions of core functionality for different industries.

For example, do not create separate theatre, grant, sales and wedding versions of the same dashboard if a configurable generic dashboard can support them.

---

# 6. Terminology Dictionary

The terminology dictionary is a core architectural feature.

Do not unnecessarily hard-code words such as:

* Event;
* Show;
* Promoter;
* Venue;
* Artist;
* Grant;
* Applicant;
* Opportunity;
* Customer;
* Wedding;
* Couple;
* Supplier.

Where terminology is configurable, use the terminology dictionary.

New:

* labels;
* headings;
* buttons;
* messages;
* navigation items;
* field names;

should be checked to determine whether terminology values should be used.

The same core record may appear to different tenants as an:

* event;
* case;
* grant;
* application;
* opportunity;
* project;
* wedding;
* other configured term.

---

# 7. Multi-Tenant Security

Metipath is a multi-tenant SaaS application.

Tenant isolation is mandatory.

Every tenant-owned operation must be appropriately tenant-scoped, including:

* SELECT;
* INSERT;
* UPDATE;
* DELETE;
* file access;
* document access;
* communications;
* internal messages;
* tasks;
* templates;
* demo data;
* scenario state.

Do not trust a tenant ID merely because it was supplied by the browser.

Use authenticated/server-side tenant context wherever possible.

A user from one tenant must never be able to access, alter or delete another tenant's data.

Tenant isolation must be tested whenever tenant-scoped functionality is added or changed.

---

# 8. Authentication, Roles and Permissions

Preserve the existing authentication and permissions implementation unless explicitly instructed otherwise.

Before adding permission logic:

1. inspect the existing permissions model;
2. reuse existing patterns where possible;
3. enforce permissions server-side.

Do not rely solely on hidden buttons or front-end conditions to secure protected functions.

---

# 9. Database Changes

Before creating a new table or field:

1. inspect the existing schema;
2. check whether appropriate data already exists;
3. avoid duplicate sources of truth.

Database changes must:

* follow existing naming conventions;
* remain backwards compatible where practical;
* include tenant references where appropriate;
* be documented.

Do not rename or remove existing database structures without explicit instruction and a migration plan.

---

# 10. Tasks and Templates

Templates define different Metipath workflows.

Tasks may depend on:

* template;
* phase;
* order;
* question;
* answer type;
* start date;
* deadline;
* finish date;
* terminology.

Possible answer types include:

* Yes / No;
* workflow/status;
* radio buttons;
* checkboxes;
* single dropdown;
* multiple dropdown;
* free text;
* dates;
* other configured answer types.

When modifying tasks:

* preserve template linkage;
* preserve phase linkage;
* preserve task ordering;
* preserve existing answers/history;
* store answers correctly;
* avoid hard-coded industry assumptions.

---

# 11. Email and External Communications

Email integration is optional.

Metipath must continue to function correctly when email integration is disabled.

Communications must remain tenant-scoped.

Where appropriate, communications should link to the relevant workflow record.

Email integration should support:

* known-thread matching;
* unmatched communications;
* manual allocation;
* audit information;
* message/thread identifiers;
* sensible data minimisation.

Do not turn Metipath into a full duplicate mailbox unless explicitly required.

Transactional/system emails are separate from mailbox integration.

---

# 12. Internal Colleague Messaging

Internal messaging between Metipath users is a **core platform capability**, not a demo-only feature.

Before modifying or extending messaging:

1. inspect the existing messaging implementation;
2. preserve working functionality;
3. reuse the existing messaging tables, APIs and UI where practical.

Internal messages must be:

* tenant-scoped;
* associated with the authenticated sender;
* restricted to valid users/recipients within the appropriate tenant;
* protected by server-side permissions;
* auditable where appropriate.

Where useful, internal messages should be capable of linking to:

* workflow records;
* events/cases/applications/projects;
* tasks;
* organisations;
* contacts;
* documents;
* other relevant Metipath records.

Internal messaging should integrate with the existing notification system where practical.

Do not create a separate messaging system purely for:

* theatre;
* grants;
* sales;
* weddings;
* demo mode.

The same generic messaging capability should be reusable throughout Metipath.

Demo scenarios may simulate messages from fictional colleagues, but these should appear through the **real Metipath messaging feature** wherever practical.

For example, a demo scenario may simulate a Technical Manager sending:

> Updated get-in time confirmed. I still need the revised lighting plan.

The simulated message must remain scoped to the relevant demo tenant and must never appear in another demo, trial or live tenant.

---

# 13. Optional Modules and Feature Flags

Optional functionality should use established tenant settings, feature flags or entitlement mechanisms where available.

Examples include:

* email integration;
* demo mode;
* trial mode;
* future paid modules.

Optional modules must not become dependencies of the core workflow system.

---

# 14. Demo, Trial and Live Tenants

Metipath should use **one application/codebase**.

Do not create a separate duplicate Metipath application for demonstrations.

The same application should support tenant types or equivalent configuration such as:

* live;
* demo;
* trial.

Demo and trial behaviour must be layered on top of the real Metipath application.

Bug fixes to normal Metipath functionality should therefore benefit live, demo and trial tenants without requiring duplicate fixes.

---

# 15. Demo Database Architecture

The demo environment may contain many separate demo tenants in the same demo database.

For example:

* Demo Tenant A — Theatre;
* Demo Tenant B — Grants;
* Demo Tenant C — Sales;
* Demo Tenant D — Wedding;
* Demo Tenant E — Theatre.

Multiple users may run the same scenario simultaneously.

Never treat a scenario type as a unique demo instance.

Each demo must have a unique tenant/demo-instance identity.

---

# 16. Concurrent Demo Isolation

Metipath must safely support multiple prospects using demos simultaneously.

All demo-specific data must be tenant-scoped, including:

* seeded records;
* fictional users;
* contacts;
* organisations;
* tasks;
* emails;
* internal colleague messages;
* documents;
* scenario progress;
* simulated activity;
* narrative state;
* demo clock/state.

One demo tenant must never affect another demo tenant.

This requirement must hold whether there are:

* 2 demos;
* 10 demos;
* 50 demos;
* or more concurrent demos.

---

# 17. Demo Reset Safety

Reset functionality is highly sensitive.

**Reset Demo**, **Restart Scenario**, seed restoration and cleanup must operate ONLY on the authenticated/selected demo tenant.

Never:

* truncate the complete demo database;
* globally delete demo records;
* globally reseed all demo tenants;
* reset all tenants because one user presses Reset.

All destructive demo operations must have verified server-side tenant scoping.

Testing must include:

1. create or modify data in Demo Tenant A;
2. create different data in Demo Tenant B;
3. reset Demo Tenant A;
4. confirm Demo Tenant B remains completely unchanged.

Reset must include all tenant-specific scenario data where applicable, including:

* tasks;
* communications;
* internal messages;
* documents;
* fictional users;
* scenario progress;
* simulated activity.

---

# 18. Demo Scenario Engine

The demo scenario engine must be generic.

Do not hard-code the engine for one industry.

Initial planned scenario packs are:

1. Theatre / Event Management
2. Grant Funding
3. Sales Funnel Management
4. Wedding Planning

A scenario pack may define:

* terminology;
* templates;
* phases;
* fictional users;
* organisations;
* contacts;
* records;
* tasks;
* communications;
* internal colleague messages;
* documents;
* timed activity;
* expected user actions;
* narrative steps.

Adding future scenarios should primarily involve configuration and seed data rather than creating new application code.

---

# 19. Demo Narrative

The guided demo should use the real Metipath interface.

Do not create a fake presentation-only copy of Metipath.

The demo may add a guided narrative layer containing:

* scenario date/time;
* current objective;
* explanation of what has happened;
* progress;
* Show Me / Help;
* Pause;
* Continue;
* Explore Freely.

The user should perform genuine Metipath actions underneath the narrative.

---

# 20. Demo Simulation

Demo scenarios may simulate:

* incoming email;
* colleague messages;
* colleague activity;
* task completion;
* status changes;
* documents arriving;
* notifications;
* passage of time.

Where a real Metipath capability already exists, the demo should reuse it.

For example:

* simulated email should create/use normal communication records;
* simulated colleague messaging should use normal internal messaging records;
* simulated task completion should use the normal task system;
* simulated notifications should use the normal notification system.

Do not build parallel fake versions purely for the demo.

Simulated behaviour must only operate within the relevant demo tenant.

Demo clocks must never alter genuine system timestamps or live customer behaviour.

---

# 21. Seven-Day Demo

The short guided/sandbox demo is expected to use fictional data.

A typical lifecycle may be:

**created → active → expired → locked → cleanup**

Demo expiry must be tenant-specific.

Different demo tenants may start and expire on different dates.

Expired demo tenants must not affect other demos.

Demo data may be automatically removed after an appropriate retention/cleanup period.

---

# 22. Thirty-Day Trial

A real trial may contain genuine prospect data.

A trial lifecycle may be:

**created → active trial → expired → locked/read-only → live OR cleanup**

Do not immediately delete a prospect's real trial data when the trial expires.

Where appropriate, retain trial data for a configured retention period.

The intended initial model is:

* 30-day active trial;
* expiry;
* up to approximately 30 days retained afterwards;
* conversion to live if the prospect subscribes.

If the prospect becomes a customer, prefer converting the existing tenant from `trial` to `live` rather than forcing them to start again.

---

# 23. Trial Expiry Enforcement

Trial/demo expiry must be enforced server-side.

Do not simply hide front-end controls.

Protected write actions must verify that the tenant is permitted to perform the operation.

Potential tenant states may include:

* active;
* expired;
* suspended;
* closed.

Administrators should be able to extend a demo or trial where required.

---

# 24. Low-Cost Architecture Principle

Metipath is currently an early-stage SaaS product.

Infrastructure should initially favour the **lowest sensible operating cost**.

Avoid premature infrastructure complexity.

Do not introduce expensive or complex systems merely because they might eventually be useful.

Examples of unnecessary early complexity may include:

* Kubernetes;
* multiple unnecessary servers;
* unnecessary managed services;
* unnecessary queue systems;
* unnecessary caching platforms;
* unnecessary microservices.

However, low cost must not create an architecture that requires the application to be rebuilt later.

The goal is:

**simple and inexpensive now, easily upgradeable later.**

---

# 25. Infrastructure Scalability

Design components so they can be separated or upgraded as paying customer numbers increase.

Initially, multiple services/databases may share the same DigitalOcean infrastructure where safe and appropriate.

Later, components should be capable of moving independently to:

* larger droplets;
* separate servers;
* managed databases;
* external object storage;
* separate workers;
* other scalable infrastructure.

Avoid hard-coded infrastructure dependencies.

---

# 26. Environments

Metipath should be capable of operating with separate logical environments such as:

* local development;
* staging;
* demo;
* live/production.

These may initially share physical infrastructure where appropriate, but data and configuration must remain appropriately separated.

Typical logical databases may include:

* local development database;
* staging database;
* demo database;
* live database.

Do not mix production customer data into demo or staging environments.

---

# 27. Document/File Storage

File storage must be designed so the underlying storage provider can change without rebuilding the document system.

Initially, local server/droplet storage may be used to minimise cost.

The database should primarily store appropriate document metadata and a storage identifier/key/path.

Avoid scattering hard-coded physical server paths throughout application logic.

The storage implementation should allow future migration to:

* Amazon S3;
* DigitalOcean Spaces;
* another S3-compatible provider;
* another appropriate object-storage service.

Where practical, use a storage abstraction/configuration concept such as:

`STORAGE_PROVIDER=local`

and later:

`STORAGE_PROVIDER=s3`

Application pages and permissions should not need rewriting merely because the storage provider changes.

---

# 28. Configuration and Secrets

Infrastructure-specific configuration should use environment/configuration values wherever practical.

Do not commit secrets into source code.

Never commit:

* passwords;
* API keys;
* encryption keys;
* private tokens;
* production credentials.

Environment-specific settings should remain outside committed application code.

---

# 29. Container/Docker Readiness

Docker is not mandatory for current development.

Do not introduce Docker merely for architectural fashion.

However, Metipath development should remain **container-ready and deployment-portable**.

Avoid:

* hard-coded server paths;
* assumptions tied to one machine;
* embedded environment credentials;
* dependencies on manually configured server state where avoidable.

The same Metipath source should eventually be capable of being deployed as separate:

* staging;
* demo;
* live;

instances if Docker/container deployment becomes beneficial.

Docker may be introduced later when it improves:

* environment consistency;
* deployment reliability;
* separation;
* scalability.

Do not make normal Wappler development unnecessarily difficult solely to support Docker.

---

# 30. One Source Codebase

There must be one maintainable Metipath application source.

Do not maintain separate codebases for:

* live;
* demo;
* trials;
* staging;
* individual sectors.

Environment and tenant behaviour should be controlled through:

* configuration;
* databases;
* tenant settings;
* feature flags;
* scenario configuration.

A bug fixed in shared Metipath functionality should only need fixing once.

---

# 31. Security

Security takes priority over convenience.

When modifying functionality:

* validate input server-side;
* use parameterised database queries;
* preserve authentication;
* preserve tenant isolation;
* respect existing encryption;
* protect sensitive data;
* do not expose secrets;
* do not expose internal stack traces or SQL to users.

---

# 32. Encryption

Where Metipath already encrypts sensitive information, follow the existing encryption approach.

Do not silently:

* create another encryption system;
* change encryption formats;
* change encryption keys;
* migrate encrypted data;

without explicit requirements and a safe migration plan.

---

# 33. Audit Trail

Preserve or extend audit information for significant workflow actions where relevant.

Examples include:

* assignments;
* task completion;
* status changes;
* communications allocation;
* internal messaging where appropriate;
* document changes;
* permission changes;
* administrative actions.

Do not remove meaningful history simply to simplify development.

---

# 34. Notifications

Where a notification system already exists, reuse it.

Notifications may support:

* task allocation;
* task deadlines;
* internal colleague messages;
* record changes;
* workflow activity;
* demo scenario events;
* other relevant user alerts.

Avoid creating separate notification systems for different modules where the existing generic notification capability can be extended.

All notifications must remain tenant-scoped.

---

# 35. User Interface

Maintain consistency with the existing Metipath interface.

Prefer:

* existing layouts;
* Bootstrap components;
* current navigation patterns;
* current visual conventions;
* responsive behaviour.

Do not introduce unrelated UI frameworks.

Demo-specific controls must not clutter or appear in normal live customer interfaces.

---

# 36. Performance

Avoid unnecessary:

* polling;
* duplicate database queries;
* background traffic;
* repeated loading of large datasets.

Demo simulation should not require heavy continuous server activity where event-driven or scheduled approaches would be more efficient.

Internal messaging should also avoid unnecessary continuous polling where an existing notification or efficient refresh approach can be reused.

---

# 37. Testing

After changes:

1. test the requested feature;
2. test the existing related workflow;
3. test tenant isolation;
4. test roles/permissions where relevant;
5. test live behaviour after demo/trial changes;
6. check browser/server errors;
7. check database effects;
8. test responsive/basic UI behaviour.

Where Playwright or another existing test framework is available, use it appropriately.

Do not declare work complete simply because code compiles.

---

# 38. Messaging-Specific Testing

Where internal messaging is modified or used in demo functionality, test:

* user A can message an allowed colleague in the same tenant;
* messages cannot cross tenant boundaries;
* direct endpoint calls cannot bypass tenant restrictions;
* linked record/task context is correct;
* notifications are created correctly where applicable;
* simulated demo messages appear only in the intended demo tenant;
* demo reset removes/restores only that tenant's seeded/simulated messages.

---

# 39. Demo-Specific Testing

Demo functionality must include tests for:

* multiple concurrent demo tenants;
* two tenants using the same scenario;
* reset affecting only one tenant;
* simulated activity affecting only one tenant;
* simulated colleague messages affecting only one tenant;
* demo expiry affecting only the intended tenant;
* live tenants never receiving simulated activity;
* live tenants never receiving simulated messages;
* trial expiry enforcement;
* conversion from trial to live without loss of data.

---

# 40. Do Not Break Live Behaviour for Demo Convenience

Demo/trial functionality must never create shortcuts in live behaviour.

Specifically:

* simulated emails must never appear in live tenants;
* simulated messages must never appear in live tenants;
* simulated users must never act in live tenants;
* demo reset must never operate against live data;
* demo clocks must never modify real timestamps;
* scenario processing must never touch customer tenants;
* expired-demo cleanup must never affect live/trial tenants.

Demo logic must be clearly gated and isolated.

---

# 41. Destructive Changes

Do not make unrequested destructive changes.

Do not:

* delete working modules;
* remove existing fields;
* rename major tables;
* rewrite authentication;
* replace the Wappler architecture;
* introduce large dependencies;
* restructure the whole project;

unless explicitly required and justified.

---

# 42. Interpreting Codex Briefs

For every development brief:

1. read and follow this AGENTS.md;
2. inspect the existing implementation;
3. determine the smallest sensible change;
4. preserve working functionality;
5. preserve generic architecture;
6. preserve Wappler compatibility;
7. preserve tenant isolation;
8. preserve low-cost/upgradable infrastructure principles.

Do not blindly implement a duplicate system if the requested outcome can safely extend existing functionality.

---

# 43. Reporting Work

At the end of a development task, provide a concise summary containing:

* what was inspected;
* what was changed;
* files added;
* files modified;
* database changes;
* custom code added;
* why custom code was necessary;
* tests performed;
* outstanding issues;
* manual Wappler steps;
* deployment/configuration steps.

---

# 44. Overall Principle

Metipath should remain:

**one configurable platform, one maintainable codebase, strongly isolated tenants, reusable communications and messaging, low operating cost initially, and an architecture that can scale as paying customers arrive.**

Every new development decision should be considered against that principle.
