'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  View Once & Custom Commands
//  ✦  .vv        → reveal view-once media replied to
//  ✦  auto-save  → any reply to view-once silently saves to inbox
//  ✦  .cmd       → create / delete / list custom text commands
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd, addTrigger }         = require('../../guru/handlers/loader');
const { downloadMediaMessage }       = require('@whiskeysockets/baileys');
const { channelCtx }                 = require('../../guru/utils/gmdFunctions2');
const { db }                         = require('../../guru/db/database');
const config                         = require('../../guru/config/settings');

// ── Ensure custom_commands table exists ───────────────────────
db.exec(`
    CREATE TABLE IF NOT EXISTS custom_commands (
        name     TEXT PRIMARY KEY,
        response TEXT NOT NULL,
        creator  TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
`);

// ── Prepared statements ───────────────────────────────────────
const stmts = {
    add:    db.prepare('INSERT OR REPLACE INTO custom_commands (name, response, creator) VALUES (?, ?, ?)'),
    del:    db.prepare('DELETE FROM custom_commands WHERE name = ?'),
    get:    db.prepare('SELECT * FROM custom_commands WHERE name = ?'),
    list:   db.prepare('SELECT name, response FROM custom_commands ORDER BY name ASC'),
    exists: db.prepare('SELECT 1 FROM custom_commands WHERE name = ?'),
};

// ═══════════════════════════════════════════════════════════════
//  🔧  HELPER — extract view-once payload from quoted message
// ═══════════════════════════════════════════════════════════════

function extractViewOnce(quoted) {
    if (!quoted) return null;
    return (
        quoted.viewOnceMessage?.message ||
        quoted.viewOnceMessageV2?.message ||
        quoted.viewOnceMessageV2Extension?.message ||
        null
    );
}

// ═══════════════════════════════════════════════════════════════
//  🔧  HELPER — download view-once buffer from quoted context
// ═══════════════════════════════════════════════════════════════

async function downloadViewOnce(ctx) {
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
    return { buf, voMessage };
}

