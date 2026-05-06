'use strict';
// ╔══════════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  Session Manager
//
//  Accepts: GURU~<payload>  where payload is either:
//    • Plain base64  →  GURU~eyJub2lzZ...
//    • Gzip+base64   →  GURU~H4sIAAAA...
//
//  Platform rules:
//  ┌──────────────┬─────────────────────────────────────────────┐
//  │  Heroku      │ MUST have SESSION_ID env var. No prompt.    │
//  │  Railway     │ MUST have SESSION_ID env var. No prompt.    │
//  │  Render      │ MUST have SESSION_ID env var. No prompt.    │
//  │  Koyeb       │ MUST have SESSION_ID env var. No prompt.    │
//  │  Panel/VPS   │ Shows interactive prompt if SESSION_ID      │
//  │              │ env var is missing.                         │
//  │  Local       │ Shows interactive prompt if SESSION_ID      │
//  │              │ env var is missing.                         │
//  └──────────────┴─────────────────────────────────────────────┘
// ╚══════════════════════════════════════════════════════════════════╝

const fs     = require('fs-extra');
const path   = require('path');
const zlib   = require('zlib');
const logger = require('./logger');

// FIXED: Use correct path for sessions
const SESSION_DIR    = path.join(process.cwd(), 'sessions');
const CREDS_FILE     = path.join(SESSION_DIR, 'creds.json');
const SESSION_PREFIX = 'GURU~';

// ── Decode payload — handles plain JSON base64 OR gzip+base64 ──
function decodePayload(b64) {
    const buf = Buffer.from(b64, 'base64');
    // Gzip magic bytes: 0x1f 0x8b
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
        return JSON.parse(zlib.gunzipSync(buf).toString('utf-8'));
    }
    return JSON.parse(buf.toString('utf-8'));
}

function isValidSession(raw) {
    if (typeof raw !== 'string') return false;
    const s = raw.trim();
    if (!s.startsWith(SESSION_PREFIX)) return false;
    const b64 = s.slice(SESSION_PREFIX.length);
    if (!b64 || b64.length < 20) return false;
    try { decodePayload(b64); return true; } catch { return false; }
}

async function writeSession(raw) {
    const s = raw.trim();
    if (!s.startsWith(SESSION_PREFIX))
        throw new Error(`❌  Session must start with "${SESSION_PREFIX}"\n    Got: "${s.slice(0, 30)}..."`);
    const b64 = s.slice(SESSION_PREFIX.length);
    let creds;
    try {
        creds = decodePayload(b64);
    } catch {
        throw new Error('❌  Could not decode session. Copy the full GURU~... string exactly.');
    }
    if (!creds?.noiseKey && !creds?.me && !creds?.signedIdentityKey)
        throw new Error('❌  Decoded session is not valid WhatsApp credentials. Generate a fresh SESSION_ID.');
    await fs.ensureDir(SESSION_DIR);
    await fs.writeJson(CREDS_FILE, creds, { spaces: 2 });
    logger.success('SESSION', 'Credentials saved ✓');
}

function sessionExists() {
    try {
        if (!fs.existsSync(CREDS_FILE)) return false;
        const d = fs.readJsonSync(CREDS_FILE);
        return !!(d?.noiseKey || d?.me || d?.signedIdentityKey);
    } catch { return false; }
}

function encodeSession() {
    try {
        const creds = fs.readJsonSync(CREDS_FILE);
        return `${SESSION_PREFIX}${Buffer.from(JSON.stringify(creds)).toString('base64')}`;
    } catch { return null; }
}

