'use strict';
// ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
//  🐾  BLACK PANTHER MD  —  Scheduled Status
//  Schedule text, image, or video statuses to post automatically.
//  Commands (owner only):
//    .schedst <time> <text>          — schedule a text status
//    .schedst list                   — view all scheduled statuses
//    .schedst cancel <id>            — cancel a scheduled status
//    .schedst clear                  — cancel ALL pending statuses
//  Reply to image/video + .schedst <time> [caption]
//    → schedules that media as a WhatsApp status
//
//  Time formats accepted:
//    14:30          → today at 14:30 (24 h)
//    2:30pm / 9am   → today at that time (12 h)
//    in 30m         → 30 minutes from now
//    in 2h          → 2 hours from now
//    in 1h30m       → 1 h 30 min from now
//    tomorrow 14:30 → next day
//
//  Repeat (optional, append after time):
//    daily / weekly (e.g. "14:30 daily Hello world")
// ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

const { addCmd }        = require('../../guru/handlers/loader');
const config            = require('../../guru/config/settings');
const logger            = require('../../guru/utils/logger');
const { channelCtx }    = require('../../guru/utils/gmdFunctions2');
const { db }            = require('../../guru/db/database');
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { getSocket }     = require('../../guru/handlers/connection');

// ━━ Create table ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_statuses (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_jid    TEXT    NOT NULL,
        type         TEXT    NOT NULL DEFAULT 'text',
        content      BLOB,
        caption      TEXT    DEFAULT '',
        mimetype     TEXT    DEFAULT '',
        scheduled_ts INTEGER NOT NULL,
        repeat       TEXT    DEFAULT 'none',
        created_at   INTEGER DEFAULT (strftime('%s','now'))
    );
`);

const stmts = {
    insert:   db.prepare(`INSERT INTO scheduled_statuses
                          (owner_jid, type, content, caption, mimetype, scheduled_ts, repeat)
                          VALUES (?, ?, ?, ?, ?, ?, ?)`),
    listAll:  db.prepare(`SELECT id, type, caption, scheduled_ts, repeat
                          FROM scheduled_statuses ORDER BY scheduled_ts ASC`),
    listOwner:db.prepare(`SELECT id, type, caption, scheduled_ts, repeat
                          FROM scheduled_statuses WHERE owner_jid = ? ORDER BY scheduled_ts ASC`),
    getById:  db.prepare(`SELECT * FROM scheduled_statuses WHERE id = ?`),
    delById:  db.prepare(`DELETE FROM scheduled_statuses WHERE id = ?`),
    due:      db.prepare(`SELECT * FROM scheduled_statuses WHERE scheduled_ts <= ?`),
    clearAll: db.prepare(`DELETE FROM scheduled_statuses`),
    count:    db.prepare(`SELECT COUNT(*) AS c FROM scheduled_statuses`),
    bumpRepeat: db.prepare(
        `UPDATE scheduled_statuses SET scheduled_ts = ? WHERE id = ?`
    ),
};

// ━━ Time zone (use bot config) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TZ = config.TIME_ZONE || 'Africa/Nairobi';

// ━━ Parse time string → Unix timestamp (seconds) ━━━━━━━━━━━━━━━━━
function parseTime(raw) {
    if (!raw) return null;
    const now = new Date();

    // ━━ "in Xm", "in Xh", "in XhYm" ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const relMatch = raw.match(/^in\s+(?:(\d+)h)?(?:(\d+)m)?$/i);
    if (relMatch) {
        const h = parseInt(relMatch[1] || '0');
        const m = parseInt(relMatch[2] || '0');
        if (h === 0 && m === 0) return null;
        return Math.floor(now.getTime() / 1000) + h * 3600 + m * 60;
    }

    // ━━ "tomorrow HH:MM" / "tomorrow H:MMam/pm" ━━━━━━━━━━━━━━━━━
    const tomorrowMatch = raw.match(/^tomorrow\s+(.+)$/i);
    let baseDate = new Date(now);
    let timeStr  = raw;
    if (tomorrowMatch) {
        timeStr = tomorrowMatch[1];
        baseDate.setDate(baseDate.getDate() + 1);
    }

    // ━━ 24-h "HH:MM" ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const h24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) {
        const h = parseInt(h24[1]);
        const m = parseInt(h24[2]);
        if (h > 23 || m > 59) return null;
        const target = new Date(baseDate);
        target.setHours(h, m, 0, 0);
        // If time already passed today (and not "tomorrow"), bump to next day
        if (!tomorrowMatch && target <= now) target.setDate(target.getDate() + 1);
        return Math.floor(target.getTime() / 1000);
    }

    // ━━ 12-h "H:MMam/pm" or "Ham/pm" ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const h12 = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (h12) {
        let h = parseInt(h12[1]);
        const m = parseInt(h12[2] || '0');
        const period = h12[3].toLowerCase();
        if (period === 'pm' && h < 12) h += 12;
        if (period === 'am' && h === 12) h = 0;
        if (h > 23 || m > 59) return null;
        const target = new Date(baseDate);
        target.setHours(h, m, 0, 0);
        if (!tomorrowMatch && target <= now) target.setDate(target.getDate() + 1);
        return Math.floor(target.getTime() / 1000);
    }

    return null;
}

// ━━ Format timestamp for display ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function fmtTs(ts) {
    return new Date(ts * 1000).toLocaleString('en-KE', {
        timeZone: TZ,
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

// ━━ Format time remaining ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function fmtIn(ts) {
    const diff = ts - Math.floor(Date.now() / 1000);
    if (diff <= 0) return 'now';
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// ━━ Post a single scheduled status ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function postStatus(row) {
    const sock = getSocket();
    if (!sock) return false;

    try {
        if (row.type === 'text') {
            const text = row.caption || '🐾 Status from BLACK PANTHER MD';
            await sock.sendMessage('status@broadcast', {
                text: `${text}\n\n_— ${config.BOT_NAME}_`,
            });

        } else if (row.type === 'image') {
            await sock.sendMessage('status@broadcast', {
                image:   Buffer.from(row.content),
                caption: row.caption ? `${row.caption}\n\n_— ${config.BOT_NAME}_` : `_— ${config.BOT_NAME}_`,
                mimetype: row.mimetype || 'image/jpeg',
            });

        } else if (row.type === 'video') {
            await sock.sendMessage('status@broadcast', {
                video:   Buffer.from(row.content),
                caption: row.caption ? `${row.caption}\n\n_— ${config.BOT_NAME}_` : `_— ${config.BOT_NAME}_`,
                mimetype: row.mimetype || 'video/mp4',
            });
        }

        logger.success('SCHEDST', `Posted scheduled status #${row.id} (${row.type})`);
        return true;
    } catch (err) {
        logger.error('SCHEDST', `Failed to post #${row.id}: ${err.message}`);
        return false;
    }
}

