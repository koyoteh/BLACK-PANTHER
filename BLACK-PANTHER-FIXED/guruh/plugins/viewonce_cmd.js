'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  View Once & Custom Commands
//  ✦  .vv           → reveal view-once media (group or DM)
//  ✦  Reaction save → linker reacts to a view-once → saved to inbox
//  ✦  .cmd          → create / delete / list custom text commands
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd, addTrigger }       = require('../../guru/handlers/loader');
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { channelCtx }               = require('../../guru/utils/gmdFunctions2');
const { db }                       = require('../../guru/db/database');
const config                       = require('../../guru/config/settings');
const { cleanJid }                 = require('../../guru/utils/helpers');

// ── Ensure custom_commands table exists ──────────────────────────
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

// ── In-memory store: msgId → raw message (for reaction-based save) ─
// Populated by the storeViewOnce trigger below, expires after 10 min
const voStore = new Map();

// ════════════════════════════════════════════════════════════════════
//  HELPER — extract view-once payload
// ════════════════════════════════════════════════════════════════════
function extractViewOnce(msg) {
    if (!msg) return null;
    return (
        msg.viewOnceMessage?.message ||
        msg.viewOnceMessageV2?.message ||
        msg.viewOnceMessageV2Extension?.message ||
        null
    );
}

