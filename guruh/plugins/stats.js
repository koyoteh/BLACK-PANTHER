'use strict';
const { addCmd }                                      = require('../../guru/handlers/loader');
const { getTopCmds, getCmdStat, getTotalUses,
        resetCmdStats }                               = require('../../guru/db/database');
const config                                          = require('../../guru/config/settings');

const MEDALS = ['🥇', '🥈', '🥉'];
const BAR_FILLED  = '█';
const BAR_EMPTY   = '░';
const BAR_LEN     = 10;

function bar(uses, max) {
    const filled = max > 0 ? Math.round((uses / max) * BAR_LEN) : 0;
    return BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(BAR_LEN - filled);
}

function fmtNum(n) {
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

// ── .topcmds ──────────────────────────────────────────────────
addCmd({
    name:     'topcmds',
    aliases:  ['topcmd', 'topcommands', 'cmdtop'],
    desc:     'Show the most-used bot commands',
    usage:    '.topcmds [number]',
    category: 'stats',
    handler:  async (ctx) => {
        const limit  = Math.min(parseInt(ctx.args[0]) || 10, 25);
        const rows   = getTopCmds(limit);
        const total  = getTotalUses();

        if (!rows.length) {
            return ctx.reply('📊 No command stats yet — start using the bot!');
        }

        const p      = config.BOT_PREFIX;
        const maxUse = rows[0].uses;

        let text = `╭─❖ 📊 *TOP ${rows.length} COMMANDS* ❖─╮\n│\n`;
        rows.forEach((r, i) => {
            const medal = MEDALS[i] || `${i + 1}.`;
            text += `│ ${medal} *${p}${r.command}*\n`;
            text += `│    ${bar(r.uses, maxUse)} ${fmtNum(r.uses)} uses\n`;
        });
        text += `│\n├─❖ Total uses: *${fmtNum(total)}*\n`;
        text += `╰─❖ Powered by ${config.OWNER_NAME} ❖─╯`;

        await ctx.reply(text);
    },
});

// ── .cmdstats ──────────────────────────────────────────────────
addCmd({
    name:     'cmdstats',
    aliases:  ['commandstats', 'cstats'],
    desc:     'Show usage stats for a specific command',
    usage:    '.cmdstats <command>',
    category: 'stats',
    handler:  async (ctx) => {
        const target = (ctx.args[0] || '').replace(/^[.\/!]/, '').toLowerCase();
        if (!target) return ctx.reply(`❓ Usage: *${config.BOT_PREFIX}cmdstats <command>*`);

        const stat  = getCmdStat(target);
        const total = getTotalUses();

        if (!stat || stat.uses === 0) {
            return ctx.reply(`📊 *${config.BOT_PREFIX}${target}* has not been used yet.`);
        }

        const pct = total > 0 ? ((stat.uses / total) * 100).toFixed(1) : '0.0';
        const text =
            `╭─❖ 📊 *COMMAND STATS* ❖─╮\n│\n` +
            `├─❖ Command : *${config.BOT_PREFIX}${target}*\n` +
            `├─❖ Uses    : *${fmtNum(stat.uses)}*\n` +
            `├─❖ Share   : *${pct}%* of all ${fmtNum(total)} uses\n` +
            `├─❖ Bar     : ${bar(stat.uses, stat.uses)}\n` +
            `├─❖ Last    : ${stat.last_used}\n│\n` +
            `╰─❖ ${config.BOT_NAME} ❖─╯`;

        await ctx.reply(text);
    },
});

// ── .resetstats (owner only) ───────────────────────────────────
addCmd({
    name:      'resetstats',
    aliases:   ['clearstats'],
    desc:      'Reset all command usage statistics',
    usage:     '.resetstats',
    category:  'stats',
    ownerOnly: true,
    handler:   async (ctx) => {
        resetCmdStats();
        await ctx.reply('✅ All command stats have been reset.');
    },
});
