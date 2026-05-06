'use strict';
const { addCmd } = require('../../guru/handlers/loader');
const axios      = require('axios');
const config     = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

// ── Profile picture ───────────────────────────────────────────
addCmd({
    name: 'pp',
    aliases: ['profilepic', 'pfp'],
    desc: 'Get a user\'s profile picture',
    category: 'general',
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant
            || (ctx.args[0] ? ctx.args[0].replace(/\D/g, '') + '@s.whatsapp.net' : ctx.sender);

        try {
            const url = await ctx.sock.profilePictureUrl(target, 'image');
            await ctx.send({
                image:   { url },
                caption: `🖼️ *Profile Picture*\n👤 @${target.split('@')[0]}\n\n_${config.BOT_NAME}_`,
                mentions: [target],
            });
        } catch {
            await ctx.reply('❌ No profile picture found or it\'s private.');
        }
    },
});

// ── Vcard / contact ───────────────────────────────────────────
addCmd({
    name: 'vcard',
    aliases: ['contact'],
    desc: 'Send someone\'s contact card',
    usage: 'vcard <number>',
    category: 'general',
    handler: async (ctx) => {
        const number = ctx.args[0]?.replace(/\D/g, '');
        if (!number) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a phone number.\n\nExample: `.vcard 254712345678`', contextInfo: channelCtx() }, { quoted: ctx.m });
        const jid  = number + '@s.whatsapp.net';
        const name = ctx.args.slice(1).join(' ') || number;
        const vcard =
            `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`;
        await ctx.send({ contacts: { displayName: name, contacts: [{ vcard }] } });
    },
});

// ── Whois ────────────────────────────────────────────────────
addCmd({
    name: 'whois',
    aliases: ['userinfo', 'user'],
    desc: 'Get info about a user',
    category: 'general',
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant || ctx.sender;
        const number = target.split('@')[0];
        let ppUrl = 'None';
        try { ppUrl = await ctx.sock.profilePictureUrl(target, 'image'); } catch {}

        const text =
            `👤 *User Info*\n\n` +
            `📛 *Name   :* ${ctx.pushName}\n` +
            `📞 *Number :* +${number}\n` +
            `🆔 *JID    :* ${target}\n` +
            `👑 *Admin  :* ${ctx.isAdmin ? 'Yes' : 'No'}\n` +
            `🤖 *Owner  :* ${ctx.isOwner ? 'Yes' : 'No'}\n` +
            `🖼️ *PP     :* ${ppUrl !== 'None' ? '✅ Has picture' : '❌ No picture'}\n\n` +
            `_${config.BOT_NAME}_`;
        await ctx.reply(text);
    },
});

// ── Mention ───────────────────────────────────────────────────
addCmd({
    name: 'mention',
    aliases: ['tag'],
    desc: 'Mention a user with a custom message',
    usage: 'mention @user <message>',
    category: 'general',
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return ctx.reply('❌ Reply to a user\'s message.');
        const msg = ctx.text || 'Hey!';
        await ctx.send({
            text:     `👋 @${target.split('@')[0]}, ${msg}`,
            mentions: [target],
        });
    },
});
