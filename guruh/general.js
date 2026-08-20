"use strict";

const { gmd }          = require("../guru");
const moment           = require("moment-timezone");

const {
    buildThemedMenu,
    sendMenuMsg,
} = require("./design");

// ─── 1. MENU ──────────────────────────────────────────────────────────────────

gmd(
    {
        pattern: "menu",
        aliases: ["help", "cmds", "commands", "start"],
        react: "📋",
        category: "general",
        description: "Show the bot command menu",
    },
    async (from, Guru, conText) => {
        const { react, mek } = conText;
        await react("📋");
        const text = await buildThemedMenu(conText, Guru);
        await sendMenuMsg(Guru, from, text, conText);
        await react("✅");

        // ── Live clock below the menu — ticks every second for 60s ──────────
        const tz = process.env.TIME_ZONE || 'Africa/Nairobi';
        const buildClock = () => {
            const t     = moment().tz(tz);
            const time  = t.format('hh:mm:ss A');
            const date  = t.format('ddd, DD MMM YYYY');
            const total = Math.floor((Date.now() - (global._botStartTime || Date.now())) / 1000);
            const d     = Math.floor(total / 86400);
            const h     = Math.floor((total % 86400) / 3600);
            const m     = Math.floor((total % 3600) / 60);
            const s     = total % 60;
            const alive = [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' : ');
            return `🕐 *${time}*\n📅 ${date}\n⏱️ Alive: *${alive}*`;
        };

        try {
            const clockMsg = await Guru.sendMessage(from, { text: buildClock() }, { quoted: mek });
            let ticks = 0;
            const timer = setInterval(async () => {
                ticks++;
                try {
                    await Guru.sendMessage(from, { text: buildClock(), edit: clockMsg.key });
                } catch (_) {}
                if (ticks >= 60) clearInterval(timer);
            }, 1000);
        } catch (_) {}
    }
);

// ─── Category handler lives in guruh/plugins/menuReply.js ────────────────────
// (Removed duplicate gmd handler — menuReply.js is the single source of truth)

// ─── 3. PING / ALIVE ─────────────────────────────────────────────────────────

// Track exact moment the process started (set once, never changes)
if (!global._botStartTime) global._botStartTime = Date.now();

function getAliveCount() {
    const totalMs  = Date.now() - global._botStartTime;
    const totalSec = Math.floor(totalMs / 1000);
    const days     = Math.floor(totalSec / 86400);
    const hours    = Math.floor((totalSec % 86400) / 3600);
    const minutes  = Math.floor((totalSec % 3600) / 60);
    const seconds  = totalSec % 60;

    const parts = [];
    if (days)    parts.push(`${days}d`);
    if (hours)   parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' : ');
}

gmd(
    {
        pattern: "ping",
        aliases: ["alive", "status", "check"],
        react: "🏓",
        category: "general",
        description: "Check if the bot is online and responsive",
    },
    async (from, Guru, conText) => {
        const { mek, react, botName, botPrefix } = conText;
        const start = Date.now();
        await react("🏓");
        const ping = Date.now() - start;

        const buildMsg = () => {
            const alive = getAliveCount();
            return `⚡ ──「 🏓 *PING* 」──
▢ 🟢 Status  : ✅ Online
▢ 📶 Ping    : *${ping}ms*
▢ ⏱️ Alive   : *${alive}*
▢ 📌 Prefix  : *${botPrefix || "."}*
└──✦ _${botName || "BLACK PANTHER"} ┃ ᴹᴰ_ ✦──`;
        };

        // Send the first message
        const sent = await Guru.sendMessage(from, { text: buildMsg() }, { quoted: mek });

        // Edit it every second for 30 ticks so user sees it count live
        let ticks = 0;
        const timer = setInterval(async () => {
            ticks++;
            try {
                await Guru.sendMessage(from, {
                    text: buildMsg(),
                    edit: sent.key,
                });
            } catch (_) {}
            if (ticks >= 30) {
                clearInterval(timer);
                // Final edit — remove the "counting live" footer
                try {
                    await Guru.sendMessage(from, {
                        text: buildMsg().replace(`_${botName || "BLACK PANTHER"} ┃ ᴹᴰ_ ✦──`, `*${botName || "BLACK PANTHER"} ┃ ᴹᴰ* ✦──`),
                        edit: sent.key,
                    });
                } catch (_) {}
            }
        }, 1000);
    }
);

