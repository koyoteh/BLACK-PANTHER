'use strict';
// ╭─────────────────────────────────────────╮
//   BLACK PANTHER MD  ·  autostatus.js
//   Owner control for the Status Manager
// ╰─────────────────────────────────────────╯

const { addCmd }                    = require('../../guru/handlers/loader');
const { getAutoStatusSettings }     = require('../statusManager');
const { channelCtx }                = require('../../guru/utils/gmdFunctions2');
const config                        = require('../../guru/config/settings');

// Initialise global runtime flags if not set
if (!global.autoStatusFlags) {
    global.autoStatusFlags = { seen: null, react: null };
}
if (!global.autoPresenceFlags) {
    global.autoPresenceFlags = { typing: null, recording: null };
}

// ═══════════════════════════════════════════════════════════════
//  .autostatus  —  view & toggle all status settings
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'autostatus',
    aliases: ['statusconfig', 'stconfig'],
    desc: 'View and toggle auto-status settings',
    usage: 'autostatus  |  autostatus <option> <on|off>',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const arg1 = ctx.args[0]?.toLowerCase();
        const arg2 = ctx.args[1]?.toLowerCase();

        // ── Toggle a specific setting ─────────────────────
        if (arg1 && arg2) {
            const val = arg2 === 'on';
            let changed = '';

            switch (arg1) {
                case 'view':
                case 'seen':
                    global.autoStatusFlags.seen = val;
                    changed = `Auto View  ·  *${val ? 'ON' : 'OFF'}*`;
                    break;
                case 'react':
                case 'like':
                    global.autoStatusFlags.react = val;
                    changed = `Auto React ·  *${val ? 'ON' : 'OFF'}*`;
                    break;
                default:
                    return ctx.sock.sendMessage(
                        ctx.from,
                        {
                            text:
                                `*AUTOSTATUS*\n${config.BOT_NAME}\n\n` +
                                `Unknown option: *${arg1}*\n\n` +
                                `Valid options\n` +
                                `  view   on|off\n` +
                                `  react  on|off\n\n` +
                                `◈ ${config.CHANNEL_NAME}`,
                            contextInfo: channelCtx(),
                        },
                        { quoted: ctx.m }
                    );
            }

            return ctx.sock.sendMessage(
                ctx.from,
                {
                    text:
                        `*AUTOSTATUS UPDATED*\n${config.BOT_NAME}\n\n` +
                        `${changed}\n\n` +
                        `◈ ${config.CHANNEL_NAME}`,
                    contextInfo: channelCtx(),
                },
                { quoted: ctx.m }
            );
        }

        // ── Show current settings ─────────────────────────
        let viewEnabled = false;
        let reactEnabled = false;
        let reactEmoji = '🐺';
        let reactMode = 'fixed';
        try {
            const { autoViewManager }  = require('./autoviewstatus');
            const { autoReactManager } = require('./autoreactstatus');
            viewEnabled  = autoViewManager.enabled;
            reactEnabled = autoReactManager.enabled;
            reactEmoji   = autoReactManager.fixedEmoji;
            reactMode    = autoReactManager.mode;
        } catch {}

        const s = getAutoStatusSettings();

        await ctx.sock.sendMessage(
            ctx.from,
            {
                text:
                    `*AUTO STATUS CONFIG*\n${config.BOT_NAME}\n\n` +
                    `Auto View    ·  *${viewEnabled ? 'ON' : 'OFF'}*\n` +
                    `Auto React   ·  *${reactEnabled ? 'ON' : 'OFF'}*\n` +
                    `React Emoji  ·  *${reactEmoji}* (${reactMode})\n` +
                    `Auto Reply   ·  *DISABLED*\n` +
                    `Status Saver ·  *${s.statusSaver === 'true' ? 'ON' : 'OFF'}*\n` +
                    `Saver Reply  ·  *${s.statusSaverReply === 'true' ? 'ON' : 'OFF'}*\n\n` +
                    `*TOGGLE COMMANDS*\n` +
                    `  ${config.BOT_PREFIX}autoviewstatus on|off\n` +
                    `  ${config.BOT_PREFIX}autoreactstatus on|off\n\n` +
                    `◈ ${config.CHANNEL_NAME}`,
                contextInfo: channelCtx(),
            },
            { quoted: ctx.m }
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  .autotyping  —  toggle "typing…" presence on incoming msgs
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'autotyping',
    aliases: ['autotype'],
    desc: 'Toggle auto typing presence on/off',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const arg = ctx.args[0]?.toLowerCase();
        const current = global.autoPresenceFlags.typing ?? config.AUTO_TYPING;
        const next    = arg === 'on'  ? true
                      : arg === 'off' ? false
                      : !current;
        global.autoPresenceFlags.typing = next;

        await ctx.sock.sendMessage(
            ctx.from,
            {
                text:
                    `*AUTO TYPING*\n${config.BOT_NAME}\n\n` +
                    `Status  ·  *${next ? 'ON' : 'OFF'}*\n\n` +
                    `◈ ${config.CHANNEL_NAME}`,
                contextInfo: channelCtx(),
            },
            { quoted: ctx.m }
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  .autorecording  —  toggle "recording…" presence on incoming msgs
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'autorecording',
    aliases: ['autorecord'],
    desc: 'Toggle auto recording presence on/off',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const arg = ctx.args[0]?.toLowerCase();
        const current = global.autoPresenceFlags.recording ?? config.AUTO_RECORDING;
        const next    = arg === 'on'  ? true
                      : arg === 'off' ? false
                      : !current;
        global.autoPresenceFlags.recording = next;

        await ctx.sock.sendMessage(
            ctx.from,
            {
                text:
                    `*AUTO RECORDING*\n${config.BOT_NAME}\n\n` +
                    `Status  ·  *${next ? 'ON' : 'OFF'}*\n\n` +
                    `◈ ${config.CHANNEL_NAME}`,
                contextInfo: channelCtx(),
            },
            { quoted: ctx.m }
        );
    },
});
