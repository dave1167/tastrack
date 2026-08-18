const path = require('path');
const { spawn } = require('child_process');
const { seedTestData } = require('./seed-test-data');
const { loadAndValidateTestEnvironment } = require('../support/environment');

loadAndValidateTestEnvironment();

const root = path.resolve(__dirname, '..', '..', '..');
const baseUrl = process.env.E2E_BASE_URL;

async function serverAlreadyRunning() {
    try {
        await fetch(baseUrl + '/login/login');
        return true;
    } catch (_) {
        return false;
    }
}

async function waitForServer(server, output) {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
        if (server.exitCode !== null) {
            throw new Error('The isolated E2E server stopped during startup.\n' + output.join(''));
        }
        try {
            const response = await fetch(baseUrl + '/login/login');
            if (response.ok) return;
        } catch (_) {
            // The server is still starting.
        }
        await new Promise(resolve => setTimeout(resolve, 400));
    }
    throw new Error('The isolated E2E server did not become ready.\n' + output.join(''));
}

function runPlaywright() {
    const executable = process.execPath;
    const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
    return new Promise((resolve, reject) => {
        const child = spawn(executable, [cli, 'test', ...process.argv.slice(2)], {
            cwd: root,
            stdio: 'inherit',
            windowsHide: true
        });
        child.once('error', reject);
        child.once('exit', code => resolve(code == null ? 1 : code));
    });
}

async function main() {
    if (await serverAlreadyRunning()) {
        throw new Error('E2E_BASE_URL is already in use. Stop the process on ' + baseUrl + ' before running isolated tests.');
    }

    await seedTestData();
    const output = [];
    const server = spawn(process.execPath, [path.join(__dirname, 'start-test-server.js')], {
        cwd: root,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.on('data', value => output.push(value.toString()));
    server.stderr.on('data', value => output.push(value.toString()));

    try {
        await waitForServer(server, output);
        process.exitCode = await runPlaywright();
        if (process.exitCode) console.error(output.join(''));
    } finally {
        if (server.exitCode === null) {
            server.kill(process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM');
            await Promise.race([
                new Promise(resolve => server.once('exit', resolve)),
                new Promise(resolve => setTimeout(resolve, 5_000))
            ]);
        }
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
