'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  Entry Point
//  Owner : GuruTech  |  +254105521300
// ╚══════════════════════════════════════════════════════════════╝

// ── Suppress libsignal console spam ───────────────────────────
(function suppressSignalNoise() {
    const SIGNAL_RE = /bad mac|failed to decrypt|session error|closing open session|closing session|removing old closed session|decrypted message with closed session|in favor of incoming|prekey bundle|sessionentry|_chains|registrationid|currentratchet|ephemeralkeypair|indexinfo|basekey|rootkey|pubkey|privkey|pendingrekey|remoteidentikey|lastremoterphemeralkey|verifyMAC|decryptwithsessions|dodecryptwhispermessage|_asyncqueueexecutor|interactive send/i;
    const matches = (...a) => a.some(x => {
        if (typeof x === 'object' && x !== null) {
            if ('_chains' in x || 'currentRatchet' in x || 'indexInfo' in x) return true;
        }
        return SIGNAL_RE.test(String(x));
    });
    const _oe = console.error.bind(console);
    const _ol = console.log.bind(console);
    const _ow = console.warn.bind(console);
    const _oi = console.info.bind(console);
    const _os = process.stdout.write.bind(process.stdout);
    console.error = (...a) => { if (matches(...a)) return; _oe(...a); };
    console.log   = (...a) => { if (matches(...a)) return; _ol(...a); };
    console.warn  = (...a) => { if (matches(...a)) return; _ow(...a); };
    console.info  = (...a) => { if (matches(...a)) return; _oi(...a); };
    process.stdout.write = (chunk, ...rest) => {
        if (typeof chunk === 'string' && SIGNAL_RE.test(chunk)) return true;
        return _os(chunk, ...rest);
    };
})();

require('dotenv').config();

const express  = require('express');
const http     = require('http');
const path     = require('path');
const config   = require('./guru/config/settings');
const logger   = require('./guru/utils/logger');
const { startBot }                              = require('./guru/handlers/connection');
const { checkExpiry, startExpiryWatchdog, scheduleHardExpiry, fmtDate, fmtCountdown } = require('./guru/utils/expiry');

let expiryInfo = { active: true, daysLeft: null, expiryDate: null };

// ── Express app ───────────────────────────────────────────────
const app = express();

// Serve public/ folder statically — index.html lives here
app.use(express.static(path.join(__dirname, 'guru/GuruTech/public')));

// Bot status page (/)
app.get('/status', (_, res) => {
    const expiryTag = expiryInfo.expiryDate
        ? `Expires: ${fmtDate(expiryInfo.expiryDate)} (${expiryInfo.daysLeft}d left)`
        : 'No Expiry';
    res.send(`<!DOCTYPE html><html><head><title>${config.BOT_NAME}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;background:#0d1117;color:#c9d1d9;
       padding:40px;display:flex;justify-content:center}
  .card{max-width:560px;width:100%;background:#161b22;border:1px solid #30363d;
        border-radius:12px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,.4)}
  .top,.bot{color:#58a6ff;font-family:monospace;letter-spacing:1px}
  h1{color:#58a6ff;margin:14px 0 4px;font-size:22px}
  pre{font-family:'JetBrains Mono','Fira Code',monospace;color:#c9d1d9;
      background:transparent;margin:14px 0;line-height:1.7;white-space:pre-wrap}
  .ok{color:#3fb950;font-weight:bold}
  .key{color:#d2a8ff}
  .quote{color:#8b949e;font-style:italic;border-left:3px solid #30363d;
         padding-left:12px;margin-top:18px}
  .foot{color:#6e7681;text-align:center;margin-top:18px;font-size:13px}
</style></head>
<body>
<div class="card">
<div class="top">╭─❖ ${config.BOT_NAME} ❖─╮</div>
<pre>│
├─❖ <span class="key">Status :</span>  <span class="ok">✅ ONLINE</span>
├─❖ <span class="key">Owner  :</span>  ${config.OWNER_NAME}  (+${config.OWNER_NUMBER})
├─❖ <span class="key">Prefix :</span>  [ ${config.BOT_PREFIX} ]
├─❖ <span class="key">Mode   :</span>  ${config.MODE.toUpperCase()}
├─❖ <span class="key">Host   :</span>  ${logger.PLATFORM}
├─❖ <span class="key">AutoBio:</span>  ${config.AUTO_BIO ? 'ON ✅' : 'OFF'}
├─❖ <span class="key">Licence:</span>  ${expiryTag}
│</pre>
<div class="bot">╰─❖ Powered by ${config.OWNER_NAME} ❖─╯</div>
<p class="quote">© ${config.BOT_NAME} is awesome 🔥</p>
<p class="foot">Channel · ${config.CHANNEL_NAME}</p>
</div>
</body></html>`);
});

