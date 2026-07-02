'use strict';
// ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
//  🐾  BLACK PANTHER MD  —  View Once & Custom Commands
//  ✦  .vv              → reveal view-once media (group or DM)
//  ✦  "thanks"         → any user says thanks → last view-once saved to inbox
//  ✦  Any reaction     → anyone reacts to a view-once → saved to inbox
//  ✦  Reply to save    → linker replies to view-once → saved to DM
//  ✦  .cmd             → create / delete / list custom text commands
// ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

const { addCmd, addTrigger }       = require('../../guru/handlers/loader');
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { channelCtx }               = require('../../guru/utils/gmdFunctions2');
const { db }                       = require('../../guru/db/database');
const config                       = require('../../guru/config/settings');

// ━━ Ensure custom_commands table exists ━━━━━━━━━━━━━━━━━━━━━━━━━━
db.exec(`
    CREATE TABLE IF NOT EXISTS custom_commands (
        name       TEXT PRIMARY KEY,
        response   TEXT NOT NULL,
        creator    TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
`);

const stmts = {
    add:    db.prepare('INSERT OR REPLACE INTO custom_commands (name, response, creator) VALUES (?, ?, ?)'),
    del:    db.prepare('DELETE FROM custom_commands WHERE name = ?'),
    get:    db.prepare('SELECT * FROM custom_commands WHERE name = ?'),
    list:   db.prepare('SELECT name, response FROM custom_commands ORDER BY name ASC'),
    exists: db.prepare('SELECT 1 FROM custom_commands WHERE name = ?'),
};

// ━━ In-memory store: msgId → raw message (for reaction/reply-based save) ━
// Populated by the storeViewOnce trigger below, expires after 10 min
const voStore = new Map();

