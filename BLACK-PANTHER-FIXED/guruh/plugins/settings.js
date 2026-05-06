'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  Settings Plugin
//  Owner & group settings commands:
//    • autoreact / autoread / autolike / autobio toggles
//    • autotyping  — show typing indicator before replies
//    • antiflood   — kick members who flood messages
//    • setlimit    — configure warn-kick threshold
//    • settz       — change timezone at runtime
//    • botsettings — view all settings at a glance
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd, addTrigger } = require('../../guru/handlers/loader');
const { getSetting, setSetting, getGroupSettings, setGroupSetting } = require('../../guru/db/database');
const config = require('../../guru/config/settings');
const moment = require('moment-timezone');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

// ═══════════════════════════════════════════════════════════════
//  OWNER BOOL TOGGLE HELPER
// ═══════════════════════════════════════════════════════════════

function ownerToggle({ name, aliases = [], desc, configKey, onMsg, offMsg }) {
    addCmd({
        name,
        aliases,
        desc,
        category: 'owner',
        ownerOnly: true,
        handler: async (ctx) => {
            const arg     = ctx.args[0]?.toLowerCase();
            const current = config[configKey];
            const newVal  = arg === 'on' ? true : arg === 'off' ? false : !current;
            setSetting(configKey, String(newVal));
            config[configKey] = newVal;
            await ctx.reply(newVal ? onMsg : offMsg);
        },
    });
}

// ── Auto-React ─────────────────────────────────────────────────
ownerToggle({
    name:      'autoreact',
    aliases:   ['togglereact'],
    desc:      'Toggle auto-react on every incoming message',
    configKey: 'AUTO_REACT',
    onMsg:     '✅ *Auto-React ON*\n\nI will react to every incoming message.',
    offMsg:    '🔕 *Auto-React OFF*\n\nAuto-react has been disabled.',
});

// ── Auto-Read Status ───────────────────────────────────────────
ownerToggle({
    name:      'autoread',
    aliases:   ['toggleread', 'autoreadstatus'],
    desc:      'Toggle auto-read of WhatsApp statuses',
    configKey: 'AUTO_READ_STATUS',
    onMsg:     '✅ *Auto-Read Status ON*\n\nI will automatically view all statuses.',
    offMsg:    '🔕 *Auto-Read Status OFF*\n\nStatus auto-reading has been disabled.',
});

// ── Auto-Like Status ───────────────────────────────────────────
ownerToggle({
    name:      'autolike',
    aliases:   ['togglelike', 'autolikestatus'],
    desc:      'Toggle auto-like of WhatsApp statuses',
    configKey: 'AUTO_LIKE_STATUS',
    onMsg:     '✅ *Auto-Like Status ON*\n\nI will automatically like all statuses.',
    offMsg:    '🔕 *Auto-Like Status OFF*\n\nStatus auto-liking has been disabled.',
});

// ── Auto-Bio ───────────────────────────────────────────────────
ownerToggle({
    name:      'autobio',
    aliases:   ['togglebio'],
    desc:      'Toggle auto-bio rotation every 10 minutes',
    configKey: 'AUTO_BIO',
    onMsg:     '✅ *Auto-Bio ON*\n\nProfile bio will rotate every 10 minutes.',
    offMsg:    '🔕 *Auto-Bio OFF*\n\nBio rotation has been stopped.',
});

// ═══════════════════════════════════════════════════════════════
//  AUTO-TYPING
//  Show "typing..." in chat before every bot reply
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'autotyping',
    aliases:   ['toggletyping', 'typing'],
    desc:      'Toggle typing indicator before bot replies',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const current = getSetting('AUTO_TYPING', 'false') === 'true';
        const newVal  = !current;
        setSetting('AUTO_TYPING', String(newVal));
        config.AUTO_TYPING = newVal;
        await ctx.reply(
            newVal
                ? '⌨️ *Auto-Typing ON*\n\nI will show a typing indicator before every reply.'
                : '🔕 *Auto-Typing OFF*\n\nTyping indicator disabled.'
        );
    },
});