// ── Interactive prompt (Panel / Local only) ────────────────────
function promptForSession() {
    return new Promise((resolve) => {
        const banner = [
            '',
            '╔══════════════════════════════════════════════════════╗',
            '║   🐾   BLACK PANTHER MD  ·  Session Setup           ║',
            '╠══════════════════════════════════════════════════════╣',
            '║  Paste your SESSION_ID below and press Enter         ║',
            '║  Format:  GURU~<base64>   or   GURU~<gzip+base64>   ║',
            '║  Get one: https://wa.me/254105521300                 ║',
            '╚══════════════════════════════════════════════════════╝',
            '',
        ].join('\n');

        process.stdout.write(banner + 'SESSION_ID ❯ ');

        let buf = '';
        process.stdin.setEncoding('utf8');
        process.stdin.resume();

        function onData(chunk) {
            buf += chunk;
            const nl = buf.indexOf('\n');
            if (nl === -1) return;
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);

            if (!isValidSession(line)) {
                process.stdout.write('\n  ❌  Invalid — must start with "GURU~" followed by base64.\n\nSESSION_ID ❯ ');
                buf = '';
                process.stdin.resume();
                process.stdin.on('data', onData);
                return;
            }
            writeSession(line)
                .then(() => { process.stdout.write('\n  ✅  Session accepted — starting bot...\n\n'); resolve(); })
                .catch(err => {
                    process.stdout.write(`\n  ${err.message}\n\nSESSION_ID ❯ `);
                    buf = '';
                    process.stdin.resume();
                    process.stdin.on('data', onData);
                });
        }
        process.stdin.on('data', onData);
    });
}

// ── Main resolver ──────────────────────────────────────────────
async function resolveSession() {
    // Log the session directory for debugging
    console.log(`[SESSION] Session directory: ${SESSION_DIR}`);
    
    // Already have valid creds on disk — skip everything
    if (sessionExists()) {
        console.log(`[SESSION] Session file found at: ${CREDS_FILE}`);
        logger.success('SESSION', 'Existing session loaded ✓');
        return;
    }

    const envId  = process.env.SESSION_ID?.trim();
    const isCloud = !!(
        process.env.DYNO ||
        process.env.RAILWAY_ENVIRONMENT ||
        process.env.RENDER ||
        process.env.KOYEB_SERVICE_NAME
    );

    // ── Cloud platforms (Heroku / Railway / Render / Koyeb) ──
    // Must use env var — no TTY available for prompts
    if (isCloud) {
        if (!envId) {
            logger.error('SESSION', [
                'SESSION_ID is not set!',
                `  ➤ Go to your ${process.env.DYNO ? 'Heroku' : 'cloud'} dashboard`,
                '  ➤ Add Config Var:  SESSION_ID = GURU~<your-session>',
                '  ➤ Generate one at: https://wa.me/254105521300',
            ].join('\n'));
            process.exit(1);
        }
        console.log(`[SESSION] SESSION_ID found in env vars (length: ${envId.length})`);
        if (!isValidSession(envId)) {
            logger.error('SESSION', `SESSION_ID must start with "GURU~". Got: "${envId.slice(0, 35)}..."`);
            process.exit(1);
        }
        await writeSession(envId);
        return;
    }

    // ── Panel / VPS / Local ───────────────────────────────────
    // Use env var if set, otherwise prompt
    if (envId) {
        if (!isValidSession(envId)) {
            logger.error('SESSION', `SESSION_ID must start with "GURU~". Got: "${envId.slice(0, 35)}..."`);
            process.exit(1);
        }
        await writeSession(envId);
        return;
    }

    // No env var and no saved session → show prompt
    if (!process.stdin.isTTY && !process.stdin.readable) {
        logger.error('SESSION', [
            'No SESSION_ID set and no interactive terminal available.',
            '  ➤ Add SESSION_ID to your .env file or Panel environment variables:',
            '      SESSION_ID=GURU~<your-session>',
            '  ➤ Generate one at: https://wa.me/254105521300',
        ].join('\n'));
        process.exit(1);
    }

    await promptForSession();
}

module.exports = {
    resolveSession,
    sessionExists,
    isValidSession,
    writeSession,
    encodeSession,
    SESSION_DIR,
    SESSION_PREFIX,
};
