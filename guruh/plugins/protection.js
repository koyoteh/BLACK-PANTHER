'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  Protection & Privacy Plugin
//  Features:
//    • Anti-Mention  — blocks mass @mentions by non-admins
//    • Anti-ViewOnce — re-sends view-once media for all to see
//    • Anti-Sticker  — removes stickers sent by non-admins
//    • Anti-Foreign  — removes foreign numbers on join (group.js)
//    • Freeze Last Seen — hides bot's last seen
//    • Ghost Mode    — full privacy lock (last seen, photo, status)
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd, addTrigger } = require('../../guru/handlers/loader');
const { getGroupSettings, setGroupSetting, getSetting, setSetting } = require('../../guru/db/database');
const config = require('../../guru/config/settings');

// ═══════════════════════════════════════════════════════════════
//  ANTI-MENTION
//  Deletes messages that mass-mention 5+ members (non-admins)
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'antimention',
    aliases: ['antitag'],
    desc: 'Block mass-mentions by non-admins (5+ tags = delete)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const current = getGroupSettings(ctx.from).antimention;
        const newVal  = !current;
        setGroupSetting(ctx.from, 'antimention', newVal);
        await ctx.reply(
            newVal
                ? '🔕 *Anti-Mention ON*\n\nMass-mentions (5+ tags) by non-admins will be deleted automatically.'
                : '🔔 *Anti-Mention OFF*\n\nMass-mention protection has been disabled.'
        );
    },
});

addTrigger({
    pattern: /.*/,
    handler: async (ctx) => {
        if (!ctx.isGroup) return;
        const settings = getGroupSettings(ctx.from);
        if (!settings.antimention) return;
        if (ctx.isAdmin || ctx.isOwner || ctx.m.fromMe) return;

        const mentionedJids =
            ctx.m.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
            ctx.m.message?.contextInfo?.mentionedJid || [];

        if (mentionedJids.length < 5) return;

        await ctx.deleteMsg().catch(() => {});
        await ctx.send({
            text:
                `🔕 *Anti-Mention*\n\n` +
                `@${ctx.sender.split('@')[0]} you cannot mass-tag members!\n\n` +
                `_${config.BOT_NAME}_`,
            mentions: [ctx.sender],
        }).catch(() => {});
    },
});

// ═══════════════════════════════════════════════════════════════
//  ANTI-VIEWONCE
//  Re-sends view-once photos/videos so everyone in the group sees them
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'antiviewonce',
    aliases: ['antiview', 'avo'],
    desc: 'Re-send view-once media so all members can see it',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const current = getGroupSettings(ctx.from).antiviewonce;
        const newVal  = !current;
        setGroupSetting(ctx.from, 'antiviewonce', newVal);
        await ctx.reply(
            newVal
                ? '👁️ *Anti-ViewOnce ON*\n\nView-once media will be re-sent for everyone to see.'
                : '👁️ *Anti-ViewOnce OFF*\n\nView-once media will stay private.'
        );
    },
});

addTrigger({
    pattern: /.*/,
    handler: async (ctx) => {
        if (!ctx.isGroup) return;
        const settings = getGroupSettings(ctx.from);
        if (!settings.antiviewonce) return;
        if (ctx.m.fromMe) return;

        const raw = ctx.m.message;
        const inner =
            raw?.viewOnceMessage?.message ||
            raw?.viewOnceMessageV2?.message ||
            raw?.viewOnceMessageV2Extension?.message;
        if (!inner) return;

        const caption =
            inner.imageMessage?.caption ||
            inner.videoMessage?.caption || '';

        await ctx.sock.sendMessage(ctx.from, {
            forward: { ...ctx.m, message: inner },
        }, { quoted: ctx.m }).catch(async () => {
            await ctx.reply(
                `👁️ *Anti-ViewOnce*\n\n` +
                `@${ctx.sender.split('@')[0]} sent a view-once media.\n` +
                (caption ? `_Caption: ${caption}_` : '') +
                `\n\n_${config.BOT_NAME}_`
            ).catch(() => {});
        });
    },
});

// ═══════════════════════════════════════════════════════════════
//  ANTI-STICKER
//  Deletes sticker messages sent by non-admins
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'antisticker',
    aliases: ['nosticker'],
    desc: 'Delete stickers sent by non-admins in the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const current = getGroupSettings(ctx.from).antisticker;
        const newVal  = !current;
        setGroupSetting(ctx.from, 'antisticker', newVal);
        await ctx.reply(
            newVal
                ? '🚫 *Anti-Sticker ON*\n\nStickers from non-admins will be deleted.'
                : '✅ *Anti-Sticker OFF*\n\nSticker restriction has been disabled.'
        );
    },
});

addTrigger({
    pattern: /.*/,
    handler: async (ctx) => {
        if (!ctx.isGroup) return;
        const settings = getGroupSettings(ctx.from);
        if (!settings.antisticker) return;
        if (ctx.isAdmin || ctx.isOwner || ctx.m.fromMe) return;
        if (!ctx.m.message?.stickerMessage) return;

        await ctx.deleteMsg().catch(() => {});
        await ctx.send({
            text:
                `🚫 *Anti-Sticker*\n\n` +
                `@${ctx.sender.split('@')[0]} stickers are not allowed in this group!\n\n` +
                `_${config.BOT_NAME}_`,
            mentions: [ctx.sender],
        }).catch(() => {});
    },
});

