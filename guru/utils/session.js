'use strict';
const path = require('path');
const fs   = require('fs');
const zlib = require('zlib');

const SESSION_DIR = path.join(process.cwd(), 'sessions');

async function resolveSession() {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

    const sid = (process.env.SESSION_ID || '').trim();

    if (!sid) {
        console.log('\n⚡ BLACK PANTHER MD — Session Setup\n');
        console.log('No SESSION_ID found in environment.');
        console.log('Get one from: https://pantherr-session.onrender.com\n');
        return;
    }

    if (!sid.startsWith('PANTHER~')) {
        console.error('[SESSION] SESSION_ID must start with "PANTHER~". Got:', JSON.stringify(sid.slice(0, 30) + '...'));
        process.exit(1);
    }

    const credsFile = path.join(SESSION_DIR, 'creds.json');

    if (fs.existsSync(credsFile)) {
        console.log('[SESSION] Session files found, skipping decode.');
        return;
    }

    try {
        const b64  = sid.slice('PANTHER~'.length);
        const buf  = Buffer.from(b64, 'base64');
        let decompressed;

        try {
            decompressed = zlib.gunzipSync(buf);
        } catch {
            const raw = buf.slice(10);
            decompressed = zlib.inflateRawSync(raw, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
        }

        const data = JSON.parse(decompressed.toString('utf8'));
        fs.writeFileSync(credsFile, JSON.stringify(data));
        console.log(`[SESSION] Decoded session and wrote creds.json.`);
    } catch (err) {
        console.error('[SESSION] Failed to decode SESSION_ID:', err.message);
        process.exit(1);
    }
}

module.exports = { resolveSession, SESSION_DIR };
