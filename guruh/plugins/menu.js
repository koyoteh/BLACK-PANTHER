'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  menu.js  (WAKANDA EDITION v2)
//  🌍  Redesigned with full category listing, expiry countdown,
//      animated-style status bar, and per-category deep dives.
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd, addTrigger, getAllCmds } = require('../../guru/handlers/loader');
const { gmdProgress, runtime, fmtBytes } = require('../../guru/utils/gmdFunctions');
const { daysUntil, fmtDate, parseExpiryDate, fmtCountdown, expiryBar, expiryLine } = require('../../guru/utils/expiry');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
const config = require('../../guru/config/settings');
const moment = require('moment-timezone');

const MENU_IMAGE = 'https://tmpfiles.org/dl/36257265/panther_1777780194457.jpg';

const CATS = [
    { key: 'general',    label: 'GENERAL',     icon: '⚙️',  block: '█' },
    { key: 'ai',         label: 'AI & CHAT',   icon: '🤖',  block: '▓' },
    { key: 'downloader', label: 'DOWNLOADER',  icon: '📥',  block: '▒' },
    { key: 'music',      label: 'MUSIC',       icon: '🎵',  block: '░' },
    { key: 'search',     label: 'SEARCH',      icon: '🔍',  block: '▰' },
    { key: 'tools',      label: 'TOOLS',       icon: '🔧',  block: '▱' },
    { key: 'group',      label: 'GROUP',       icon: '👥',  block: '▌' },
    { key: 'games',      label: 'GAMES',       icon: '🎮',  block: '▐' },
    { key: 'media',      label: 'MEDIA',       icon: '🎬',  block: '◆' },
    { key: 'lifestyle',  label: 'LIFESTYLE',   icon: '🌿',  block: '◇' },
    { key: 'fun',        label: 'FUN',         icon: '😂',  block: '●' },
    { key: 'owner',      label: 'OWNER',       icon: '👑',  block: '◉' },
    { key: 'religion',   label: 'RELIGION',    icon: '🕌',  block: '◈' },
    { key: 'misc',       label: 'MISC',        icon: '📦',  block: '○' },
];

// Clean dividers
const DIV   = '─'.repeat(30);
const DIV_S = '─'.repeat(18);

function now(fmt) { return moment().tz(config.TIME_ZONE || 'Africa/Nairobi').format(fmt); }
function numFromJid(jid) { return (jid || '').split('@')[0].split(':')[0]; }

// ── Pending-menu state (per chat, 3-min TTL) ──────────────────
//   Map<chatJid, { categories: [{ key, label, icon, cmds }], expiresAt }>
const pendingMenus = new Map();
const PENDING_TTL_MS = 3 * 60 * 1000;

function setPending(chatJid, categories) {
    pendingMenus.set(chatJid, { categories, expiresAt: Date.now() + PENDING_TTL_MS });
    setTimeout(() => {
        const e = pendingMenus.get(chatJid);
        if (e && e.expiresAt <= Date.now()) pendingMenus.delete(chatJid);
    }, PENDING_TTL_MS + 500);
}
function getPending(chatJid) {
    const e = pendingMenus.get(chatJid);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) { pendingMenus.delete(chatJid); return null; }
    return e;
}

