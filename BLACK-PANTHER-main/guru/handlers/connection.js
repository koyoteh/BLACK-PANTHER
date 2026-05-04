'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  Connection Handler (Optimised)
//  • Ultra-fast Baileys socket settings
//  • Heroku-safe: exits on QR / loggedOut / sessionReplaced
//  • Smart exponential backoff reconnect
// ╚══════════════════════════════════════════════════════════════╝

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const path      = require('path');
const fs        = require('fs-extra');
const pino      = require('pino');
const NodeCache = require('node-cache');

const config  = require('../config/settings');
const logger  = require('../utils/logger');
const { resolveSession, SESSION_DIR } = require('../utils/session');
const { seedDefaults }               = require('../db/database');
const { loadPlugins }                = require('./loader');
const { handleMessage }              = require('./message');
const { handleGroupUpdate, handleGroupSettingsUpdate } = require('./group');
const {
    PantherAntiCall,
    PantherAutoBio,
    PantherAntiDelete,
    PantherAntiEdit,
    storeMessage,
    sendWithChannel,
    channelCtx,
} = require('../utils/gmdFunctions2');
const {
    initStatusEngine,
    enqueueAll,
    enqueue,
} = require('../utils/statusEngine');
const { getCached, setCached, invalidate: invalidateGroupCache } = require('../utils/groupCache');
const { handleStatusBroadcast } = require('./statusManager');

// ── Seed database defaults ─────────────────────────────────────
seedDefaults({
    BOT_NAME:         config.BOT_NAME,
    OWNER_NAME:       config.OWNER_NAME,
    OWNER_NUMBER:     config.OWNER_NUMBER,
    BOT_PREFIX:       config.BOT_PREFIX,
    MODE:             config.MODE,
    AUTO_REACT:       String(config.AUTO_REACT),
    AUTO_BIO:         String(config.AUTO_BIO),
    AUTO_READ_STATUS: String(config.AUTO_READ_STATUS),
    AUTO_LIKE_STATUS: String(config.AUTO_LIKE_STATUS),
});

let sock;
let reconnectCount = 0;
const MAX_RECONNECT_DELAY = 30_000;  // cap at 30s instead of 60s

// ── Cache Baileys version — fetched once, reused on reconnects ─
let _cachedVersion = null;
async function getBaileysVersion() {
    if (_cachedVersion) return _cachedVersion;
    const { version } = await fetchLatestBaileysVersion();
    _cachedVersion = version;
    // Refresh every hour in case WA bumps version
    setTimeout(() => { _cachedVersion = null; }, 60 * 60 * 1000);
    return version;
}

// ── Fully-silent pino — created once, reused ──────────────────
const silentLogger = pino({ level: 'silent', enabled: false });

// ═══════════════════════════════════════════════════════════════
//  MAIN BOT START
// ═══════════════════════════════════════════════════════════════

