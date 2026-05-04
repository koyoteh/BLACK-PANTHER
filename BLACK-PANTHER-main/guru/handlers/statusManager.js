'use strict';

/**
 * lib/statusManager.js
 * Status@broadcast handler — delegates to the dedicated autoviewstatus
 * and autoreactstatus plugin managers for view/react logic.
 */

const config = require('../config/settings');

// ─── Per-process dedup set ─────────────────────────────────────────────────────
const _seenIds = new Set();

// ─── Message-type unwrapper ────────────────────────────────────────────────────
function unwrapStatus(m) {
    let inner = { ...(m.message || {}) };
    if (inner.ephemeralMessage)  inner = { ...(inner.ephemeralMessage.message  || inner) };
    if (inner.viewOnceMessageV2) inner = { ...(inner.viewOnceMessageV2.message || inner) };
    if (inner.viewOnceMessage)   inner = { ...(inner.viewOnceMessage.message   || inner) };

    const ORDER = [
        'imageMessage', 'videoMessage', 'audioMessage',
        'extendedTextMessage', 'conversation', 'stickerMessage',
        'documentMessage', 'reactionMessage',
    ];
    const msgType = ORDER.find(k => inner[k]) || Object.keys(inner)[0] || 'unknown';
    return { inner, msgType };
}

// ─── Status saver function for media ──────────────────────────────────────────
async function saveMediaMessage(sock, msg, msgType, caption, from) {
    try {
        const fs = require('fs');
        const statusesDir = './statuses';
        if (!fs.existsSync(statusesDir)) fs.mkdirSync(statusesDir, { recursive: true });

        const timestamp = Date.now();
        let fileName, buffer;

        let downloader;
        try {
            downloader = require('gifted-baileys');
        } catch {
            downloader = require('@whiskeysockets/baileys');
        }
        const { downloadMediaMessage } = downloader;

        try {
            buffer = await downloadMediaMessage(
                { message: msg.message, key: msg.key },
                'buffer',
                {},
                { logger: require('pino')({ level: 'silent' }) }
            );
        } catch (err) {
            console.error(`[StatusMgr] Download failed: ${err.message}`);
            return false;
        }

        switch (msgType) {
            case 'imageMessage':
                fileName = `status_img_${timestamp}.jpg`;
                fs.writeFileSync(`${statusesDir}/${fileName}`, buffer);
                break;
            case 'videoMessage':
                fileName = `status_vid_${timestamp}.mp4`;
                fs.writeFileSync(`${statusesDir}/${fileName}`, buffer);
                break;
            case 'audioMessage':
                fileName = `status_audio_${timestamp}.mp3`;
                fs.writeFileSync(`${statusesDir}/${fileName}`, buffer);
                break;
            default:
                return false;
        }

        if (config.Status_Saver_Owner_Notify === 'true' && sock.user?.id) {
            const ownerMsg =
                `*STATUS SAVED*\n${config.BOT_NAME}\n\n` +
                `From   ·  ${from || 'Unknown'}\n` +
                `Type   ·  ${msgType.replace('Message', '').toUpperCase()}\n` +
                `File   ·  ${fileName}\n` +
                `Caption·  ${caption || 'None'}`;
            await sock.sendMessage(sock.user.id, { text: ownerMsg }).catch(() => {});
        }

        console.log(`[StatusMgr] ✅ Status saved: ${fileName}`);
        return true;

    } catch (err) {
        console.error(`[StatusMgr] ❌ Save failed: ${err.message}`);
        return false;
    }
}