function getExpiryStatus() {
    try {
        const raw = process.env.EXPIRY_DATE;
        if (!raw?.trim()) return { line: '✅ No expiry set', urgent: false };
        const exp  = parseExpiryDate(raw);
        if (!exp)  return { line: '✅ No expiry set', urgent: false };
        const days = daysUntil(exp);
        const ms   = exp.getTime() - Date.now();
        const bar  = expiryBar(days, 30, 14);
        if (ms <= 0) return {
            line: `🔴 *EXPIRED* ${Math.abs(days)}d ago · Contact owner!`,
            urgent: true
        };
        if (days === 1) return {
            line: `🆘 *TODAY!* ${fmtCountdown(ms)} left\n     ${bar}`,
            urgent: true
        };
        if (days <= 3) return {
            line: `🔴 *${days}d left!* ${fmtCountdown(ms)}\n     ${bar} · ${fmtDate(exp)}`,
            urgent: true
        };
        if (days <= 7) return {
            line: `🟠 ${days}d left · ${bar} · ${fmtDate(exp)}`,
            urgent: false
        };
        return {
            line: `🟢 Active · ${days}d remaining · ${fmtDate(exp)}`,
            urgent: false
        };
    } catch { return { line: '✅ No expiry', urgent: false }; }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN MENU
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'menu',
    aliases: ['help', 'commands', 'cmds', 'start', 'ls'],
    desc: 'Show all available commands',
    usage: 'menu  |  menu <category>',
    category: 'general',
    handler: async (ctx) => {
        const allCmds  = getAllCmds();
        const arg      = ctx.args[0]?.toLowerCase();
        const catMatch = CATS.find(c => c.key === arg || c.label.toLowerCase() === arg);
        const userNum  = numFromJid(ctx.sender);
        const p        = config.BOT_PREFIX;

        // ── Per-category detail (by name) ─────────────────
        if (arg && catMatch) {
            return sendCategoryDetail(ctx, catMatch, allCmds);
        }

        // ── Full menu ─────────────────────────────────────
        const mem     = process.memoryUsage();
        const uptime  = runtime(process.uptime() * 1000);
        const memPct  = Math.round((mem.heapUsed / mem.heapTotal) * 10);
        const memBar  = gmdProgress(memPct, 10, '');
        const expiry  = getExpiryStatus();
        const grouped = {};
        for (const cmd of allCmds) {
            const cat = cmd.category || 'misc';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(cmd);
        }

        const greetings = ['Habari', 'Sawubona', 'Sanibona', 'Dumela', 'Hello', 'Salut'];
        const greeting  = greetings[Math.floor(Math.random() * greetings.length)];
        const hour      = parseInt(now('HH'));
        const timeGreet = hour < 12 ? '🌅 Good Morning' : hour < 17 ? '☀️ Good Afternoon' : hour < 21 ? '🌆 Good Evening' : '🌙 Good Night';

        const displayName = ctx.pushName || 'Unknown';
        const statusBlock =
            `╭──────────────╮\n` +
            `│  ${config.BOT_NAME}\n` +
            `├──────────────╯\n` +
            `│ ${greeting}, *${displayName}*\n` +
            `│ ${timeGreet} · ${now('hh:mm A')}\n` +
            `│ Prefix : ${p}\n` +
            `│ Uptime : ${uptime}\n` +
            `│ Mode   : ${config.MODE}\n` +
            `│ Owner  : ${config.OWNER_NAME}\n` +
            `╰──────────────╮`;

        const expiryLine = expiry.urgent
            ? `🔒 ${expiry.line} | wa.me/254105521300`
            : `🔒 ${expiry.line}`;

        const numbered = [];
        for (const cat of CATS) {
            const cmds = grouped[cat.key] || [];
            if (!cmds.length) continue;
            numbered.push({ ...cat, cmds });
        }

        let menu = '';
        menu += `╭═❖ *${config.BOT_NAME}* ❖═╮\n`;
        menu += `╰═❖ _${config.CHANNEL_NAME}_ ❖═╯\n\n`;
        menu += `${statusBlock}\n\n`;
        menu += `${expiryLine}\n\n`;
        menu += `╭═❖ *${now('DD MMM YYYY')}*  ·  *${now('hh:mm:ss A')}* ❖═╮\n`;
        menu += `╰──────────────────────────╯\n\n`;
        menu += `╭═❖ *CATEGORIES* ❖═╮\n`;
        menu += `│ Reply 1-${numbered.length} or use \`${p}menu <name>\`\n`;
        menu += `├──────────────────╯\n`;

        numbered.forEach((cat, i) => {
            const num = String(i + 1).padStart(2, '0');
            menu += `│ ${num}  ${cat.icon}  ${cat.label}\n`;
        });
        menu += `╰──────────────────╯\n\n`;

        // Save numbered list as pending so user can reply with the number
        setPending(ctx.from, numbered);

        menu += `╭═❖ _Use categories above_ ❖═╮`;

        try {
            await ctx.sock.sendMessage(
                ctx.from,
                {
                    image:    { url: MENU_IMAGE },
                    caption:  menu,
                    mentions: [ctx.sender],
                    contextInfo: channelCtx(),
                },
                { quoted: ctx.m }
            );
        } catch {
            await ctx.sock.sendMessage(
                ctx.from,
                {
                    text:     menu,
                    mentions: [ctx.sender],
                    contextInfo: channelCtx(),
                },
                { quoted: ctx.m }
            );
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  PING
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'ping',
    aliases: ['speed', 'latency', 'test'],
    desc: 'Check bot response speed',
    category: 'general',
    handler: async (ctx) => {
        const start = Date.now();
        const sent  = await ctx.reply('...');
        const ms    = Date.now() - start;
        const grade = ms < 200 ? '🟢 Excellent' : ms < 500 ? '🟡 Good' : ms < 1000 ? '🟠 Fair' : '🔴 Slow';
        const bar   = '█'.repeat(Math.min(10, Math.floor(ms/100))) + '░'.repeat(Math.max(0, 10-Math.floor(ms/100)));

        await ctx.sock.sendMessage(
            ctx.from,
            {
                text:
                    `*⚡ SPEED TEST*\n${config.BOT_NAME}\n\n` +
                    `🏓 *Latency:* *${ms}ms*\n` +
                    `📊 *Grade:*   ${grade}\n` +
                    `[${bar}]\n\n` +
                    `⏰ *Time:*    ${now('hh:mm:ss A')}\n` +
                    `✅ *Status:*  Online & Active\n\n` +
                    `◈ ${config.CHANNEL_NAME}`,
                contextInfo: channelCtx(),
            },
            { quoted: ctx.m }
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  INFO
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'info',
    aliases: ['botinfo', 'about'],
    desc: 'Show detailed bot information',
    category: 'general',
    handler: async (ctx) => {
        const mem    = process.memoryUsage();
        const uptime = runtime(process.uptime() * 1000);
        const memPct = Math.round((mem.heapUsed / mem.heapTotal) * 10);
        const bar    = gmdProgress(memPct, 10, '');

        await ctx.sock.sendMessage(
            ctx.from,
            {
                text:
                    `*🐾 BOT INFO*\n${config.BOT_NAME}\n\n` +
                    `🤖 *Name:*     ${config.BOT_NAME}\n` +
                    `📦 *Version:*  v${config.BOT_VERSION || '2.0.0'}\n` +
                    `👑 *Owner:*    ${config.OWNER_NAME}\n` +
                    `📞 *Contact:*  +${config.OWNER_NUMBER}\n\n` +
                    `⚙️ *Prefix:*   ${config.BOT_PREFIX}\n` +
                    `🌍 *Mode:*     ${config.MODE}\n` +
                    `⏱️ *Uptime:*   ${uptime}\n` +
                    `💾 *RAM:*      ${fmtBytes(mem.heapUsed)} / ${fmtBytes(mem.heapTotal)}\n` +
                    `${bar}\n\n` +
                    `📅 *Date:*     ${now('DD MMM YYYY')}\n` +
                    `🕐 *Time:*     ${now('hh:mm A')}\n\n` +
                    `*🔒 LICENCE*\n${expiryLine()}\n\n` +
                    `◈ ${config.CHANNEL_NAME}`,
                contextInfo: channelCtx(),
            },
            { quoted: ctx.m }
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  ALIVE
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'alive',
    aliases: ['status', 'online', 'active', 'wake'],
    desc: 'Confirm the bot is running',
    category: 'general',
    handler: async (ctx) => {
        const mem     = process.memoryUsage();
        const uptime  = runtime(process.uptime() * 1000);
        const memPct  = Math.round((mem.heapUsed / mem.heapTotal) * 10);
        const bar     = gmdProgress(memPct, 10, '');
        const userNum = numFromJid(ctx.sender);
        const expiry  = getExpiryStatus();

        const caption =
            `*🐾 BLACK PANTHER MD*\n` +
            `${'═'.repeat(30)}\n` +
            `*Wakanda Forever!* ✊🏿\n` +
            `${'═'.repeat(30)}\n\n` +
            `Hey *@${userNum}*, I'm ALIVE! ⚡\n\n` +
            `✅ *Status:*  Online & Active\n` +
            `⏱️ *Uptime:*  ${uptime}\n` +
            `📅 *Date:*    ${now('DD MMM YYYY')}\n` +
            `🕐 *Time:*    ${now('hh:mm:ss A')}\n` +
            `💾 *RAM:*     ${fmtBytes(mem.heapUsed)}\n` +
            `${bar}\n\n` +
            `*🔒 Licence:*\n${expiry.line}\n\n` +
            `👑 *Owner:*   ${config.OWNER_NAME}\n` +
            `⚙️ *Prefix:*  ${config.BOT_PREFIX}\n` +
            `🌍 *Mode:*    ${config.MODE}\n\n` +
            `◈ ${config.CHANNEL_NAME}`;

        try {
            await ctx.sock.sendMessage(
                ctx.from,
                {
                    image:    { url: MENU_IMAGE },
                    caption,
                    mentions: [ctx.sender],
                    contextInfo: channelCtx(),
                },
                { quoted: ctx.m }
            );
        } catch {
            await ctx.sock.sendMessage(
                ctx.from,
                {
                    text:     caption,
                    mentions: [ctx.sender],
                    contextInfo: channelCtx(),
                },
                { quoted: ctx.m }
            );
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  RUNTIME / SYSINFO
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'runtime',
    aliases: ['uptime', 'stats', 'sysinfo', 'system'],
    desc: 'Show bot uptime and system stats',
    category: 'general',
    handler: async (ctx) => {
        const mem     = process.memoryUsage();
        const uptime  = runtime(process.uptime() * 1000);
        const memPct  = Math.round((mem.heapUsed / mem.heapTotal) * 100);
        const filled  = Math.round((memPct / 100) * 20);
        const bar     = '█'.repeat(filled) + '░'.repeat(20 - filled);
        const allCmds = getAllCmds();

        await ctx.sock.sendMessage(
            ctx.from,
            {
                text:
                    `*💻 SYSTEM STATS*\n${config.BOT_NAME}\n\n` +
                    `✅ *Status:*    Online & Active\n` +
                    `⏱️ *Uptime:*    ${uptime}\n` +
                    `📦 *Commands:*  ${allCmds.length} loaded\n\n` +
                    `💾 *RAM Used:*  ${fmtBytes(mem.heapUsed)}\n` +
                    `🖥️ *RAM Total:* ${fmtBytes(mem.heapTotal)}\n` +
                    `📊 *RAM %:*     ${memPct}%\n` +
                    `[${bar}]\n\n` +
                    `🖥️ *Platform:* ${process.platform}\n` +
                    `⚙️ *Node.js:*  ${process.version}\n` +
                    `📅 *Date:*     ${now('DD MMM YYYY')}\n` +
                    `🕐 *Time:*     ${now('hh:mm:ss A')}\n\n` +
                    `*🔒 Licence:*\n${expiryLine()}\n\n` +
                    `◈ ${config.CHANNEL_NAME}`,
                contextInfo: channelCtx(),
            },
            { quoted: ctx.m }
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  MY INFO
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'myinfo',
    aliases: ['whoami', 'me', 'profile'],
    desc: 'Show your personal info card',
    category: 'general',
    handler: async (ctx) => {
        const number = numFromJid(ctx.sender);
        let ppUrl = null;
        try { ppUrl = await ctx.sock.profilePictureUrl(ctx.sender, 'image'); } catch {}

        const role = ctx.isOwner ? '👑 Bot Owner' : ctx.isAdmin ? '🛡️ Group Admin' : '👤 Member';
        const msg =
            `*🪪 YOUR PROFILE*\n${config.BOT_NAME}\n\n` +
            `📛 *Name:*    ${ctx.pushName || 'Unknown'}\n` +
            `📞 *Number:*  +${number}\n` +
            `🆔 *JID:*     \`${ctx.sender}\`\n` +
            `🎭 *Role:*    ${role}\n` +
            `💬 *Group:*   ${ctx.isGroup ? (ctx.groupName || 'Yes') : 'Private Chat'}\n` +
            `🖼️ *Photo:*   ${ppUrl ? '✅ Has profile pic' : '❌ No profile pic'}\n` +
            `🕐 *Time:*    ${now('hh:mm A')}\n\n` +
            `◈ ${config.CHANNEL_NAME}`;

        if (ppUrl) {
            await ctx.sock.sendMessage(ctx.from, { image: { url: ppUrl }, caption: msg, contextInfo: channelCtx() }, { quoted: ctx.m });
        } else {
            await ctx.sock.sendMessage(ctx.from, { text: msg, contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  EXPIRY STATUS COMMAND
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'expiry',
    aliases: ['licence', 'license', 'validity', 'expire'],
    desc: 'Check bot licence expiry in detail',
    category: 'general',
    handler: async (ctx) => {
        try {
            const raw = process.env.EXPIRY_DATE;
            if (!raw?.trim()) return ctx.reply(`*🔒 LICENCE STATUS*\n${config.BOT_NAME}\n\n✅ *No expiry configured.*\nThis bot runs indefinitely.\n\n◈ ${config.CHANNEL_NAME}`);
            const exp    = parseExpiryDate(raw);
            if (!exp) return ctx.reply('✅ No expiry date set.');
            const days   = daysUntil(exp);
            const ms     = exp.getTime() - Date.now();
            const bar    = expiryBar(days, 30);
            const countdown = ms > 0 ? fmtCountdown(ms) : 'EXPIRED';

            const urgency = ms <= 0 ? '🔴 EXPIRED'
                          : days <= 1 ? '🆘 EXPIRES TODAY'
                          : days <= 3 ? '🔴 CRITICAL'
                          : days <= 7 ? '🟠 WARNING'
                          : days <= 14 ? '🟡 NOTICE'
                          : '🟢 ACTIVE';

            const text =
                `*🔒 LICENCE STATUS*\n${config.BOT_NAME}\n` +
                `${'═'.repeat(32)}\n\n` +
                `📊 *Status:*     ${urgency}\n` +
                `📅 *Expiry Date:* ${fmtDate(exp)}\n` +
                `⏳ *Countdown:*  ${countdown}\n` +
                `📆 *Days Left:*  ${days > 0 ? days : 'EXPIRED'}\n\n` +
                `${bar}\n\n` +
                (ms <= 0
                    ? `🔴 This bot has expired!\n📞 Contact: wa.me/254105521300\n`
                    : days <= 7
                        ? `⚠️ Renew before expiry!\n📞 Contact: wa.me/254105521300\n`
                        : `✅ Licence is valid.\n`) +
                `\n◈ ${config.CHANNEL_NAME}`;

            await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch { await ctx.reply('❌ Error reading expiry status.'); }
    },
});

// ═══════════════════════════════════════════════════════════════
//  CATEGORY DETAIL HELPER + NUMERIC REPLY TRIGGER
// ═══════════════════════════════════════════════════════════════
async function sendCategoryDetail(ctx, cat, allCmds) {
    const p    = config.BOT_PREFIX;
    const cmds = (cat.cmds && cat.cmds.length)
        ? cat.cmds
        : allCmds.filter(c => c.category === cat.key);
    if (!cmds.length) return ctx.reply(`No commands in *${cat.label}* yet.`);

    let out = '';
    out += `${cat.icon}  *${cat.label}*\n`;
    out += `_${config.BOT_NAME}_\n`;
    out += `${DIV}\n\n`;
    cmds.forEach(c => {
        out += `• *${p}${c.name}*\n`;
        if (c.desc)  out += `   _${c.desc}_\n`;
        if (c.usage) out += `   ↳ \`${p}${c.usage}\`\n`;
        out += `\n`;
    });
    out += `${DIV}\n`;
    out += `↩  Type *${p}menu* to go back\n`;
    out += `◈ ${config.CHANNEL_NAME}`;

    try {
        return await ctx.sock.sendMessage(
            ctx.from,
            { image: { url: MENU_IMAGE }, caption: out, contextInfo: channelCtx() },
            { quoted: ctx.m }
        );
    } catch {
        return ctx.sock.sendMessage(
            ctx.from,
            { text: out, contextInfo: channelCtx() },
            { quoted: ctx.m }
        );
    }
}

// Trigger: pure-number reply within 3 min of receiving the menu
addTrigger({
    pattern: /^\s*(\d{1,2})\s*$/,
    handler: async (ctx) => {
        const pending = getPending(ctx.from);
        if (!pending) return;
        const idx = parseInt(ctx.body.trim(), 10) - 1;
        if (idx < 0 || idx >= pending.categories.length) {
            return ctx.reply(`❌ Invalid number. Pick *1–${pending.categories.length}*.`);
        }
        const cat = pending.categories[idx];
        return sendCategoryDetail(ctx, cat, getAllCmds());
    },
});