// ━━ Scheduler ticker (runs every 30 s) ━━━━━━━━━━━━━━━━━━━━━━━━━━━
let tickerStarted = false;
function startTicker() {
    if (tickerStarted) return;
    tickerStarted = true;

    setInterval(async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        let due;
        try { due = stmts.due.all(nowSec); } catch { return; }
        if (!due.length) return;

        for (const row of due) {
            const ok = await postStatus(row);
            if (!ok) continue;

            if (row.repeat === 'daily') {
                stmts.bumpRepeat.run(row.scheduled_ts + 86400, row.id);
            } else if (row.repeat === 'weekly') {
                stmts.bumpRepeat.run(row.scheduled_ts + 7 * 86400, row.id);
            } else {
                stmts.delById.run(row.id);
            }
        }
    }, 30_000);

    logger.info('SCHEDST', 'Scheduler ticker started (every 30 s)');
}

// Start the ticker as soon as plugin is loaded
startTicker();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  .schedst — schedule a WhatsApp status
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name:     'schedst',
    aliases:  ['schedulestatus', 'schedstt', 'sst'],
    desc:     'Schedule a WhatsApp status to be auto-posted at a set time',
    usage:    'schedst <time> [repeat] <text>  |  schedst list  |  schedst cancel <id>',
    category: 'owner',
    handler:  async (ctx) => {
        const { sock, from, isOwner, sender, args, text, m, reply } = ctx;

        if (!isOwner) {
            return reply('🚫 This command is for the *bot owner* only.');
        }

        const sub = args[0]?.toLowerCase();

        // ━━ .schedst list ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (sub === 'list' || sub === 'ls') {
            const rows = stmts.listAll.all();
            if (!rows.length) {
                return sock.sendMessage(from, {
                    text: `📅 *Scheduled Statuses*\n\n_No scheduled statuses found._\n\nUse *.schedst <time> <text>* to schedule one.`,
                    contextInfo: channelCtx(),
                }, { quoted: m });
            }

            const lines = rows.map((r, i) =>
                `*${i + 1}.* [#${r.id}] ${r.type === 'text' ? '📝' : r.type === 'image' ? '🖼️' : '🎥'} ` +
                `${r.repeat !== 'none' ? `🔁 ${r.repeat} ` : ''}` +
                `\n   ⏰ ${fmtTs(r.scheduled_ts)} _(in ${fmtIn(r.scheduled_ts)})_` +
                `\n   📄 ${(r.caption || '_(media)_').slice(0, 60)}`
            ).join('\n\n');

            return sock.sendMessage(from, {
                text:
                    `╭━⬣ 📅 *Scheduled Statuses* ⬣━╮\n\n` +
                    lines +
                    `\n\n╰━⬣ ${rows.length} pending | *.schedst cancel <id>* to remove ⬣━╯`,
                contextInfo: channelCtx(),
            }, { quoted: m });
        }

        // ━━ .schedst cancel <id> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (sub === 'cancel' || sub === 'delete' || sub === 'del') {
            const id = parseInt(args[1]);
            if (!id) return reply(`❌ Provide the status ID.\nExample: *.schedst cancel 3*`);
            const row = stmts.getById.get(id);
            if (!row) return reply(`❌ No scheduled status with ID *#${id}* found.`);
            stmts.delById.run(id);
            return sock.sendMessage(from, {
                text: `✅ *Cancelled!*\n\nScheduled status *#${id}* has been removed.\n\n_Type: ${row.type} | Was due: ${fmtTs(row.scheduled_ts)}_`,
                contextInfo: channelCtx(),
            }, { quoted: m });
        }

        // ━━ .schedst clear ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (sub === 'clear') {
            const { c } = stmts.count.get();
            if (!c) return reply('_No scheduled statuses to clear._');
            stmts.clearAll.run();
            return reply(`✅ Cleared *${c}* scheduled status(es).`);
        }

        // ━━ .schedst <time> [repeat] <text|media> ━━━━━━━━━━━━

        // Detect if first arg is a time expression (covers: 14:30, 2:30pm, 9am, in 30m, in 2h, tomorrow)
        // Collect the first 1-2 tokens for time + optional repeat
        const rawTokens  = text.trim().split(/\s+/);
        if (!rawTokens[0]) {
            return sock.sendMessage(from, {
                text:
                    `╭━⬣ 📅 *Schedule Status* ⬣━╮\n\n` +
                    `*Usage:*\n` +
                    `  *.schedst <time> <text>*\n` +
                    `  *.schedst <time> daily <text>*\n` +
                    `  *(reply to image/video) .schedst <time> [caption]*\n\n` +
                    `*Time formats:*\n` +
                    `  \`14:30\`  — today at 2:30 PM (24h)\n` +
                    `  \`2:30pm\` — today at 2:30 PM (12h)\n` +
                    `  \`9am\`    — today at 9:00 AM\n` +
                    `  \`in 30m\` — 30 minutes from now\n` +
                    `  \`in 2h\`  — 2 hours from now\n` +
                    `  \`in 1h30m\` — 1 h 30 min from now\n` +
                    `  \`tomorrow 14:30\` — next day\n\n` +
                    `*Repeat (optional):* \`daily\` / \`weekly\`\n\n` +
                    `*Examples:*\n` +
                    `  .schedst 9am Good morning! 🌅\n` +
                    `  .schedst in 2h daily Afternoon check-in 🔥\n` +
                    `  .schedst tomorrow 8am weekly Weekend vibes 🎉\n\n` +
                    `*.schedst list* — view all pending\n` +
                    `*.schedst cancel <id>* — remove one`,
                contextInfo: channelCtx(),
            }, { quoted: m });
        }

        // Parse time — handle "in Xh/Xm" (2 tokens) vs single-token times
        let timeStr, remainTokens;
        if (rawTokens[0].toLowerCase() === 'in') {
            timeStr     = rawTokens.slice(0, 2).join(' ');
            remainTokens = rawTokens.slice(2);
        } else if (rawTokens[0].toLowerCase() === 'tomorrow') {
            timeStr     = rawTokens.slice(0, 2).join(' ');
            remainTokens = rawTokens.slice(2);
        } else {
            timeStr     = rawTokens[0];
            remainTokens = rawTokens.slice(1);
        }

        const scheduledTs = parseTime(timeStr);
        if (!scheduledTs) {
            return reply(
                `❌ Could not parse time: *${timeStr}*\n\n` +
                `Supported formats: \`14:30\`, \`2:30pm\`, \`9am\`, \`in 30m\`, \`in 2h\`, \`in 1h30m\`, \`tomorrow 14:30\`\n\n` +
                `Use *.schedst* (no args) to see full help.`
            );
        }

        // Check for repeat keyword
        let repeat = 'none';
        if (remainTokens[0]?.toLowerCase() === 'daily') {
            repeat = 'daily';
            remainTokens = remainTokens.slice(1);
        } else if (remainTokens[0]?.toLowerCase() === 'weekly') {
            repeat = 'weekly';
            remainTokens = remainTokens.slice(1);
        }

        const caption = remainTokens.join(' ').trim();

        // ━━ Check for quoted/replied media ━━━━━━━━━━━━━━━━━━━━
        const contextInfo =
            m?.message?.extendedTextMessage?.contextInfo ||
            m?.message?.imageMessage?.contextInfo        ||
            m?.message?.videoMessage?.contextInfo        ||
            null;

        const quotedMsg = contextInfo?.quotedMessage || null;
        const quotedType = quotedMsg ? getContentType(quotedMsg) : null;
        const isMedia = quotedType === 'imageMessage' || quotedType === 'videoMessage';

        if (isMedia) {
            // Download the media from the quoted message
            const quotedKey = {
                id:          contextInfo.stanzaId,
                remoteJid:   from,
                participant: contextInfo.participant || sender,
                fromMe:      false,
            };

            let buf = null;
            try {
                buf = await downloadMediaMessage(
                    { key: quotedKey, message: quotedMsg },
                    'buffer',
                    {}
                );
            } catch (e) {
                logger.warn('SCHEDST', `Media download failed: ${e.message}`);
            }

            if (!buf || !buf.length) {
                return reply('❌ Failed to download the media. Please try sending it again.');
            }

            const mediaMsg  = quotedMsg[quotedType];
            const mimetype  = mediaMsg?.mimetype || (quotedType === 'imageMessage' ? 'image/jpeg' : 'video/mp4');
            const mediaType = quotedType === 'imageMessage' ? 'image' : 'video';

            stmts.insert.run(sender, mediaType, buf, caption, mimetype, scheduledTs, repeat);

            const repeatLabel = repeat !== 'none' ? ` | 🔁 *${repeat}*` : '';
            return sock.sendMessage(from, {
                text:
                    `╭━⬣ 📅 *Status Scheduled!* ⬣━╮\n` +
                    `┃\n` +
                    `┃━⬣ *Type:*    ${mediaType === 'image' ? '🖼️ Image' : '🎥 Video'}\n` +
                    `┃━⬣ *Caption:* ${caption || '_(none)_'}\n` +
                    `┃━⬣ *Time:*    ${fmtTs(scheduledTs)}\n` +
                    `┃━⬣ *In:*      ${fmtIn(scheduledTs)}${repeatLabel}\n` +
                    `┃\n` +
                    `╰━⬣ Use *.schedst list* to view all ⬣━╯`,
                contextInfo: channelCtx(),
            }, { quoted: m });
        }

        // ━━ Text status ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (!caption) {
            return reply(`❌ Provide the status text.\n\nExample: *.schedst 9am Good morning! 🌅*`);
        }

        stmts.insert.run(sender, 'text', null, caption, '', scheduledTs, repeat);

        const repeatLabel = repeat !== 'none' ? ` | 🔁 *${repeat}*` : '';
        return sock.sendMessage(from, {
            text:
                `╭━⬣ 📅 *Status Scheduled!* ⬣━╮\n` +
                `┃\n` +
                `┃━⬣ *Type:*  📝 Text\n` +
                `┃━⬣ *Text:*  ${caption.slice(0, 80)}${caption.length > 80 ? '…' : ''}\n` +
                `┃━⬣ *Time:*  ${fmtTs(scheduledTs)}\n` +
                `┃━⬣ *In:*    ${fmtIn(scheduledTs)}${repeatLabel}\n` +
                `┃\n` +
                `╰━⬣ Use *.schedst list* to view all ⬣━╯`,
            contextInfo: channelCtx(),
        }, { quoted: m });
    },
});