// Inject typing presence before every command execution
// Check isCmd FIRST before the expensive trigger lookup path
addTrigger({
    pattern: /.*/,
    handler: async (ctx) => {
        if (!ctx.m?.isCmd) return;   // ← early exit — skips 99% of messages
        if (getSetting('AUTO_TYPING', 'false') !== 'true') return;
        await ctx.sock.sendPresenceUpdate('composing', ctx.from).catch(() => {});
        await new Promise(r => setTimeout(r, 400));  // reduced from 600ms
        await ctx.sock.sendPresenceUpdate('paused', ctx.from).catch(() => {});
    },
});

// ═══════════════════════════════════════════════════════════════
//  ANTI-FLOOD
//  Removes members who send too many messages in a short window
// ═══════════════════════════════════════════════════════════════

const floodMap = new Map();   // key: `${groupJid}::${sender}` → { count, timer }
const FLOOD_LIMIT  = 7;       // messages
const FLOOD_WINDOW = 6000;    // milliseconds

addCmd({
    name:      'antiflood',
    aliases:   ['noflood'],
    desc:      'Toggle flood protection — removes members who spam quickly',
    category:  'group',
    groupOnly: true,
    adminOnly: true,
    handler:   async (ctx) => {
        if (!ctx.isBotAdmin) return ctx.sock.sendMessage(ctx.from, { text: '❌ I need to be an *admin* to remove members.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const current = getGroupSettings(ctx.from).antiflood;
        if (current === undefined) {
            return ctx.sock.sendMessage(ctx.from, { text: '⚠️ Please run the bot once after this update so the DB migrates. Then try again.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
        const newVal = !current;
        setGroupSetting(ctx.from, 'antiflood', newVal);
        await ctx.reply(
            newVal
                ? `🌊 *Anti-Flood ON*\n\nMembers sending more than ${FLOOD_LIMIT} messages in ${FLOOD_WINDOW / 1000}s will be removed.`
                : '✅ *Anti-Flood OFF*\n\nFlood protection has been disabled.'
        );
    },
});

addTrigger({
    pattern: /.*/,
    handler: async (ctx) => {
        if (!ctx.isGroup) return;
        if (ctx.isAdmin || ctx.isOwner || ctx.m.fromMe) return;

        const settings = getGroupSettings(ctx.from);
        if (!settings.antiflood) return;

        const key     = `${ctx.from}::${ctx.sender}`;
        const entry   = floodMap.get(key) || { count: 0 };

        entry.count++;
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = setTimeout(() => floodMap.delete(key), FLOOD_WINDOW);
        floodMap.set(key, entry);

        if (entry.count >= FLOOD_LIMIT) {
            floodMap.delete(key);
            await ctx.sock.groupParticipantsUpdate(ctx.from, [ctx.sender], 'remove').catch(() => {});
            await ctx.send({
                text:
                    `🌊 *Anti-Flood*\n\n` +
                    `@${ctx.sender.split('@')[0]} was removed for flooding the group!\n\n` +
                    `_${config.BOT_NAME}_`,
                mentions: [ctx.sender],
            }).catch(() => {});
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  SET WARN LIMIT
//  Configure how many warnings before a member is kicked
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'setlimit',
    aliases:   ['warnlimit', 'setwarnlimit'],
    desc:      'Set warn-kick limit for members (default: 3)',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const num = parseInt(ctx.args[0]);
        if (!num || num < 1 || num > 20)
            return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a number between 1 and 20.\n\nExample: `.setlimit 5`', contextInfo: channelCtx() }, { quoted: ctx.m });
        setSetting('WARN_LIMIT', String(num));
        await ctx.sock.sendMessage(ctx.from, { text: `✅ *Warn Limit Set*\n\nMembers will be kicked after *${num}* warnings.`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ═══════════════════════════════════════════════════════════════
//  SET TIMEZONE
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'settz',
    aliases:   ['settimezone', 'timezone'],
    desc:      'Change the bot timezone',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const tz = ctx.args[0];
        if (!tz) return ctx.reply(
            '❌ Provide a timezone.\n\n' +
            'Examples:\n' +
            '`Africa/Nairobi`\n`America/New_York`\n`Europe/London`\n`Asia/Dubai`\n\n' +
            `Current: *${config.TIME_ZONE}*`
        );
        if (!moment.tz.zone(tz))
            return ctx.sock.sendMessage(ctx.from, { text: `❌ *"${tz}"* is not a valid timezone.\n\nCheck https://momentjs.com/timezone/`, contextInfo: channelCtx() }, { quoted: ctx.m });
        setSetting('TIME_ZONE', tz);
        config.TIME_ZONE = tz;
        const now = moment().tz(tz).format('hh:mm A · DD MMM YYYY');
        await ctx.sock.sendMessage(ctx.from, { text: `✅ *Timezone Updated*\n\nNew timezone: *${tz}*\nCurrent time: *${now}*`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ═══════════════════════════════════════════════════════════════
//  BOT SETTINGS OVERVIEW
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'botsettings',
    aliases:   ['settings', 'bsettings', 'config'],
    desc:      'View all current bot settings at a glance',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const on  = (v) => v === true || v === 'true' ? '🟢 ON' : '🔴 OFF';
        const warnLimit = getSetting('WARN_LIMIT', '3');

        const text =
            `⚙️ *${config.BOT_NAME} — Settings*\n` +
            `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n\n` +
            `🤖 *Bot Identity*\n` +
            `  Name    » *${config.BOT_NAME}*\n` +
            `  Owner   » *${config.OWNER_NAME}*\n` +
            `  Prefix  » *${config.BOT_PREFIX}*\n` +
            `  Mode    » *${config.MODE.toUpperCase()}*\n` +
            `  Version » *${config.BOT_VERSION}*\n` +
            `  TZ      » *${config.TIME_ZONE}*\n\n` +
            `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n` +
            `⚡ *Auto Features*\n` +
            `  Auto-React    » ${on(config.AUTO_REACT)}\n` +
            `  Auto-Bio      » ${on(config.AUTO_BIO)}\n` +
            `  Auto-Read     » ${on(config.AUTO_READ_STATUS)}\n` +
            `  Auto-Like     » ${on(config.AUTO_LIKE_STATUS)}\n` +
            `  Auto-Typing   » ${on(getSetting('AUTO_TYPING', 'false'))}\n\n` +
            `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n` +
            `🔒 *Privacy*\n` +
            `  Freeze LastSeen » ${on(getSetting('FREEZE_LAST_SEEN', 'false'))}\n` +
            `  Ghost Mode      » ${on(getSetting('GHOST_MODE', 'false'))}\n\n` +
            `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n` +
            `⚠️ *Warnings*\n` +
            `  Kick Limit » *${warnLimit} warnings*\n\n` +
            `▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰\n` +
            `_Use .setmode / .setprefix / .autoreact etc. to change_`;

        await ctx.reply(text);
    },
});

// ═══════════════════════════════════════════════════════════════
//  AUTO-RECORDING
//  Show "recording..." in chat — toggle independently of typing
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'autorecording',
    aliases:   ['togglerecording', 'recording'],
    desc:      'Toggle recording indicator before bot replies',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const current = getSetting('AUTO_RECORDING', 'false') === 'true';
        const newVal  = !current;
        setSetting('AUTO_RECORDING', String(newVal));
        config.AUTO_RECORDING = newVal;
        await ctx.reply(
            newVal
                ? '🎙️ *Auto-Recording ON*\n\nI will show a recording indicator before every reply.'
                : '🔕 *Auto-Recording OFF*\n\nRecording indicator disabled.'
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  GHOST MODE
//  Disables read receipts — bot reads messages silently
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'ghostmode',
    aliases:   ['ghost', 'toggleghost'],
    desc:      'Toggle ghost mode — hide read receipts',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const current = getSetting('GHOST_MODE', 'false') === 'true';
        const newVal  = !current;
        setSetting('GHOST_MODE', String(newVal));
        config.GHOST_MODE = newVal;
        try {
            await ctx.sock.updatePrivacySettings?.('readreceipts', newVal ? 'none' : 'all').catch(() => {});
        } catch {}
        await ctx.reply(
            newVal
                ? '👻 *Ghost Mode ON*\n\nRead receipts are now hidden. I read silently.'
                : '👁️ *Ghost Mode OFF*\n\nRead receipts are now visible.'
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  FREEZE LAST SEEN
//  Hides last seen from everyone
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'freezelastseen',
    aliases:   ['freezels', 'hidelastseen'],
    desc:      'Toggle hiding last seen from contacts',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const current = getSetting('FREEZE_LAST_SEEN', 'false') === 'true';
        const newVal  = !current;
        setSetting('FREEZE_LAST_SEEN', String(newVal));
        config.FREEZE_LAST_SEEN = newVal;
        try {
            await ctx.sock.updateLastSeenPrivacy?.(newVal ? 'none' : 'contacts').catch(() => {});
        } catch {}
        await ctx.reply(
            newVal
                ? '🧊 *Last Seen Frozen*\n\nNobody can see my last seen anymore.'
                : '🕐 *Last Seen Visible*\n\nLast seen is now visible to contacts.'
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  STATUS REPLY
//  Auto-reply to statuses with a custom message
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'statusreply',
    aliases:   ['togglestatusreply', 'autoreplystatuses'],
    desc:      'Toggle auto-reply to statuses',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const current = getSetting('STATUS_REPLY', 'false') === 'true';
        const newVal  = !current;
        setSetting('STATUS_REPLY', String(newVal));
        config.STATUS_REPLY = newVal;
        await ctx.reply(
            newVal
                ? '💬 *Status Reply ON*\n\nI will auto-reply to statuses.'
                : '🔕 *Status Reply OFF*\n\nAuto status reply disabled.'
        );
    },
});

addCmd({
    name:      'setstatusmsg',
    aliases:   ['statusmsg'],
    desc:      'Set the message to auto-reply on statuses',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const msg = ctx.text;
        if (!msg) return ctx.reply('📝 Usage: `.setstatusmsg <message>`\n\nExample: `.setstatusmsg Nice status! 🔥`');
        setSetting('STATUS_MSG', msg);
        config.STATUS_MSG = msg;
        await ctx.reply(`✅ *Status Reply Message Set*\n\n> ${msg}`);
    },
});

// ═══════════════════════════════════════════════════════════════
//  SET REACT EMOJIS
//  Change the random emoji pool used by auto-react
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'setreactemoji',
    aliases:   ['reactemojis', 'setemoji'],
    desc:      'Set custom auto-react emojis (comma-separated)',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const raw = ctx.text;
        if (!raw) return ctx.reply(
            '📝 Usage: `.setreactemoji 🔥,❤️,😎,✨`\n\n' +
            `Current emojis: \`${config.CUSTOM_REACT_EMOJIS}\``
        );
        const emojis = raw.split(',').map(e => e.trim()).filter(Boolean);
        if (emojis.length < 2) return ctx.reply('❌ Provide at least 2 emojis separated by commas.');
        const joined = emojis.join(',');
        setSetting('CUSTOM_REACT_EMOJIS', joined);
        config.CUSTOM_REACT_EMOJIS = joined;
        await ctx.reply(`✅ *React Emojis Updated*\n\nNew pool: ${emojis.join(' ')}`);
    },
});

// ═══════════════════════════════════════════════════════════════
//  WARN LIST  /  RESET WARNS
//  View and clear user warnings in a group
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'warnlist',
    aliases:   ['warnings', 'listwarns'],
    desc:      'List all warned users in this group',
    category:  'group',
    groupOnly: true,
    adminOnly: true,
    handler:   async (ctx) => {
        const { getAllWarnings } = require('../../guru/db/database');
        const warns = getAllWarnings(ctx.from);
        if (!warns || !warns.length)
            return ctx.reply('✅ No warnings have been issued in this group yet.');

        // Group by JID
        const grouped = {};
        for (const w of warns) {
            grouped[w.jid] = grouped[w.jid] || [];
            grouped[w.jid].push(w.reason || 'No reason given');
        }
        const lines = Object.entries(grouped).map(([jid, reasons]) =>
            `👤 @${jid.split('@')[0]}  ─  *${reasons.length} warn(s)*\n   └ ${reasons.slice(-1)[0]}`
        );
        const limit = getSetting('WARN_LIMIT', '3');
        await ctx.send({
            text: `⚠️ *Warned Users* (Limit: ${limit})\n\n${lines.join('\n\n')}\n\n_${config.BOT_NAME}_`,
            mentions: Object.keys(grouped),
        });
    },
});

addCmd({
    name:      'resetwarns',
    aliases:   ['clearwarns', 'resetwarn'],
    desc:      'Clear all warnings for a user (reply or mention)',
    category:  'group',
    groupOnly: true,
    adminOnly: true,
    handler:   async (ctx) => {
        const target = ctx.quoted?.sender
            || (ctx.m?.mentioned?.[0])
            || (ctx.args[0] ? ctx.args[0].replace(/\D/g, '') + '@s.whatsapp.net' : null);
        if (!target) return ctx.reply('❌ Reply to a user\'s message or mention them.\n\nExample: `.resetwarns @user`');
        const { clearWarnings } = require('../../guru/db/database');
        if (clearWarnings) clearWarnings(target, ctx.from);
        await ctx.send({
            text: `✅ *Warnings Cleared*\n\nAll warnings for @${target.split('@')[0]} have been reset.`,
            mentions: [target],
        });
    },
});

// ═══════════════════════════════════════════════════════════════
//  ANTISTICKER  — block stickers in groups
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'antisticker',
    aliases:   ['nosticker', 'blocksticker'],
    desc:      'Toggle antisticker — delete stickers sent in group',
    category:  'group',
    groupOnly: true,
    adminOnly: true,
    handler:   async (ctx) => {
        if (!ctx.isBotAdmin) return ctx.reply('❌ I need to be an *admin* to delete messages.');
        const current = getGroupSettings(ctx.from).antisticker;
        const newVal  = !current;
        setGroupSetting(ctx.from, 'antisticker', newVal);
        await ctx.reply(
            newVal
                ? '🚫 *Anti-Sticker ON*\n\nStickers sent in this group will be deleted.'
                : '✅ *Anti-Sticker OFF*\n\nSticker protection disabled.'
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  SET OWNER NUMBER / NAME  (runtime update)
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'setowner',
    aliases:   ['changeowner'],
    desc:      'Change the bot owner number at runtime',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const num = ctx.args[0]?.replace(/\D/g, '');
        if (!num || num.length < 7) return ctx.reply('❌ Provide a valid number.\n\nExample: `.setowner 254712345678`');
        setSetting('OWNER_NUMBER', num);
        config.OWNER_NUMBER = num;
        await ctx.reply(`✅ *Owner Number Updated*\n\nNew owner: +${num}`);
    },
});

addCmd({
    name:      'setownername',
    aliases:   ['ownername'],
    desc:      'Change the bot owner name at runtime',
    category:  'owner',
    ownerOnly: true,
    handler:   async (ctx) => {
        const name = ctx.text;
        if (!name) return ctx.reply('❌ Provide a name.\n\nExample: `.setownername GuruTech`');
        setSetting('OWNER_NAME', name);
        config.OWNER_NAME = name;
        await ctx.reply(`✅ *Owner Name Updated*\n\nNew name: *${name}*`);
    },
});

// ═══════════════════════════════════════════════════════════════
//  PING  — response speed / latency check
// ═══════════════════════════════════════════════════════════════

addCmd({
    name:      'ping',
    aliases:   ['speed', 'latency'],
    desc:      'Check bot response speed and system health',
    category:  'general',
    handler:   async (ctx) => {
        const start  = Date.now();
        const mem    = process.memoryUsage();
        const uptime = process.uptime();
        const days   = Math.floor(uptime / 86400);
        const hours  = Math.floor((uptime % 86400) / 3600);
        const mins   = Math.floor((uptime % 3600) / 60);

        const sent = await ctx.reply('🏓 Pinging...');
        const ms   = Date.now() - start;

        await ctx.reply(
            `🏓 *Pong!*\n\n` +
            `⚡ *Response :* ${ms}ms\n` +
            `🧠 *Memory  :* ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB\n` +
            `⏱️ *Uptime   :* ${days}d ${hours}h ${mins}m\n` +
            `🖥️ *Platform :* ${require('../../guru/utils/logger').PLATFORM}\n` +
            `🤖 *Version  :* ${config.BOT_VERSION}\n\n` +
            `_${config.BOT_NAME}_`
        );
    },
});