// Health endpoint — used by Heroku keep-alive and health checks
app.get('/health', (_, res) => res.json({
    status:      'alive',
    bot:         config.BOT_NAME,
    owner:       config.OWNER_NUMBER,
    platform:    logger.PLATFORM,
    uptime:      Math.floor(process.uptime()),
    memory_mb:   Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    auto_bio:    config.AUTO_BIO,
    auto_like:   config.AUTO_LIKE_STATUS,
    auto_read:   config.AUTO_READ_STATUS,
    expiry_date: expiryInfo.expiryDate ? fmtDate(expiryInfo.expiryDate) : null,
    days_left:   expiryInfo.daysLeft,
}));

app.listen(config.PORT, () => {
    logger.info('SERVER', `HTTP server on port ${config.PORT}`);
});

// ── Heroku keep-alive — prevent dyno sleeping ─────────────────
if (process.env.DYNO) {
    const APP_URL = process.env.APP_URL;
    const target = APP_URL ? `${APP_URL}/health` : `http://localhost:${config.PORT}/health`;
    setInterval(() => { http.get(target, () => {}).on('error', () => {}); }, 25 * 60 * 1000);
    logger.info('KEEPALIVE', `Pinging ${target} every 25 min`);
} else if (!logger.IS_LOCAL) {
    setInterval(() => {
        http.get(`http://localhost:${config.PORT}/health`, () => {}).on('error', () => {});
    }, 4 * 60 * 1000);
}

// ── Memory GC hint ─────────────────────────────────────────────
setInterval(() => { if (global.gc) global.gc(); }, 20 * 60 * 1000);

// ── Global error handlers ─────────────────────────────────────
process.on('uncaughtException',  (err) => logger.error('UNCAUGHT',  err.message));
process.on('unhandledRejection', (err) => logger.error('UNHANDLED', err?.message || String(err)));

// ── Boot ──────────────────────────────────────────────────────
(async () => {
    expiryInfo = await checkExpiry({
        exitOnExpiry: true,
        onExpire: async (msg, expiryDate) => {
            try {
                const { getSocket } = require('./guru/handlers/connection');
                const sock = getSocket && getSocket();
                if (sock?.user?.id) {
                    const selfNum = sock.user.id.split(':')[0].split('@')[0];
                    await sock.sendMessage(`${selfNum}@s.whatsapp.net`, {
                        text: `⛔ *${config.BOT_NAME} — Licence Expired*\n\n📅 Expiry: *${fmtDate(expiryDate)}*\n🔒 Bot shut down.\n📞 Contact GuruTech to renew.\n\n_+${config.OWNER_NUMBER}_`,
                    }).catch(() => {});
                }
            } catch {}
        },
    });

    await startBot().catch(err => {
        logger.error('FATAL', `Bot failed to start: ${err.message}`);
        process.exit(1);
    });

    // ── Expiry watchdog: fires every 30 minutes ─────────────
    startExpiryWatchdog(
        async (msg, expiryDate) => {
            try {
                const { getSocket } = require('./guru/handlers/connection');
                const sock = getSocket && getSocket();
                if (sock?.user?.id) {
                    const selfNum = sock.user.id.split(':')[0].split('@')[0];
                    await sock.sendMessage(`${selfNum}@s.whatsapp.net`, {
                        text: `⛔ *${config.BOT_NAME} — LICENCE EXPIRED*\n\n📅 Expiry: *${fmtDate(expiryDate)}*\n🔒 Shutting down now.\n📞 wa.me/${config.OWNER_NUMBER}\n\n_BLACK PANTHER MD_`,
                    }).catch(() => {});
                    await sock.sendMessage(`${config.OWNER_NUMBER}@s.whatsapp.net`, {
                        text: `⛔ ALERT: ${config.BOT_NAME} EXPIRED on ${fmtDate(expiryDate)}. Bot shutdown.`,
                    }).catch(() => {});
                }
            } catch {}
        },
        async (warnMsg, daysLeft, expiryDate) => {
            try {
                const { getSocket } = require('./guru/handlers/connection');
                const sock = getSocket && getSocket();
                if (sock?.user?.id) {
                    const selfNum = sock.user.id.split(':')[0].split('@')[0];
                    await sock.sendMessage(`${selfNum}@s.whatsapp.net`, { text: warnMsg }).catch(() => {});
                    if (daysLeft <= 3) {
                        await sock.sendMessage(`${config.OWNER_NUMBER}@s.whatsapp.net`, { text: warnMsg }).catch(() => {});
                    }
                }
            } catch {}
        }
    );

    // ── Hard expiry: kills bot at exact millisecond ───────────
    scheduleHardExpiry(async (msg, expiryDate) => {
        try {
            const { getSocket } = require('./guru/handlers/connection');
            const sock = getSocket && getSocket();
            if (sock?.user?.id) {
                const selfNum = sock.user.id.split(':')[0].split('@')[0];
                await sock.sendMessage(`${selfNum}@s.whatsapp.net`, {
                    text: `⛔ *HARD EXPIRY* — ${config.BOT_NAME}\nExpired: ${new Date().toISOString()}\nShutting down instantly.`,
                }).catch(() => {});
            }
        } catch {}
    });
})();
