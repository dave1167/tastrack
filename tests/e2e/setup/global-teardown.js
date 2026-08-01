const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = async function globalTeardown() {
    const pidPath = path.resolve(__dirname, '..', '.state', 'server.pid');
    if (!fs.existsSync(pidPath)) return;
    const pid = Number(fs.readFileSync(pidPath, 'utf8'));
    if (Number.isInteger(pid) && pid > 0) {
        try {
            execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        } catch (_) {
            // The process may already have stopped.
        }
    }
    fs.rmSync(pidPath, { force: true });
};
