'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  Auto-Updater
//  Pulls latest commits from origin/main on every restart.
//  Uses GITHUB_PERSONAL_ACCESS_TOKEN for authenticated access.
//
//  Skipped automatically when:
//   • Running inside a Docker/Heroku/cloud container (DYNO, K_SERVICE,
//     RAILWAY_ENVIRONMENT, etc.) — images are immutable; git reset
//     would be wiped on next deploy anyway.
//   • git binary is not in PATH
//   • No git remote "origin" configured
//   • GITHUB_PERSONAL_ACCESS_TOKEN secret not set
// ╚══════════════════════════════════════════════════════════════╝

const { spawnSync } = require('child_process');
const path   = require('path');
const logger = require('./logger');

const ROOT = path.join(__dirname, '..', '..');

function run(cmd, opts = {}) {
    return spawnSync(cmd, { shell: true, cwd: ROOT, encoding: 'utf8', ...opts });
}

function injectAuth(remoteUrl, token) {
    try {
        const url = new URL(remoteUrl);
        url.username = 'x-token';
        url.password = token;
        return url.toString();
    } catch {
        return remoteUrl;
    }
}

// ── Detect immutable/cloud environments where git pull makes no sense ──
function isCloudContainer() {
    return !!(
        process.env.DYNO            ||   // Heroku
        process.env.K_SERVICE       ||   // Google Cloud Run
        process.env.RAILWAY_ENVIRONMENT  ||   // Railway
        process.env.RENDER          ||   // Render
        process.env.KOYEB_APP_NAME  ||   // Koyeb
        process.env.FLY_APP_NAME         // Fly.io
    );
}

// ── Check git is installed ─────────────────────────────────────
function gitAvailable() {
    const r = run('git --version');
    return r.status === 0;
}

async function autoUpdate() {
    try {
        // Skip on cloud/Docker deployments — filesystem is read-only/ephemeral
        if (isCloudContainer()) {
            logger.info('UPDATE', '☁️  Cloud environment detected — skipping auto-update (deploy a new image to update)');
            return false;
        }

        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        if (!token) {
            logger.warn('UPDATE', 'GITHUB_PERSONAL_ACCESS_TOKEN not set — skipping auto-update');
            return false;
        }

        if (!gitAvailable()) {
            logger.warn('UPDATE', 'git not found in PATH — skipping auto-update');
            return false;
        }

        // Get current remote URL
        const remoteRes = run('git remote get-url origin');
        if (remoteRes.status !== 0) {
            logger.warn('UPDATE', 'No git remote "origin" found — skipping auto-update');
            return false;
        }
        const remoteUrl = (remoteRes.stdout || '').trim();
        const authUrl   = injectAuth(remoteUrl, token);

        logger.info('UPDATE', `Fetching latest updates from ${remoteUrl} …`);

        // Set auth URL temporarily (token never printed to logs)
        run(`git remote set-url origin "${authUrl}"`);

        // Deep fetch — unshallow if a shallow clone
        const fetchRes = run(
            'git fetch --unshallow origin main 2>/dev/null || ' +
            'git fetch --depth=2147483647 origin main 2>/dev/null || ' +
            'git fetch origin main'
        );

        // Restore clean URL (token out of logs/history)
        run(`git remote set-url origin "${remoteUrl}"`);

        if (fetchRes.status !== 0 && !(fetchRes.stderr || '').includes('already complete')) {
            logger.warn('UPDATE', `Fetch failed: ${(fetchRes.stderr || '').slice(0, 200)}`);
            return false;
        }

        // Count new commits
        const revRes = run('git rev-list HEAD..origin/main --count');
        const behind = parseInt((revRes.stdout || '0').trim(), 10) || 0;

        if (behind === 0) {
            logger.success('UPDATE', '✅ Already up-to-date — no new commits');
            return false;
        }

        logger.info('UPDATE', `📦 ${behind} new commit(s) found — applying update…`);

        // Show incoming changelog
        const logRes = run('git log HEAD..origin/main --oneline --no-decorate');
        if (logRes.stdout) {
            for (const line of logRes.stdout.trim().split('\n').slice(0, 10)) {
                logger.info('UPDATE', `  → ${line}`);
            }
        }

        // Reset to origin/main
        const resetRes = run('git reset --hard origin/main');
        if (resetRes.status !== 0) {
            logger.warn('UPDATE', `Reset failed: ${(resetRes.stderr || '').slice(0, 200)}`);
            return false;
        }

        logger.success('UPDATE', `✅ Updated successfully (${behind} commit(s) applied)`);

        // Re-install dependencies only if package.json changed
        const diffRes = run('git diff HEAD@{1} HEAD -- package.json 2>/dev/null');
        if (diffRes.stdout && diffRes.stdout.trim()) {
            logger.info('UPDATE', '📦 package.json changed — reinstalling dependencies…');
            const npmRes = run('npm install --legacy-peer-deps --ignore-scripts 2>&1 && npm rebuild better-sqlite3 2>&1');
            logger.info('UPDATE', npmRes.status === 0 ? '✅ Dependencies updated' : `⚠️  npm install exit ${npmRes.status}`);
        }

        return true;

    } catch (err) {
        logger.warn('UPDATE', `Auto-update error: ${err.message}`);
        return false;
    }
}

module.exports = { autoUpdate };