// ═══════════════════════════════════════════════════════════════
//  👁️  .vv — REVEAL VIEW-ONCE
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:    'vv',
    aliases: ['viewonce', 'vo'],
    desc:    'Reveal a view-once image or video',
    usage:   'Reply to a view-once with .vv',
    category: 'media',
    handler: async (ctx) => {
        const quoted = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const voMsg  = extractViewOnce(quoted);

        if (!voMsg) {
            return ctx.sock.sendMessage(
                ctx.from,
                { text: '❌ Reply to a *view-once* image or video with *.vv*', contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        }

        await ctx.react('⏳');

        const result = await downloadViewOnce(ctx);
        if (!result?.buf) {
            await ctx.react('❌');
            return ctx.sock.sendMessage(
                ctx.from,
                { text: '❌ Could not download the view-once media. It may have expired.', contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        }

        const { buf, voMessage } = result;
        const { getContentType } = require('@whiskeysockets/baileys');
        const type = getContentType(voMessage);

        const sender = ctx.m.message?.extendedTextMessage?.contextInfo?.participant
            || ctx.m.message?.extendedTextMessage?.contextInfo?.remoteJid
            || 'unknown';
        const senderNum = sender.split('@')[0].split(':')[0];

        try {
            if (type === 'imageMessage') {
                await ctx.sock.sendMessage(
                    ctx.from,
                    {
                        image:   buf,
                        caption: `👁️ *View-Once Revealed*\n👤 From: @${senderNum}\n\n_${config.BOT_NAME}_`,
                        mentions: [sender],
                        contextInfo: channelCtx(),
                    },
                    { quoted: ctx.m }
                );
            } else if (type === 'videoMessage') {
                await ctx.sock.sendMessage(
                    ctx.from,
                    {
                        video:    buf,
                        caption:  `👁️ *View-Once Revealed*\n👤 From: @${senderNum}\n\n_${config.BOT_NAME}_`,
                        mimetype: 'video/mp4',
                        mentions: [sender],
                        contextInfo: channelCtx(),
                    },
                    { quoted: ctx.m }
                );
            } else {
                await ctx.react('❌');
                return ctx.sock.sendMessage(
                    ctx.from,
                    { text: '❌ Unsupported view-once type.', contextInfo: channelCtx() },
                    { quoted: ctx.m }
                );
            }
            await ctx.react('✅');
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(
                ctx.from,
                { text: '❌ Failed to send the media.', contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  📥  AUTO-SAVE — any reply to view-once → bot inbox (linker)
// ═══════════════════════════════════════════════════════════════

addTrigger({
    pattern: /[\s\S]*/,
    handler: async (ctx) => {
        try {
            if (ctx.m.fromMe) return;
            if (ctx.m.isStatus) return;

            const quoted = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const voMsg  = extractViewOnce(quoted);
            if (!voMsg) return;

            const contextInfo = ctx.m.message?.extendedTextMessage?.contextInfo;
            const fakeMsg = {
                key: {
                    id:          contextInfo?.stanzaId,
                    remoteJid:   ctx.from,
                    participant: contextInfo?.participant,
                },
                message: voMsg,
            };

            const buf = await downloadMediaMessage(fakeMsg, 'buffer', {}).catch(() => null);
            if (!buf) return;

            const { getContentType } = require('@whiskeysockets/baileys');
            const type = getContentType(voMsg);

            const senderNum  = ctx.sender.split('@')[0].split(':')[0];
            const ownerJid   = config.OWNER_NUMBER + '@s.whatsapp.net';
            const botSelfJid = ctx.sock.user?.id
                ? ctx.sock.user.id.split(':')[0] + '@s.whatsapp.net'
                : ownerJid;

            const caption =
                `📥 *Linker Inbox — Auto-Saved View-Once*\n\n` +
                `👤 *Sender :* @${senderNum}\n` +
                `💬 *Chat   :* ${ctx.isGroup ? ctx.groupName || ctx.from : 'DM'}\n` +
                `⏰ *Time   :* ${new Date().toLocaleString('en-KE', { timeZone: config.TIME_ZONE })}\n\n` +
                `_Saved automatically by ${config.BOT_NAME}_`;

            if (type === 'imageMessage') {
                await ctx.sock.sendMessage(botSelfJid, {
                    image:   buf,
                    caption,
                    mentions: [ctx.sender],
                }).catch(() => {});
            } else if (type === 'videoMessage') {
                await ctx.sock.sendMessage(botSelfJid, {
                    video:    buf,
                    caption,
                    mimetype: 'video/mp4',
                    mentions: [ctx.sender],
                }).catch(() => {});
            }
        } catch {}
    },
});

// ═══════════════════════════════════════════════════════════════
//  🛠️  .cmd — CREATE / DELETE / LIST CUSTOM COMMANDS
// ═══════════════════════════════════════════════════════════════

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

        // ── .cmd list ─────────────────────────────────────────
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
            return ctx.sock.sendMessage(
                ctx.from,
                {
                    text: `🛠️ *Custom Commands* (${rows.length})\n\n${lines}\n\n_${config.BOT_NAME}_`,
                    contextInfo: channelCtx(),
                },
                { quoted: ctx.m }
            );
        }

        // ── .cmd del <name> ───────────────────────────────────
        if (sub === 'del' || sub === 'delete' || sub === 'remove') {
            if (!name) {
                return ctx.sock.sendMessage(
                    ctx.from,
                    { text: '❌ Provide the command name to delete.\n\nExample: `.cmd del hi`', contextInfo: channelCtx() },
                    { quoted: ctx.m }
                );
            }
            if (!stmts.exists.get(name)) {
                return ctx.sock.sendMessage(
                    ctx.from,
                    { text: `❌ Custom command *${name}* does not exist.`, contextInfo: channelCtx() },
                    { quoted: ctx.m }
                );
            }
            stmts.del.run(name);
            return ctx.sock.sendMessage(
                ctx.from,
                { text: `✅ Custom command *${config.BOT_PREFIX}${name}* deleted.`, contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        }

        // ── .cmd add <name> <response> ────────────────────────
        if (sub === 'add' || sub === 'set' || sub === 'create') {
            if (!name) {
                return ctx.sock.sendMessage(
                    ctx.from,
                    { text: '❌ Provide a command name.\n\nExample: `.cmd add hello Hello there! 👋`', contextInfo: channelCtx() },
                    { quoted: ctx.m }
                );
            }
            const response = ctx.args.slice(2).join(' ');
            if (!response) {
                return ctx.sock.sendMessage(
                    ctx.from,
                    { text: `❌ Provide a response for the command.\n\nExample: \`.cmd add ${name} Your reply here\``, contextInfo: channelCtx() },
                    { quoted: ctx.m }
                );
            }
            stmts.add.run(name, response, ctx.sender);
            return ctx.sock.sendMessage(
                ctx.from,
                {
                    text:
                        `✅ *Custom Command Created!*\n\n` +
                        `📌 *Trigger :* ${config.BOT_PREFIX}${name}\n` +
                        `💬 *Response:* ${response}\n\n` +
                        `_Anyone can now use \`${config.BOT_PREFIX}${name}\`_`,
                    contextInfo: channelCtx(),
                },
                { quoted: ctx.m }
            );
        }

        // ── Usage ─────────────────────────────────────────────
        return ctx.sock.sendMessage(
            ctx.from,
            {
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
            },
            { quoted: ctx.m }
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  ⚡  TRIGGER — respond to custom commands dynamically
// ═══════════════════════════════════════════════════════════════

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
