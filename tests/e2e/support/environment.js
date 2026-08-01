const path = require('path');
const dotenv = require('dotenv');

function loadAndValidateTestEnvironment() {
    dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env.test'), override: false });

    const required = [
        'E2E_TEST_ENV', 'E2E_BASE_URL', 'E2E_DB_HOST', 'E2E_DB_PORT', 'E2E_DB_USER',
        'E2E_DB_PASSWORD', 'E2E_SOURCE_DB', 'E2E_DB_NAME', 'E2E_USER_PASSWORD',
        'E2E_OWNER_ALPHA_EMAIL', 'E2E_ADMIN_ALPHA_EMAIL', 'E2E_MEMBER_ALPHA_EMAIL',
        'E2E_VIEWER_ALPHA_EMAIL', 'E2E_INACTIVE_ALPHA_EMAIL', 'E2E_OWNER_BETA_EMAIL',
        'E2E_MEMBER_BETA_EMAIL', 'E2E_SESSION_SECRET'
    ];
    const missing = required.filter(name => !process.env[name]);
    if (missing.length) throw new Error('E2E safety check: missing test variables: ' + missing.join(', '));
    if (process.env.E2E_TEST_ENV !== 'true') throw new Error('E2E safety check: E2E_TEST_ENV must equal true.');

    const baseUrl = new URL(process.env.E2E_BASE_URL);
    if (!['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
        throw new Error('E2E safety check: the Phase 1 suite may only target localhost.');
    }
    const localDbHosts = ['localhost', '127.0.0.1', '::1'];
    if (!localDbHosts.includes(process.env.E2E_DB_HOST)) {
        throw new Error('E2E safety check: the database host must be local.');
    }
    if (!/^[a-z0-9_]+_e2e$/i.test(process.env.E2E_DB_NAME)) {
        throw new Error('E2E safety check: E2E_DB_NAME must end in _e2e.');
    }
    const unsafePattern = /prod|production|live/i;
    if (unsafePattern.test(process.env.E2E_DB_NAME) || unsafePattern.test(process.env.E2E_SOURCE_DB) || unsafePattern.test(baseUrl.hostname)) {
        throw new Error('E2E safety check: a production-looking database or URL was supplied.');
    }
    if (process.env.E2E_DB_NAME === process.env.E2E_SOURCE_DB) {
        throw new Error('E2E safety check: the test database must differ from the source development database.');
    }
    process.env.EMAIL_ENABLED = 'false';
    process.env.RESEND_API_KEY = '';
    return process.env;
}

function databaseConnection(database) {
    return {
        host: process.env.E2E_DB_HOST,
        port: Number(process.env.E2E_DB_PORT),
        user: process.env.E2E_DB_USER,
        password: process.env.E2E_DB_PASSWORD,
        database
    };
}

module.exports = { loadAndValidateTestEnvironment, databaseConnection };
