'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  Message Handler (High-Speed)
//  • Concurrent message processing (Promise.allSettled)
//  • De-dup Set with auto-expiry
//  • Non-blocking command dispatch
//  • SILENT MODE — No message spam logs
// ╚══════════════════════════════════════════════════════════════╝

const { serialize }                   = require('../utils/serialize');
const { findCmd, triggers }           = require('./loader');
const { isSudo }                      = require('../db/database');
const config                          = require('../config/settings');
const logger                          = require('../utils/logger');
const { cleanJid, pickRandom }        = require('../utils/helpers');
const { REACT_EMOJIS, channelCtx,
        sendWithChannel }             = require('../utils/gmdFunctions2');

// AFK map — lazy-loaded so it doesn't hard-fail if extras not yet loaded
function getAfkMap() {
    try { return require('../../guruh/plugins/extras').AFK_MAP; } catch { return null; }
}

// De-dup: prevent the same message being processed twice
const processed = new Set();
// Flush entries older than 5 minutes every 10 minutes (high-traffic safety)
setInterval(() => { if (processed.size > 500) processed.clear(); }, 10 * 60 * 1000);

// Silence mode - toggle via env var (set SILENT=true to disable message logs)
const SILENT_MODE = process.env.SILENT_MODE === 'true' || true; // Default to silent

// ═══════════════════════════════════════════════════════════════
//  MAIN DISPATCHER
// ═══════════════════════════════════════════════════════════════

function handleMessage({ messages, type }, sock) {
    if (type === 'append') return;
    if (!messages?.length) return;

    // Process all messages in the batch concurrently — no sequential bottleneck
    Promise.allSettled(messages.map(raw => processOne(raw, sock)));
}