// ════════════════════════════════════════════════════════════════════
//  HELPER — download view-once from a quoted context
// ════════════════════════════════════════════════════════════════════
async function downloadViewOnceFromCtx(ctx) {
    const quoted    = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const voMessage = extractViewOnce(quoted);
    if (!voMessage) return null;

    const contextInfo = ctx.m.message?.extendedTextMessage?.contextInfo;
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

// ════════════════════════════════════════════════════════════════════
//  HELPER — download view-once from stored raw message
// ════════════════════════════════════════════════════════════════════
async function downloadViewOnceFromStored(stored) {
    const { voMessage, key } = stored;
    const fakeMsg = { key, message: voMessage };
    const buf = await downloadMediaMessage(fakeMsg, 'buffer', {}).catch(() => null);
    return buf ? { buf, voMessage } : null;
}

// ════════════════════════════════════════════════════════════════════
//  HELPER — send media to a JID
// ════════════════════════════════════════════════════════════════════
async function sendViewOnceMedia(sock, toJid, buf, voMessage, captionHeader, senderNum, extraOpts = {}) {
    const type    = getContentType(voMessage);
    const caption =
        `${captionHeader}\n` +
        `👤 *From :* @${senderNum}\n` +
        `⏰ *Time :* ${new Date().toLocaleString('en-KE', { timeZone: config.TIME_ZONE })}\n\n` +
        `_${config.BOT_NAME}_`;

    if (type === 'imageMessage') {
        await sock.sendMessage(toJid, { image: buf, caption, mentions: [], ...extraOpts });
        return true;
    } else if (type === 'videoMessage') {
        await sock.sendMessage(toJid, { video: buf, caption, mimetype: 'video/mp4', ...extraOpts });
        return true;
    }
    return false;
}

// ════════════════════════════════════════════════════════════════════
//  TRIGGER — store every view-once message for reaction-based saving
//  Runs silently on every incoming message
// ════════════════════════════════════════════════════════════════════
addTrigger({
    pattern: /[\s\S]*/,
    handler: async (ctx) => {
        try {
            if (ctx.m.fromMe) return;
            if (ctx.m.isStatus) return;

            // Check if the raw message itself is a view-once
            const voMessage = extractViewOnce(ctx.m.message);
            if (!voMessage) return;

            const msgId = ctx.m.key?.id;
            if (!msgId) return;

            // Store for 10 minutes so linker can react and retrieve it
            voStore.set(msgId, {
                voMessage,
                key:       ctx.m.key,
                from:      ctx.from,
                sender:    ctx.sender,
                groupName: ctx.groupName || null,
                ts:        Date.now(),
            });
            setTimeout(() => voStore.delete(msgId), 10 * 60 * 1000);
        } catch {}
    },
});

// ════════════════════════════════════════════════════════════════════
//  👁️  .vv — REVEAL VIEW-ONCE
//  Works in groups AND in DMs. Reply to a view-once then send .vv
// ════════════════════════════════════════════════════════════════════
addCmd({
    name:    'vv',
    aliases: ['viewonce', 'vo'],
    desc:    'Reveal a view-once image or video (reply to view-once)',
    usage:   'Reply to a view-once with .vv',
    category: 'media',
    handler: async (ctx) => {
        const quoted = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const voMsg  = extractViewOnce(quoted);

        if (!voMsg) {
            return ctx.sock.sendMessage(
                ctx.from,
                { text: '❌ Reply to a *view-once* image or video with *.vv*\n\n_Make sure to reply directly to the view-once message._', contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        }

        await ctx.react('⏳');

        const result = await downloadViewOnceFromCtx(ctx);
        if (!result?.buf) {
            await ctx.react('❌');
            return ctx.sock.sendMessage(
                ctx.from,
                { text: '❌ Could not download the view-once media. It may have *expired* or been deleted.', contextInfo: channelCtx() },
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
                    caption:  `👁️ *View-Once Revealed*\n👤 From: @${senderNum}\n\n_${config.BOT_NAME}_`,
                    mentions: [sender],
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            } else if (type === 'videoMessage') {
                await ctx.sock.sendMessage(ctx.from, {
                    video:    buf,
                    caption:  `👁️ *View-Once Revealed*\n👤 From: @${senderNum}\n\n_${config.BOT_NAME}_`,
                    mimetype: 'video/mp4',
                    mentions: [sender],
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

// ════════════════════════════════════════════════════════════════════
//  📥  REACTION-BASED VIEW-ONCE SAVE
//  When the LINKER (bot number / owner) reacts with any emoji to a
//  view-once message, the media is silently saved to the linker's DM.
//
//  This is wired into the connection.js messages.upsert event by
//  listening for reactionMessage inside the regular message flow.
//  We export the handler so connection.js can call it on the
//  'messages.upsert' event for reaction messages.
// ════════════════════════════════════════════════════════════════════

/**
 * Called from connection.js when a reactionMessage is received.
 * sock      — the Baileys socket
 * reactMsg  — the raw reaction message from messages.upsert
 */
async function handleViewOnceReaction(sock, reactMsg) {
    try {
        // Reaction message structure:
        // reactMsg.message.reactionMessage.key.id  → ID of the message reacted to
        // reactMsg.key.participant                  → who reacted (in group)
        // reactMsg.key.remoteJid                   → where
        const reactionContent = reactMsg.message?.reactionMessage;
        if (!reactionContent) return;

        // Only save if the bot/owner themselves reacted (linker only)
        const ownerJid   = config.OWNER_NUMBER + '@s.whatsapp.net';
        const botSelfJid = sock.user?.id
            ? sock.user.id.split(':')[0] + '@s.whatsapp.net'
            : ownerJid;

        const reactor = cleanJid(
            reactMsg.key.participant ||
            reactMsg.key.remoteJid  ||
            ''
        );

        const isLinker =
            reactor === cleanJid(botSelfJid) ||
            reactor === cleanJid(ownerJid)   ||
            reactMsg.key.fromMe === true;

        if (!isLinker) return;

        // Check if the reacted-to message is a stored view-once
        const targetMsgId = reactionContent.key?.id;
        if (!targetMsgId) return;

        const stored = voStore.get(targetMsgId);
        if (!stored) return; // not a stored view-once

        // Download it
        const result = await downloadViewOnceFromStored(stored);
        if (!result?.buf) return;

        const { buf, voMessage } = result;
        const senderNum = stored.sender?.split('@')[0]?.split(':')[0] || 'unknown';
        const chatLabel = stored.groupName || stored.from;

        const caption =
            `📥 *View-Once Saved to Inbox*\n\n` +
            `👤 *Sender :* @${senderNum}\n` +
            `💬 *Chat   :* ${chatLabel}\n` +
            `⏰ *Time   :* ${new Date().toLocaleString('en-KE', { timeZone: config.TIME_ZONE })}\n\n` +
            `_Saved by ${config.BOT_NAME}_`;

        const type = getContentType(voMessage);
        if (type === 'imageMessage') {
            await sock.sendMessage(botSelfJid, { image: buf, caption }).catch(() => {});
        } else if (type === 'videoMessage') {
            await sock.sendMessage(botSelfJid, { video: buf, caption, mimetype: 'video/mp4' }).catch(() => {});
        }

        // Acknowledge with a checkmark reaction back
        await sock.sendMessage(reactMsg.key.remoteJid, {
            react: { text: '✅', key: reactionContent.key },
        }).catch(() => {});

    } catch {}
}

// ════════════════════════════════════════════════════════════════════
//  🛠️  .cmd — CREATE / DELETE / LIST CUSTOM COMMANDS
// ════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════
//  ⚡  TRIGGER — respond to custom commands dynamically
// ════════════════════════════════════════════════════════════════════
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

// Export for use in connection.js
module.exports = { handleViewOnceReaction };