// ─── 4. UPTIME / RUNTIME ─────────────────────────────────────────────────────

gmd(
    {
        pattern: "uptime",
        aliases: ["runtime", "ut"],
        react: "⏱️",
        category: "general",
        description: "Check how long the bot has been running",
    },
    async (from, Guru, conText) => {
        const { react, botName, timeZone, mek } = conText;
        await react("⏱️");

        const tz = timeZone || process.env.TIME_ZONE || "Africa/Nairobi";
        const bn = botName || "BLACK PANTHER";

        const buildMsg = () => {
            const t     = moment().tz(tz);
            const time  = t.format("hh:mm:ss A");
            const date  = t.format("ddd, DD MMM YYYY");
            const total = Math.floor((Date.now() - (global._botStartTime || Date.now())) / 1000);
            const d     = Math.floor(total / 86400);
            const h     = Math.floor((total % 86400) / 3600);
            const m     = Math.floor((total % 3600) / 60);
            const s     = total % 60;
            const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean);
            return (
`⚡ ──「 ⏱️ *UPTIME* 」──
▢ ⏱️ Alive   : *${parts.join(' : ')}*
▢ 🕐 Time    : ${time}
▢ 📅 Date    : ${date}
└──✦ _${bn} ┃ ᴹᴰ_ ✦──`
            );
        };

        const sent = await Guru.sendMessage(from, { text: buildMsg() }, { quoted: mek });

        let ticks = 0;
        const timer = setInterval(async () => {
            ticks++;
            try {
                await Guru.sendMessage(from, { text: buildMsg(), edit: sent.key });
            } catch (_) {}
            if (ticks >= 30) {
                clearInterval(timer);
                try {
                    await Guru.sendMessage(from, {
                        text: buildMsg().replace(`_${bn} ┃ ᴹᴰ_ ✦──`, `*${bn} ┃ ᴹᴰ* ✦──`),
                        edit: sent.key,
                    });
                } catch (_) {}
            }
        }, 1000);
        await react("✅");
    }
);

// ─── 5. BOTINFO / INFO ────────────────────────────────────────────────────────

gmd(
    {
        pattern: "botinfo",
        aliases: ["info", "about", "mybot"],
        react: "🤖",
        category: "general",
        description: "Show information about this bot",
    },
    async (from, Guru, conText) => {
        const { reply, react, botName, botPrefix, botVersion,
                botMode, ownerName } = conText;
        await react("🤖");

        const { commands } = require("../guru");
        const totalCmds = commands.filter(c => c.pattern && !c.dontAddCommandList).length;
        const up = process.uptime();
        const h  = Math.floor(up / 3600);
        const m  = Math.floor((up % 3600) / 60);

        await reply(
`⚡ ──「 🤖 *BOT INFO* 」──
▢ 🏷️ Version  : *v${botVersion || "5.0.0"}*
▢ 📌 Prefix   : *${botPrefix || "."}*
▢ 🌐 Mode     : *${(botMode || "public").toUpperCase()}*
▢ 📚 Commands : *${totalCmds}*
▢ ⏱️ Uptime   : *${h}h ${m}m*
▢ 👑 Owner    : *${ownerName || "Koyoteh"}*
▢ 📦 Library  : Baileys
└──✦ _${botName || "BLACK PANTHER"} ┃ ᴹᴰ_ ✦──`
        );
    }
);

module.exports = {};