async function processOne(raw, sock) {
    try {
        if (!raw?.message) return;

        // De-duplicate
        const msgId = raw.key.id;
        if (processed.has(msgId)) return;
        processed.add(msgId);
        // Auto-expire dedup entry after 2 minutes
        setTimeout(() => processed.delete(msgId), 120_000);

        // Skip status broadcast
        if (raw.key.remoteJid === 'status@broadcast') return;

        // SILENT MODE: Only log if DEBUG is enabled or SILENT_MODE is false
        if (!SILENT_MODE || process.env.DEBUG === 'true') {
            logger.info('MSG', `${raw.key.fromMe ? '↗' : '↙'} ${raw.key.remoteJid}`);
        }

        const m = await serialize(raw, sock);
        if (!m) return;

        // Auto-react — fire-and-forget, never blocks. Skip on commands so
        // the reply isn't queued behind a reaction send.
        if (config.AUTO_REACT && !m.fromMe && !m.isStatus && !m.isCmd) {
            sock.sendMessage(m.from, {
                react: { text: pickRandom(REACT_EMOJIS), key: m.key },
            }).catch(() => {});
        }

        // Auto-typing / Auto-recording presence — toggle via runtime flags
        if (!m.fromMe && !m.isStatus) {
            if (!global.autoPresenceFlags) global.autoPresenceFlags = { typing: null, recording: null };

            const typingOn    = global.autoPresenceFlags.typing    ?? config.AUTO_TYPING;
            const recordingOn = global.autoPresenceFlags.recording ?? config.AUTO_RECORDING;

            // Recording wins over typing — they share the same presence channel
            const presence = recordingOn ? 'recording' : (typingOn ? 'composing' : null);

            if (presence) {
                sock.sendPresenceUpdate(presence, m.from).catch(() => {});
                setTimeout(() => {
                    sock.sendPresenceUpdate('paused', m.from).catch(() => {});
                }, 5_000);
            }
        }

        const ctx = buildCtx(m, sock);

        // ── AFK: auto-unafk when user sends any message ───────────
        if (!m.fromMe && !m.isStatus) {
            const AFK_MAP = getAfkMap();
            if (AFK_MAP) {
                // 1. If sender was AFK, remove and notify
                if (AFK_MAP.has(m.sender)) {
                    const { reason, time } = AFK_MAP.get(m.sender);
                    AFK_MAP.delete(m.sender);
                    const gone = (() => {
                        const s = Math.floor((Date.now() - time) / 1000);
                        const mi = Math.floor(s / 60), h = Math.floor(mi / 60);
                        return h ? `${h}h ${mi % 60}m` : mi ? `${mi}m ${s % 60}s` : `${s}s`;
                    })();
                    sock.sendMessage(m.from, {
                        text: `✅ Welcome back *${m.pushName || m.sender.split('@')[0]}*!\n⏱️ Was AFK for: *${gone}*\n📝 Reason was: _${reason}_`,
                        contextInfo: channelCtx(),
                    }).catch(() => {});
                }
                // 2. If sender mentioned an AFK user, notify
                const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                for (const jid of mentions) {
                    if (AFK_MAP.has(jid)) {
                        const { reason, time } = AFK_MAP.get(jid);
                        const gone = (() => {
                            const s = Math.floor((Date.now() - time) / 1000);
                            const mi = Math.floor(s / 60), h = Math.floor(mi / 60);
                            return h ? `${h}h ${mi % 60}m` : mi ? `${mi}m ${s % 60}s` : `${s}s`;
                        })();
                        sock.sendMessage(m.from, {
                            text: `😴 *@${jid.split('@')[0]} is AFK*\n📝 Reason: _${reason}_\n⏱️ Since: *${gone} ago*`,
                            mentions: [jid],
                            contextInfo: channelCtx(),
                        }).catch(() => {});
                    }
                }
            }
        }

        // Body triggers (non-command patterns) — run concurrently
        if (triggers.length > 0) {
            const matchedTriggers = triggers.filter(({ pattern }) => pattern.test(m.body));
            if (matchedTriggers.length > 0) {
                Promise.allSettled(
                    matchedTriggers.map(({ handler }) =>
                        handler(ctx).catch(e => logger.error('TRIGGER', e.message))
                    )
                );
            }
        }

        // Command dispatcher
        if (!m.isCmd) return;

        const cmd = findCmd(m.command);
        if (!cmd) return;

        // Permission gates
        const ownerJid    = config.OWNER_NUMBER + '@s.whatsapp.net';
        const isOwner     = m.sender === cleanJid(ownerJid) || m.fromMe;
        const isSudoUser  = isSudo(m.sender);
        const isSuperUser = isOwner || isSudoUser;

        if (cmd.ownerOnly && !isOwner) {
            ctx.reply('❌ This command is for the *bot owner* only.').catch(() => {});
            return;
        }
        if (cmd.groupOnly && !m.isGroup) {
            ctx.reply('❌ This command can only be used in *groups*.').catch(() => {});
            return;
        }
        if (cmd.adminOnly && !m.isAdmin && !isSuperUser) {
            ctx.reply('❌ This command requires *group admin* privileges.').catch(() => {});
            return;
        }

        // ── Mode gate ──────────────────────────────────────────────
        // • public  → responds to EVERYONE, everywhere (groups + DMs)
        // • private → only owner/sudo can use commands, everywhere
        // • groups  → only works in groups (owner/sudo bypass)
        // • dm      → only works in DMs/inbox (owner/sudo bypass)
        const mode = (config.MODE || 'public').toLowerCase().trim();
        if (mode === 'private' && !isSuperUser) return;
        if (mode === 'groups'  && !m.isGroup   && !isSuperUser) return;
        if (mode === 'dm'      &&  m.isGroup   && !isSuperUser) return;
        // 'public' — no restrictions, fall through

        // Only log commands (not every message)
        logger.info('CMD', `${m.sender.split('@')[0]} → ${config.BOT_PREFIX}${m.command}`);

        // Run command — fire-and-forget so other messages aren't blocked
        cmd.handler(ctx).catch(e => logger.error('CMD_ERR', `${m.command}: ${e.message}`));

    } catch (err) {
        logger.error('MESSAGE', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  CTX BUILDER
// ═══════════════════════════════════════════════════════════════

function buildCtx(m, sock) {
    async function reply(text) {
        return sock.sendMessage(m.from, { text, contextInfo: channelCtx() }, { quoted: m });
    }
    async function send(content, opts = {}) {
        // Stickers can't carry contextInfo — pass through untouched.
        if (content.sticker !== undefined) {
            return sock.sendMessage(m.from, content, opts);
        }
        // Every other reply (text, image, video, audio, document) carries the
        // channel button + newsletter chip.
        return sock.sendMessage(m.from, { ...content, contextInfo: channelCtx() }, opts);
    }
    async function react(emoji) {
        return sock.sendMessage(m.from, { react: { text: emoji, key: m.key } });
    }
    async function deleteMsg(key = m.key) {
        return sock.sendMessage(m.from, { delete: key });
    }
    async function editMsg(key, newText) {
        return sock.sendMessage(m.from, { text: newText, edit: key });
    }

    return {
        m, sock,
        from:         m.from,
        sender:       m.sender,
        pushName:     m.pushName,
        isGroup:      m.isGroup,
        isAdmin:      m.isAdmin,
        isBotAdmin:   m.isBotAdmin,
        isOwner:      m.isOwner,
        groupMeta:    m.groupMeta,
        groupName:    m.groupName,
        participants: m.participants,
        admins:       m.admins,
        body:         m.body,
        command:      m.command,
        args:         m.args,
        text:         m.text,
        quoted:       m.quoted,
        quotedKey:    m.quotedKey,
        reply, send, react, deleteMsg, editMsg,
        config,
    };
}

module.exports = { handleMessage };