// ═══════════════════════════════════════════════════════════════
//  ANTI-FOREIGN
//  Toggle command — enforcement happens in lib/handlers/group.js
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'antiforeign',
    aliases: ['noforeign'],
    desc: 'Auto-remove members with foreign phone numbers when they join',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin) return ctx.reply('❌ I need to be an *admin* to remove members.');
        const current = getGroupSettings(ctx.from).antiforeign;
        const newVal  = !current;
        setGroupSetting(ctx.from, 'antiforeign', newVal);
        await ctx.reply(
            newVal
                ? '🌍 *Anti-Foreign ON*\n\nForeign numbers will be removed automatically when they join.'
                : '🌍 *Anti-Foreign OFF*\n\nForeign number restriction has been disabled.'
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  FREEZE LAST SEEN
//  Hides the bot's last seen from everyone
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'freezelastseen',
    aliases: ['freezels', 'fls'],
    desc: "Freeze / unfreeze the bot's last seen",
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const current = getSetting('FREEZE_LAST_SEEN', 'false') === 'true';
        const newVal  = !current;
        setSetting('FREEZE_LAST_SEEN', String(newVal));

        if (newVal) {
            await ctx.sock.updateLastSeenPrivacy('none').catch(() => {});
            await ctx.sock.updateOnlinePrivacy('match_last_seen').catch(() => {});
            await ctx.reply(
                `❄️ *Last Seen Frozen!*\n\n` +
                `The bot's last seen is now hidden from everyone.\n\n` +
                `_Use .freezelastseen again to unfreeze._`
            );
        } else {
            await ctx.sock.updateLastSeenPrivacy('contacts').catch(() => {});
            await ctx.reply(
                `✅ *Last Seen Unfrozen!*\n\n` +
                `The bot's last seen is now visible to contacts.`
            );
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  GHOST MODE
//  Full privacy lock: last seen + profile photo + status all hidden
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'ghostmode',
    aliases: ['ghost'],
    desc: 'Toggle full ghost mode (hide last seen, photo & status)',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const current = getSetting('GHOST_MODE', 'false') === 'true';
        const newVal  = !current;
        setSetting('GHOST_MODE', String(newVal));

        if (newVal) {
            await Promise.all([
                ctx.sock.updateLastSeenPrivacy('none'),
                ctx.sock.updateOnlinePrivacy('match_last_seen'),
                ctx.sock.updateProfilePicturePrivacy('none'),
                ctx.sock.updateStatusPrivacy('none'),
            ]).catch(() => {});
            await ctx.reply(
                `👻 *Ghost Mode ON!*\n\n` +
                `• Last Seen  » Hidden\n` +
                `• Profile Photo » Hidden\n` +
                `• Status  » Hidden\n\n` +
                `_Use .ghostmode again to turn off._`
            );
        } else {
            await Promise.all([
                ctx.sock.updateLastSeenPrivacy('contacts'),
                ctx.sock.updateProfilePicturePrivacy('contacts'),
                ctx.sock.updateStatusPrivacy('contacts'),
            ]).catch(() => {});
            await ctx.reply(
                `✅ *Ghost Mode OFF!*\n\n` +
                `Privacy settings restored to contacts-only.`
            );
        }
    },
});


// ═══════════════════════════════════════════════════════════════
//  ANTI-DELETE  —  command to toggle anti-delete on/off
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'antidelete',
    aliases: ['antidel', 'adel'],
    desc: 'Toggle anti-delete — recover deleted messages',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const { getGroupSettings, setGroupSetting } = require('../../guru/db/database');
        const { channelCtx } = require('../../guru/utils/gmdFunctions2');
        const current = getGroupSettings(ctx.from).antidelete;
        const newVal  = !current;
        setGroupSetting(ctx.from, 'antidelete', newVal);

        await ctx.sock.sendMessage(
            ctx.from,
            {
                text: newVal
                    ? `*ANTI-DELETE ON*\n${ctx.config.BOT_NAME}\n\nDeleted messages will be recovered and shown to everyone.\n\n◈ ${ctx.config.CHANNEL_NAME}`
                    : `*ANTI-DELETE OFF*\n${ctx.config.BOT_NAME}\n\nMessage recovery has been disabled.\n\n◈ ${ctx.config.CHANNEL_NAME}`,
                contextInfo: channelCtx(),
            },
            { quoted: ctx.m }
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  ANTI-EDIT  —  command to toggle anti-edit detection
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'antiedit',
    aliases: ['antied'],
    desc: 'Toggle anti-edit — log original message before edits',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const { getGroupSettings, setGroupSetting } = require('../../guru/db/database');
        const { channelCtx } = require('../../guru/utils/gmdFunctions2');
        const current = getGroupSettings(ctx.from).antidelete; // shared flag
        const newVal  = !current;
        setGroupSetting(ctx.from, 'antidelete', newVal);

        await ctx.sock.sendMessage(
            ctx.from,
            {
                text: newVal
                    ? `*ANTI-EDIT ON*\n${ctx.config.BOT_NAME}\n\nOriginal messages will be shown when someone edits.\n\n◈ ${ctx.config.CHANNEL_NAME}`
                    : `*ANTI-EDIT OFF*\n${ctx.config.BOT_NAME}\n\nEdit detection has been disabled.\n\n◈ ${ctx.config.CHANNEL_NAME}`,
                contextInfo: channelCtx(),
            },
            { quoted: ctx.m }
        );
    },
});