// ─── Main handler ──────────────────────────────────────────────────────────────
async function handleStatusBroadcast(sock, m) {
    try {
        const statusId    = m.key.id;
        const participant = m.key.participant;

        if (!participant) return;

        if (_seenIds.has(statusId)) {
            console.log(`[StatusMgr] ⏭️  Duplicate status skipped: ${statusId}`);
            return;
        }
        _seenIds.add(statusId);
        if (_seenIds.size > 500) {
            const oldest = _seenIds.values().next().value;
            _seenIds.delete(oldest);
        }

        const { inner, msgType } = unwrapStatus(m);

        console.log(`[StatusMgr] >>> id=${statusId} participant=${participant} type=${msgType}`);

        // ── 1. Auto View — delegated to autoviewstatus manager ─────────────────
        try {
            const { handleAutoView } = require('./plugins/autoviewstatus');
            await handleAutoView(sock, m.key, m.message);
        } catch (e) {
            console.warn(`[StatusMgr] autoview error: ${e.message}`);
        }

        // ── 2. Auto React — delegated to autoreactstatus manager ───────────────
        try {
            const { handleAutoReact } = require('./plugins/autoreactstatus');
            await handleAutoReact(sock, m.key);
        } catch (e) {
            console.warn(`[StatusMgr] autoreact error: ${e.message}`);
        }

        // ── 3. Auto Reply — DISABLED ───────────────────────────────────────────

        // ── 4. Status Saver ────────────────────────────────────────────────────
        const shouldSave      = config.Status_Saver  === 'true';
        const shouldReplySave = config.STATUS_REPLY  === 'true';

        if (shouldSave) {
            try {
                const phoneJid  = m.key.participantPn || m.key.participant;
                const displayJid = phoneJid || participant;
                let userName = displayJid.split('@')[0];
                try {
                    const nameResult = await sock.getName?.(displayJid);
                    if (nameResult) userName = nameResult;
                } catch {}

                const saveReplyMessage = config.STATUS_MSG || `${config.BOT_NAME} successfully viewed your status`;
                const header  = `*STATUS SAVED*\n${config.BOT_NAME}`;
                let caption   = `${header}\n\nFrom · ${userName}`;
                let saved     = false;

                switch (msgType) {
                    case 'imageMessage':
                        if (inner.imageMessage?.caption) caption += `\nCaption · ${inner.imageMessage.caption}`;
                        saved = await saveMediaMessage(sock, m, 'imageMessage', caption, userName);
                        break;
                    case 'videoMessage':
                        if (inner.videoMessage?.caption) caption += `\nCaption · ${inner.videoMessage.caption}`;
                        saved = await saveMediaMessage(sock, m, 'videoMessage', caption, userName);
                        break;
                    case 'audioMessage':
                        caption += '\nType · Audio';
                        saved = await saveMediaMessage(sock, m, 'audioMessage', caption, userName);
                        break;
                    case 'extendedTextMessage':
                        caption = `${header}\n\n${inner.extendedTextMessage?.text || ''}`;
                        if (sock.user?.id) {
                            await sock.sendMessage(sock.user.id, { text: caption });
                            saved = true;
                        }
                        break;
                    case 'conversation':
                        caption = `${header}\n\n${inner.conversation || ''}`;
                        if (sock.user?.id) {
                            await sock.sendMessage(sock.user.id, { text: caption });
                            saved = true;
                        }
                        break;
                    default:
                        break;
                }

                if (saved && shouldReplySave) {
                    try {
                        await sock.sendMessage(phoneJid || participant, { text: saveReplyMessage });
                    } catch (e) {
                        console.warn(`[StatusMgr] ⚠️ Save reply failed: ${e.message}`);
                    }
                }
            } catch (e) {
                console.error(`[StatusMgr] ❌ Save process failed: ${e.message}`);
            }
        }

    } catch (e) {
        console.error(`[StatusMgr] ❌ Handler error: ${e.message}\n${e.stack}`);
    }
}

// ─── Runtime flag getter (used by autostatus plugin) ──────────────────────────
function getAutoStatusSettings() {
    return {
        autoviewStatus:   'managed-by-autoviewstatus-plugin',
        autoLikeStatus:   'managed-by-autoreactstatus-plugin',
        autoReplyStatus:  'false',
        statusReplyText:  config.AUTO_STATUS_MSG      || `Seen by ${config.BOT_NAME}`,
        statusLikeEmojis: config.CUSTOM_REACT_EMOJIS  || '🪾,🌴,🪻,🌿,🌲,🌵,🍂,☄️,🪽,🪶,🚀,🍖',
        statusSaver:      String(config.Status_Saver  || 'false'),
        statusSaverReply: String(config.STATUS_REPLY  || 'false'),
        statusSaverMsg:   config.STATUS_MSG           || `${config.BOT_NAME} successfully viewed your status`,
    };
}

module.exports = {
    handleStatusBroadcast,
    getAutoStatusSettings,
    unwrapStatus,
    saveMediaMessage,
};
