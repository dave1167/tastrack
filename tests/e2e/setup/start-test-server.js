const fs = require('fs');
const path = require('path');
const { loadAndValidateTestEnvironment, databaseConnection } = require('../support/environment');

loadAndValidateTestEnvironment();
const root = path.resolve(__dirname, '..', '..', '..');
const runtime = path.join(root, 'tmp', 'e2e-runtime');
if (!runtime.startsWith(path.join(root, 'tmp') + path.sep)) throw new Error('Unsafe E2E runtime path.');

fs.rmSync(runtime, { recursive: true, force: true });
fs.mkdirSync(runtime, { recursive: true });
for (const entry of ['app', 'extensions', 'lib', 'public', 'views']) {
    fs.cpSync(path.join(root, entry), path.join(runtime, entry), { recursive: true });
}
for (const entry of ['index.js', 'package.json']) {
    fs.copyFileSync(path.join(root, entry), path.join(runtime, entry));
}

const connectionPath = path.join(runtime, 'app', 'modules', 'connections', 'db.json');
const connectionAction = JSON.parse(fs.readFileSync(connectionPath, 'utf8'));
connectionAction.options.connection = databaseConnection(process.env.E2E_DB_NAME);
connectionAction.actionFilePath = 'file:///' + connectionPath.replace(/\\/g, '/');
fs.writeFileSync(connectionPath, JSON.stringify(connectionAction, null, 2));

const runtimeConfigPath = path.join(runtime, 'app', 'config', 'config.json');
const runtimeConfig = JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8'));
runtimeConfig.debug = false;
runtimeConfig.env = {
    EMAIL_ENABLED: 'false',
    APP_BASE_URL: process.env.E2E_BASE_URL,
    EMAIL_FROM_NAME: 'Meldren E2E',
    RESEND_API_KEY: '',
    EMAIL_FROM_ADDRESS: '',
    RESEND_WEBHOOK_SECRET: '',
    EMAIL_REPLY_TO: '',
    EMAIL_ARCHIVE_BCC: '',
    CONTRACT_STORAGE_PATH: '/uploads/contracts',
    CHAT_ENCRYPTION_KEY_V1: Buffer.alloc(32, 7).toString('base64'),
    METIPATH_ENCRYPTION_MASTER_KEY_V1: Buffer.alloc(32, 11).toString('base64'),
    METIPATH_ENCRYPTION_KEY_VERSION: '1'
};
fs.writeFileSync(runtimeConfigPath, JSON.stringify(runtimeConfig, null, 2));

process.env.NODE_PATH = path.join(root, 'node_modules');
process.env.PORT = process.env.E2E_PORT || new URL(process.env.E2E_BASE_URL).port || '3100';
process.env.WAPPLER_SERVER_SECRET = process.env.E2E_SESSION_SECRET;
process.env.EMAIL_ENABLED = 'false';
process.env.RESEND_API_KEY = '';
process.env.APP_BASE_URL = process.env.E2E_BASE_URL;
process.env.METIPATH_ENCRYPTION_MASTER_KEY_V1 = Buffer.alloc(32, 11).toString('base64');
process.env.METIPATH_ENCRYPTION_KEY_VERSION = '1';
process.env.NODE_ENV = 'test';
require('module').Module._initPaths();
process.chdir(runtime);
require(path.join(runtime, 'index.js'));
