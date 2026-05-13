'use strict';
const { addCmd } = require('../../guru/handlers/loader');
const axios      = require('axios');
const config     = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
const { sendButtons } = require('../../guru/utils/gmdFunctions2');

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

        const btns = [
            { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: '📋 Copy JID', copy_code: target }) },
            { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Number', copy_code: `+${number}` }) },
        ];
        if (ppUrl !== 'None') {
            btns.push({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🖼️ View Profile Pic', url: ppUrl }) });
        }
        await sendButtons(ctx.sock, ctx.from, {
            title:  '👤 User Info',
            text,
            footer: config.BOT_NAME,
            buttons: btns,
        }, { quoted: ctx.m }).catch(() => ctx.reply(text));
    },
});

// ── Repo ─────────────────────────────────────────────────────
addCmd({
    name: 'repo',
    aliases: ['github', 'source', 'code'],
    desc: 'Show bot GitHub repo stats with links',
    category: 'general',
    handler: async (ctx) => {
        const REPO_OWNER  = 'koyoteh';
        const REPO_NAME   = 'BLACK-PANTHER';
        const REPO_URL    = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
        const FORK_URL    = `${REPO_URL}/fork`;
        const ZIP_URL     = `${REPO_URL}/archive/refs/heads/main.zip`;
        const SESSION_URL = 'https://pantherr-session.onrender.com';
        const THUMB       = 'https://i.ibb.co/PZjVDnBM/upload-1778637749645-4b17ed31-jpg.jpg';

        await ctx.react('🐙');

        let stars = '—', forks = '—', owner = REPO_OWNER;
        let releaseDate = '—', lastUpdate = '—';

        try {
            const res  = await axios.get(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
                { timeout: 8000, headers: { 'User-Agent': 'BlackPantherMD/2.0' } }
            );
            const d    = res.data;
            stars      = (d.stargazers_count  || 0).toLocaleString();
            forks      = (d.forks_count        || 0).toLocaleString();
            owner      = d.owner?.login        || REPO_OWNER;
            lastUpdate = d.updated_at
                ? new Date(d.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';
            releaseDate = d.created_at
                ? new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';
        } catch {}

        const text =
            `Hello @${ctx.sender.split('@')[0]} 👋\n` +
            `This is *${config.BOT_NAME}*\n` +
            `The best bot in the universe 🌍\n` +
            `Fork and give a star ⭐ to my repo\n\n` +
            `${'─'.repeat(28)}\n` +
            `✦ *Stars:*        ${stars}\n` +
            `✦ *Forks:*        ${forks}\n` +
            `✦ *Release Date:* ${releaseDate}\n` +
            `✦ *Last Update:*  ${lastUpdate}\n` +
            `✦ *Owner:*        ${owner}\n` +
            `${'─'.repeat(28)}\n\n` +
            `🔗 ${SESSION_URL}`;

        await sendButtons(ctx.sock, ctx.from, {
            title:  `🐾 ${config.BOT_NAME}`,
            text,
            footer: config.BOT_NAME,
            image:  { url: THUMB },
            buttons: [
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🔗 Visit Repository',
                        url:          REPO_URL,
                        merchant_url: REPO_URL,
                    }),
                },
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🍴 Fork Repository',
                        url:          FORK_URL,
                        merchant_url: FORK_URL,
                    }),
                },
                {
                    name: 'cta_copy',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📋 Copy Session URL',
                        copy_code:    SESSION_URL,
                    }),
                },
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📦 Download Zip',
                        url:          ZIP_URL,
                        merchant_url: ZIP_URL,
                    }),
                },
            ],
        }, { quoted: ctx.m }).catch(async () => {
            await ctx.sock.sendMessage(
                ctx.from,
                { image: { url: THUMB }, caption: text, contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        });

        await ctx.react('✅');
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