async function startBot() {
    logger.banner(
        config.BOT_NAME,
        config.OWNER_NAME,
        config.OWNER_NUMBER,
        config.BOT_PREFIX,
        config.MODE,
        config.BOT_VERSION
    );

    logger.info('SESSION', 'Checking session...');
    await resolveSession();

    logger.info('LOADER', 'Loading plugins...');
    loadPlugins();

    fs.ensureDirSync(SESSION_DIR);
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const version              = await getBaileysVersion();

    logger.info('WA', `Using WhatsApp Web v${version.join('.')}`);

    // Cache device lists 10-min TTL — balances freshness vs repeated fetches
    const userDevicesCache = new NodeCache({ stdTTL: 600, useClones: false });

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys:  makeCacheableSignalKeyStore(state.keys, silentLogger),
        },
        logger:                         silentLogger,
        printQRInTerminal:              false,
        browser:                        ['BLACK PANTHER MD', 'Chrome', '121.0.0'],
        markOnlineOnConnect:            true,
        syncFullHistory:                false,
        shouldSyncHistoryMessage:       () => false,
        generateHighQualityLinkPreview: false,
        // ── Speed-critical settings ──────────────────────────
        retryRequestDelayMs:            50,      // ultra-fast retry
        maxMsgRetryCount:               3,
        keepAliveIntervalMs:            15_000,  // 15s heartbeat (was 20s)
        connectTimeoutMs:               20_000,
        defaultQueryTimeoutMs:          15_000,  // tighter timeout = faster failure detection
        qrTimeout:                      0,       // disable QR timeout — we handle it manually
        // ── Memory & speed ───────────────────────────────────
        emitOwnEvents:                  true,
        getMessage:                     async () => undefined,
        cachedGroupMetadata:            async (jid) => getCached(jid) ?? undefined,
        userDevicesCache,
        // ── Button/template patch ────────────────────────────
        patchMessageBeforeSending: (message) => {
            // interactiveMessage (nativeFlow) does NOT need wrapping — only legacy types do
            const needsPatch = !!(
                message.buttonsMessage  ||
                message.templateMessage ||
                message.listMessage
            );
            if (needsPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
                            ...message,
                        },
                    },
                };
            }
            return message;
        },
    });

    // ── Credentials update ─────────────────────────────────────
    sock.ev.on('creds.update', saveCreds);

    // ── Connection state ───────────────────────────────────────
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            if (logger.IS_HEROKU) {
                logger.error('QR', 'Session invalid on Heroku — set a valid SESSION_ID in Config Vars and restart!');
                process.exit(1);
            }
            // Panel / local — show QR
            logger.warn('QR', 'Scan QR code below to connect:');
            try { require('qrcode-terminal').generate(qr, { small: true }); }
            catch { logger.warn('QR', `QR data: ${qr.slice(0, 60)}...`); }
        }

        if (connection === 'close') {
            const code   = lastDisconnect?.error?.output?.statusCode;
            const reason = Object.keys(DisconnectReason).find(k => DisconnectReason[k] === code) || code;

            if (code === DisconnectReason.loggedOut) {
                logger.error('CONNECTION', 'Logged out! Delete sessions/auth and restart with a fresh SESSION_ID.');
                process.exit(1);
            }

            if (code === DisconnectReason.connectionReplaced) {
                logger.warn('CONNECTION', 'Session replaced by another instance — exiting for clean restart.');
                process.exit(1);
            }

            reconnectCount++;
            // Exponential backoff capped at MAX_RECONNECT_DELAY
            const delay = Math.min(1000 * Math.pow(2, Math.min(reconnectCount - 1, 5)), MAX_RECONNECT_DELAY);
            logger.warn('CONNECTION', `Closed (${reason}) — reconnecting in ${delay / 1000}s [attempt #${reconnectCount}]`);
            setTimeout(startBot, delay);
        }

        if (connection === 'open') {
            reconnectCount = 0;
            initStatusEngine(sock);
            const botJid = sock.user?.id || '';
            logger.success('CONNECTION', `Connected as ${botJid}`);
            logger.info('BOT', `Prefix: ${config.BOT_PREFIX}  |  Mode: ${config.MODE}`);
            logger.info('BOT', `AutoBio: ${config.AUTO_BIO}  |  AutoLike: ${config.AUTO_LIKE_STATUS}  |  AutoRead: ${config.AUTO_READ_STATUS}`);

            // Startup message to bot's own PM
            const selfNumber = botJid.split(':')[0].split('@')[0];
            const ownerJid   = `${selfNumber}@s.whatsapp.net`;
            const now        = new Date().toLocaleTimeString('en-KE', { timeZone: config.TIME_ZONE });
            const today = new Date().toLocaleDateString('en-KE', { timeZone: config.TIME_ZONE });
            const startText =
`╭─❖ *${config.BOT_NAME}* ❖─╮
│
├─❖ *Status:* ✅ ONLINE
├─❖ *Owner:*  ${config.OWNER_NAME}
├─❖ *Phone:*  +${config.OWNER_NUMBER}
├─❖ *Prefix:* [ ${config.BOT_PREFIX} ]
├─❖ *Mode:*   ${config.MODE.toUpperCase()}
├─❖ *Host:*   ${logger.PLATFORM}
├─❖ *Version:* ${config.BOT_VERSION}
├─❖ *Time:*   ${now}
├─❖ *Date:*   ${today}
│
╰─❖ *Powered by ${config.OWNER_NAME}* ❖─╯

> © ${config.BOT_NAME} is awesome 🔥`;

            sock.sendMessage(ownerJid, { text: startText, contextInfo: channelCtx() }).catch(() => {});

            // ── Set bot profile picture ───────────────────────
            try {
                const axios = require('axios');
                const ppUrl = 'https://i.ibb.co/HTNTb6F7/7b1c20c0da27.jpg';
                const ppBuf = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 30000 })
                    .then(r => Buffer.from(r.data));
                await sock.updateProfilePicture(sock.user.id, ppBuf);
                logger.success('PP', 'Bot profile picture updated ✓');
            } catch (e) {
                logger.warn('PP', `Profile pic update skipped: ${e.message}`);
            }

            // Auto Bio — start immediately then every 10 min
            if (config.AUTO_BIO) {
                PantherAutoBio(sock).catch(() => {});
                setInterval(() => PantherAutoBio(sock).catch(() => {}), 10 * 60 * 1000);
                logger.success('AUTOBIO', 'Auto Bio started (every 10 min)');
            }
        }
    });

    // ── Messages upsert ────────────────────────────────────────
    sock.ev.on('messages.upsert', async (upsert) => {
        if (!upsert?.messages) return;
        // Only react/read live messages (type:notify), skip history sync (type:append)
        if (upsert.type === 'notify') enqueueAll(upsert.messages);
        for (const msg of upsert.messages) storeMessage(msg);

        // Auto-react to channel newsletter posts
        for (const msg of upsert.messages) {
            const jid = msg?.key?.remoteJid || '';
            if (!jid.endsWith('@newsletter') || !msg?.key?.id) continue;
            const EMOJIS = ['❤️','🔥','🥰','👏','🎉','💯','😍','🌟','✨','💪'];
            sock.sendMessage(jid, { react: { text: EMOJIS[Math.floor(Math.random() * EMOJIS.length)], key: msg.key } }).catch(() => {});
        }

        // ── Status Manager (LID-fix react + saver) ────────────
        for (const msg of upsert.messages) {
            if (msg?.key?.remoteJid === 'status@broadcast' && msg?.key?.participant) {
                handleStatusBroadcast(sock, msg).catch(e =>
                    logger.warn('StatusMgr', e.message)
                );
            }
        }

        // Route commands — fire-and-forget keeps response instant
        handleMessage(upsert, sock);
    });

    // ── Anti-delete ────────────────────────────────────────────
    sock.ev.on('messages.delete', (update) => PantherAntiDelete(sock, update));

    // ── Anti-edit ──────────────────────────────────────────────
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update?.message?.protocolMessage?.editedMessage) {
                PantherAntiEdit(sock, update).catch(() => {});
            }
        }
    });

    // ── Group events ───────────────────────────────────────────
    sock.ev.on('group-participants.update', (event) => {
        invalidateGroupCache(event?.id);
        handleGroupUpdate(event, sock);
    });
    sock.ev.on('groups.update', (events) => {
        for (const e of (events || [])) invalidateGroupCache(e?.id);
        handleGroupSettingsUpdate(events, sock);
    });

    // ── Call rejection ─────────────────────────────────────────
    sock.ev.on('call', (calls) => PantherAntiCall(calls, sock));

    return sock;
}

function getSocket() { return sock; }

module.exports = { startBot, getSocket };
