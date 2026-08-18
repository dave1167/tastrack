const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const inventory = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts', 'h2-lifecycle-inventory.js')], {encoding: 'utf8'}));
assert.equal(inventory.unresolved, 0, 'Every substantive tenant or system write must have lifecycle protection.');
assert(inventory.counts.TENANT_BUSINESS_WRITE > 100, 'The inventory must cover the application, not a representative subset.');
assert.equal(inventory.counts.SYSTEM_TENANT_WRITE, 2, 'The OAuth callback and webhook system paths must be classified.');

for (const endpoint of [
  'app/api/workflows/update.json',
  'app/api/tasks/update_status.json',
  'app/api/contacts/create.json',
  'app/api/chat/directSend.json',
  'app/api/workflows/upload_document.json',
  'app/api/settings/update_terminology.json',
  'app/api/forms/saveField.json',
  'app/api/teams/add_team.json'
]) {
  const source = read(endpoint);
  assert(source.includes('"module":"tenantLifecycle"'), `${endpoint} must use the central lifecycle rule.`);
  const json = JSON.parse(source);
  const steps = Array.isArray(json.exec.steps) ? json.exec.steps : [json.exec.steps];
  assert.equal(steps[0].module, 'tenantLifecycle', `${endpoint} must check lifecycle before its business mutation.`);
}

for (const endpoint of [
  'app/api/chat/directMarkRead.json',
  'app/api/chat/markRead.json',
  'app/api/chat/updateAvailability.json',
  'app/api/notifications/markRead.json',
  'app/api/notifications/markAllRead.json'
]) assert(!read(endpoint).includes('tenantLifecycle'), `${endpoint} is an explicit benign-state exemption.`);

const webhook = read('extensions/server_connect/modules/communicationEmail.js');
assert(webhook.includes('lifecycle._decision(db,connection.tenantId)'), 'Webhook lifecycle checks must use the tenant resolved from the trusted connection.');
assert(webhook.includes("status:'ignored_lifecycle'"), 'Blocked webhook events must be acknowledged without writing tenant business data.');

const callback = read('app/api/email/oauth/callback.json');
assert(callback.includes('tenantLifecycle') && callback.indexOf('tenantLifecycle') < callback.indexOf('completeMailboxConnection'), 'OAuth completion must be lifecycle checked before storing a connection.');

const login = read('app/api/login/login.json');
const selector = read('app/api/login/select_tenant.json');
assert(login.includes("lifecycleStatus NOT IN ('suspended','closed')"));
assert(selector.includes("lifecycleStatus NOT IN ('suspended','closed')"));

const shell = read('views/layouts/main_shell.ejs');
assert(shell.includes('data-testid="tenant-lifecycle-banner"'));
assert(shell.includes('Your workspace is available for review only.'));

console.log('H2 application-wide lifecycle structural tests passed.');