// ━━ Per-chat tracker: chatJid → msgId of the most recent view-once ━━
// Lets .vv work even without a reply quote (just send .vv in same chat)
const lastVoPerChat = new Map();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPER — extract view-once payload (deep unwrap — silva-md style)
//  Handles ephemeral wrappers, documentWithCaption wrappers, and all
//  three viewOnce protocol variants.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function extractViewOnce(msg) {
    if (!msg) return null;

    // Unwrap outer ephemeral / documentWithCaption layers first
    const unwrapped =
        msg.ephemeralMessage?.message ||
        msg.documentWithCaptionMessage?.message ||
        msg;

    return (
        unwrapped.viewOnceMessageV2?.message ||
        unwrapped.viewOnceMessageV2Extension?.message ||
        unwrapped.viewOnceMessage?.message ||
        // Also check originals in case unwrap didn't add anything
        msg.viewOnceMessageV2?.message ||
        msg.viewOnceMessageV2Extension?.message ||
        msg.viewOnceMessage?.message ||
        null
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPER — download view-once from a quoted context (.vv command)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function downloadViewOnceFromCtx(ctx) {
    // Check all possible message wrapper types for contextInfo
    const contextInfo =
        ctx.m.message?.extendedTextMessage?.contextInfo ||
        ctx.m.message?.imageMessage?.contextInfo        ||
        ctx.m.message?.videoMessage?.contextInfo        ||
        ctx.m.message?.audioMessage?.contextInfo        ||
        ctx.m.message?.stickerMessage?.contextInfo      ||
        null;

    const quoted    = contextInfo?.quotedMessage || ctx.m.quoted || null;
    const voMessage = extractViewOnce(quoted);
    if (!voMessage) return null;

    const fakeMsg = {
        key: {
            id:          contextInfo?.stanzaId,
            remoteJid:   ctx.from,
            participant: contextInfo?.participant,
        },
        message: voMessage,
    };

    const buf = await downloadMediaMessage(fakeMsg, 'buffer', {}).catch(() => null);
    return buf ? { buf, voMessage } : null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPER — download view-once from stored raw message
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function downloadViewOnceFromStored(stored) {
    const { voMessage, key } = stored;
    const fakeMsg = { key, message: voMessage };
    const buf = await downloadMediaMessage(fakeMsg, 'buffer', {}).catch(() => null);
    return buf ? { buf, voMessage } : null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPER — get bot's self JID (saved-messages inbox)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getBotSelfJid(sock) {
    if (sock?.user?.id) {
        return sock.user.id.split(':')[0] + '@s.whatsapp.net';
    }
    return config.OWNER_NUMBER + '@s.whatsapp.net';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPER — send downloaded view-once media to a JID anonymously
//           (mentions: [] so the original sender is NOT pinged)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function deliverToInbox(sock, toJid, buf, voMessage, stored) {
    const type      = getContentType(voMessage);
    const senderNum = stored.sender?.split('@')[0]?.split(':')[0] || 'unknown';
    const chatLabel = stored.groupName || stored.from || 'DM';

    const caption =
        `📥 *View-Once Saved*\n\n` +
        `👤 *From :* ${senderNum}\n` +
        `💬 *Chat :* ${chatLabel}\n` +
        `⏰ *Time :* ${new Date().toLocaleString('en-KE', { timeZone: config.TIME_ZONE })}\n\n` +
        `_Saved anonymously by ${config.BOT_NAME}_`;

    if (type === 'imageMessage') {
        await sock.sendMessage(toJid, { image: buf, caption, mentions: [] });
        return true;
    } else if (type === 'videoMessage') {
        await sock.sendMessage(toJid, { video: buf, caption, mimetype: 'video/mp4', mentions: [] });
        return true;
    }
    return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TRIGGER — store every incoming view-once message
//  Runs silently on every message. No action taken here — just cache.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addTrigger({
    pattern: /[\s\S]*/,
    handler: async (ctx) => {
        try {
            if (ctx.m.isStatus) return;

            const voMessage = extractViewOnce(ctx.m.message);
            if (!voMessage) return;

            const msgId = ctx.m.key?.id;
            if (!msgId) return;

            const entry = {
                voMessage,
                key:       ctx.m.key,
                from:      ctx.from,
                sender:    ctx.sender,
                groupName: ctx.groupName || null,
                ts:        Date.now(),
            };

            voStore.set(msgId, entry);
            // Track latest view-once per chat so .vv works without a reply
            lastVoPerChat.set(ctx.from, msgId);

            // Auto-expire after 10 minutes
            setTimeout(() => {
                voStore.delete(msgId);
                if (lastVoPerChat.get(ctx.from) === msgId) lastVoPerChat.delete(ctx.from);
            }, 10 * 60 * 1000);
        } catch {}
    },
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  👁️  .vv — REVEAL VIEW-ONCE (manual command)
//  Works in groups AND in DMs. Reply to a view-once then send .vv
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name:    'vv',
    aliases: ['viewonce', 'vo'],
    desc:    'Reveal a view-once image or video (reply to view-once)',
    usage:   'Reply to a view-once with .vv',
    category: 'media',
    handler: async (ctx) => {
        // Pull contextInfo from all possible wrapper types
        const _inner =
            ctx.m.message?.extendedTextMessage ||
            ctx.m.message?.imageMessage        ||
            ctx.m.message?.videoMessage        ||
            ctx.m.message?.audioMessage        ||
            ctx.m.message?.stickerMessage      ||
            null;

        const ci = _inner?.contextInfo || null;
        const quotedMsgId = ci?.stanzaId || null;

        const quoted = ci?.quotedMessage || ctx.m.quoted || null;
        const voMsg  = extractViewOnce(quoted);

        // ━━ Strategy 0: last view-once in this chat (no reply needed) ━━
        let storedFallback = null;
        if (!quotedMsgId) {
            const lastId = lastVoPerChat.get(ctx.from);
            if (lastId) storedFallback = voStore.get(lastId) || null;
        }

        if (!voMsg && !quotedMsgId && !storedFallback) {
            return ctx.sock.sendMessage(
                ctx.from,
                { text: '❌ No recent view-once found in this chat.\n\n_Send a view-once image/video and then use .vv within 10 minutes._', contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        }

        await ctx.react('⏳');

        // ━━ Strategy 1: use the in-memory store via reply stanzaId ━━
        let result = null;
        if (quotedMsgId && voStore.has(quotedMsgId)) {
            const stored = voStore.get(quotedMsgId);
            result = await downloadViewOnceFromStored(stored).catch(() => null);
        }

        // ━━ Strategy 2: use the last view-once in this chat (fallback) ━━
        if (!result?.buf && storedFallback) {
            result = await downloadViewOnceFromStored(storedFallback).catch(() => null);
        }

        // ━━ Strategy 3: re-download via contextInfo (CDN fallback) ━━
        if (!result?.buf && voMsg) {
            result = await downloadViewOnceFromCtx(ctx).catch(() => null);
        }

        if (!result?.buf) {
            await ctx.react('❌');
            return ctx.sock.sendMessage(
                ctx.from,
                {
                    text:
                        '❌ *Cannot find the view-once media.*\n\n' +
                        '• Make sure to *reply directly* to the view-once message\n' +
                        '• The media may have *expired* (older than 20 min)\n\n' +
                        '_Try sending a fresh view-once and use .vv immediately_',
                    contextInfo: channelCtx(),
                },
                { quoted: ctx.m }
            );
        }

        const { buf, voMessage } = result;
        const type = getContentType(voMessage);

        const sender    = ctx.m.message?.extendedTextMessage?.contextInfo?.participant
            || ctx.m.message?.extendedTextMessage?.contextInfo?.remoteJid
            || 'unknown';
        const senderNum = sender.split('@')[0].split(':')[0];

        try {
            if (type === 'imageMessage') {
                await ctx.sock.sendMessage(ctx.from, {
                    image:    buf,
                    caption:  `👁️ *View-Once Revealed*\n👤 From: ${senderNum}\n\n_${config.BOT_NAME}_`,
                    mentions: [],
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            } else if (type === 'videoMessage') {
                await ctx.sock.sendMessage(ctx.from, {
                    video:    buf,
                    caption:  `👁️ *View-Once Revealed*\n👤 From: ${senderNum}\n\n_${config.BOT_NAME}_`,
                    mimetype: 'video/mp4',
                    mentions: [],
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            } else {
                await ctx.react('❌');
                return ctx.sock.sendMessage(
                    ctx.from,
                    { text: '❌ Unsupported view-once type.', contextInfo: channelCtx() },
                    { quoted: ctx.m }
                );
            }
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.sock.sendMessage(
                ctx.from,
                { text: '❌ Failed to send the media. Try again.', contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📥  EMOJI-REPLY VIEW-ONCE SAVE  (🥹 😍 ❤️)
//
//  When ANYONE replies to a view-once message with one of the trigger
//  emojis (🥹 😍 ❤️) the bot downloads the quoted media and sends
//  it silently to the owner's saved-messages inbox.
//  The original sender is NEVER notified.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SAVE_TRIGGERS = ['🥹', '😍', '❤️'];

addTrigger({
    pattern: /[\s\S]*/,
    handler: async (ctx) => {
        try {
            if (ctx.m.isStatus) return;

            // Check if message text contains a trigger emoji
            const text =
                ctx.m.message?.conversation ||
                ctx.m.message?.extendedTextMessage?.text || '';
            if (!text) return;

            const matched = SAVE_TRIGGERS.some(t => text.includes(t));
            if (!matched) return;

            // Must be a reply — pull contextInfo from message
            const ci =
                ctx.m.message?.extendedTextMessage?.contextInfo ||
                ctx.m.message?.imageMessage?.contextInfo        ||
                null;

            const quotedMsg = ci?.quotedMessage;
            if (!quotedMsg) return;

            // Unwrap view-once wrappers (all three variants + ephemeral)
            const voMessage =
                quotedMsg.viewOnceMessageV2?.message ||
                quotedMsg.viewOnceMessageV2Extension?.message ||
                quotedMsg.viewOnceMessage?.message ||
                quotedMsg.ephemeralMessage?.message  ||
                null;

            if (!voMessage) return; // quoted message is not a view-once

            const fakeMsg = {
                key: {
                    id:          ci.stanzaId,
                    remoteJid:   ctx.from,
                    participant: ci.participant,
                },
                message: voMessage,
            };

            const buf = await downloadMediaMessage(fakeMsg, 'buffer', {}).catch(() => null);
            if (!buf?.length) return;

            const ownerJid  = getBotSelfJid(ctx.sock);
            const senderNum = (ci.participant || ci.remoteJid || ctx.from)
                .split('@')[0].split(':')[0];
            const caption =
                `👁️ *View-Once Saved*\n\n` +
                `👤 *From :* ${senderNum}\n` +
                `💬 *Chat :* ${ctx.groupName || 'DM'}\n` +
                `⏰ *Time :* ${new Date().toLocaleString('en-KE', { timeZone: config.TIME_ZONE })}\n\n` +
                `_Saved by ${config.BOT_NAME}_`;

            const type = getContentType(voMessage);

            if (type === 'imageMessage') {
                await ctx.sock.sendMessage(ownerJid, { image: buf, caption });
            } else if (type === 'videoMessage') {
                await ctx.sock.sendMessage(ownerJid, { video: buf, caption, mimetype: 'video/mp4' });
            } else if (type === 'audioMessage') {
                const mime  = voMessage.audioMessage?.mimetype || 'audio/ogg; codecs=opus';
                const isPtt = mime.includes('ogg') || mime.includes('opus');
                await ctx.sock.sendMessage(ownerJid, { audio: buf, mimetype: mime, ptt: isPtt });
                await ctx.sock.sendMessage(ownerJid, { text: caption });
            } else if (type === 'documentMessage') {
                await ctx.sock.sendMessage(ownerJid, {
                    document: buf,
                    fileName: voMessage.documentMessage?.fileName || 'document',
                    mimetype: voMessage.documentMessage?.mimetype || 'application/octet-stream',
                    caption,
                });
            } else if (type === 'stickerMessage') {
                await ctx.sock.sendMessage(ownerJid, { sticker: buf });
            } else {
                return;
            }

            // Confirm with ✅ reaction on the user's trigger message
            await ctx.react('✅').catch(() => {});

        } catch {}
    },
});


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🛠️  .cmd — CREATE / DELETE / LIST CUSTOM COMMANDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name:    'cmd',
    aliases: ['customcmd', 'addcmd'],
    desc:    'Create, delete or list custom commands',
    usage:   '.cmd add <name> <response> | .cmd del <name> | .cmd list',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const sub  = ctx.args[0]?.toLowerCase();
        const name = ctx.args[1]?.toLowerCase();

        if (sub === 'list') {
            const rows = stmts.list.all();
            if (!rows.length) {
                return ctx.sock.sendMessage(
                    ctx.from,
                    { text: '📭 No custom commands yet.\n\nCreate one:\n`.cmd add <name> <response>`', contextInfo: channelCtx() },
                    { quoted: ctx.m }
                );
            }
            const lines = rows.map((r, i) =>
                `${i + 1}. *${config.BOT_PREFIX}${r.name}*\n   ↳ ${r.response.slice(0, 60)}${r.response.length > 60 ? '…' : ''}`
            ).join('\n\n');
            return ctx.sock.sendMessage(ctx.from, {
                text: `🛠️ *Custom Commands* (${rows.length})\n\n${lines}\n\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        if (sub === 'del' || sub === 'delete' || sub === 'remove') {
            if (!name) return ctx.sock.sendMessage(ctx.from,
                { text: '❌ Provide the command name.\n\nExample: `.cmd del hi`', contextInfo: channelCtx() },
                { quoted: ctx.m });
            if (!stmts.exists.get(name)) return ctx.sock.sendMessage(ctx.from,
                { text: `❌ Custom command *${name}* does not exist.`, contextInfo: channelCtx() },
                { quoted: ctx.m });
            stmts.del.run(name);
            await ctx.react('✅');
            return ctx.sock.sendMessage(ctx.from,
                { text: `✅ Custom command *${config.BOT_PREFIX}${name}* deleted.`, contextInfo: channelCtx() },
                { quoted: ctx.m });
        }

        if (sub === 'add' || sub === 'set' || sub === 'create') {
            if (!name) return ctx.sock.sendMessage(ctx.from,
                { text: '❌ Provide a command name.\n\nExample: `.cmd add hello Hello there! 👋`', contextInfo: channelCtx() },
                { quoted: ctx.m });
            const response = ctx.args.slice(2).join(' ');
            if (!response) return ctx.sock.sendMessage(ctx.from,
                { text: `❌ Provide a response.\n\nExample: \`.cmd add ${name} Your reply here\``, contextInfo: channelCtx() },
                { quoted: ctx.m });
            stmts.add.run(name, response, ctx.sender);
            await ctx.react('✅');
            return ctx.sock.sendMessage(ctx.from, {
                text:
                    `✅ *Custom Command Created!*\n\n` +
                    `📌 *Trigger :* ${config.BOT_PREFIX}${name}\n` +
                    `💬 *Response:* ${response}\n\n` +
                    `_Anyone can now use \`${config.BOT_PREFIX}${name}\`_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        return ctx.sock.sendMessage(ctx.from, {
            text:
                `🛠️ *Custom Commands Usage*\n\n` +
                `➕ *Add:*  \`.cmd add <name> <response>\`\n` +
                `🗑️ *Del:*  \`.cmd del <name>\`\n` +
                `📋 *List:* \`.cmd list\`\n\n` +
                `*Example:*\n` +
                `\`.cmd add rules Follow the group rules!\`\n` +
                `→ triggers when anyone sends \`${config.BOT_PREFIX}rules\`\n\n` +
                `_${config.BOT_NAME}_`,
            contextInfo: channelCtx(),
        }, { quoted: ctx.m });
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ⚡  TRIGGER — respond to custom commands dynamically
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addTrigger({
    pattern: new RegExp(`^\\${config.BOT_PREFIX}\\w+`),
    handler: async (ctx) => {
        try {
            if (!ctx.m.isCmd) return;
            const name = ctx.m.command?.toLowerCase();
            if (!name) return;
            const row = stmts.get.get(name);
            if (!row) return;
            await ctx.sock.sendMessage(
                ctx.from,
                { text: row.response, contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        } catch {}
    },
});

module.exports = {};
