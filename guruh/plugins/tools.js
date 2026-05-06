'use strict';
const { addCmd }    = require('../../guru/handlers/loader');
const axios         = require('axios');
const config        = require('../../guru/config/settings');
const { getTime, getDate } = require('../../guru/utils/helpers');

// ── Sticker ───────────────────────────────────────────────────
addCmd({
    name: 'sticker',
    aliases: ['s', 'stiker'],
    desc: 'Convert image/video to sticker',
    category: 'media',
    handler: async (ctx) => {
        const quoted = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasMedia = quoted?.imageMessage || quoted?.videoMessage ||
                         ctx.m.message?.imageMessage || ctx.m.message?.videoMessage;

        if (!hasMedia) return ctx.sock.sendMessage(ctx.from, { text: '❌ Reply to an *image* or *video* to convert it to a sticker.', contextInfo: channelCtx() }, { quoted: ctx.m });

        await ctx.react('⏳');
        try {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const StickerMessage = require('wa-sticker-formatter');

            const buf  = await downloadMediaMessage(ctx.m, 'buffer', {}).catch(() => null);
            if (!buf)  return ctx.sock.sendMessage(ctx.from, { text: '❌ Failed to download media.', contextInfo: channelCtx() }, { quoted: ctx.m });

            const sticker = new StickerMessage(buf, {
                pack:   config.PACK_NAME,
                author: config.PACK_AUTHOR,
                type:   'default',
                categories: ['🤩', '🎉'],
                id:     '12345',
                quality: 50,
            });

            const result = await sticker.toMessage();
            await ctx.send(result);
            await ctx.react('✅');
        } catch (err) {
            console.error('[STICKER]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Failed to create sticker. Make sure the file is under 1MB.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Translate ──────────────────────────────────────────────────
addCmd({
    name: 'translate',
    aliases: ['tr', 'tl'],
    desc: 'Translate text to another language',
    usage: 'translate <lang> <text>',
    category: 'tools',
    handler: async (ctx) => {
        const lang = ctx.args[0];
        const text = ctx.args.slice(1).join(' ') ||
                     ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;

        if (!lang || !text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Usage: `.translate en Hello in Spanish`', contextInfo: channelCtx() }, { quoted: ctx.m });

        try {
            const { translate } = require('@vitalets/google-translate-api');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
            const res = await translate(text, { to: lang });
            await ctx.sock.sendMessage(ctx.from, { text: `🌐 *Translation* (→ ${lang})\n\n${res.text}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Translation failed. Check the language code (e.g. `en`, `es`, `fr`, `sw`).', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Wikipedia ─────────────────────────────────────────────────
addCmd({
    name: 'wiki',
    aliases: ['wikipedia'],
    desc: 'Search Wikipedia',
    usage: 'wiki <query>',
    category: 'tools',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a search term.\n\nExample: `.wiki Nairobi`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('🔍');
        try {
            const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ctx.text)}`;
            const res = await axios.get(url);
            const d   = res.data;
            const text =
                `📖 *${d.title}*\n\n` +
                `${d.extract?.slice(0, 900)}...\n\n` +
                `🔗 ${d.content_urls?.desktop?.page || ''}`;
            await ctx.reply(text);
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ No results found.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Time ──────────────────────────────────────────────────────
addCmd({
    name: 'time',
    desc: 'Show current date and time',
    category: 'tools',
    handler: async (ctx) => {
        await ctx.reply(
            `🕐 *Current Time*\n\n` +
            `📅 Date : ${getDate('dddd, DD MMMM YYYY')}\n` +
            `⏰ Time : ${getTime('hh:mm:ss A')}\n` +
            `🌍 Zone : ${config.TIME_ZONE}`
        );
    },
});

// ── Calculate ─────────────────────────────────────────────────
addCmd({
    name: 'calc',
    aliases: ['calculate', 'math'],
    desc: 'Evaluate a math expression',
    usage: 'calc <expression>',
    category: 'tools',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a math expression.\n\nExample: `.calc 25 * 4 + 10`', contextInfo: channelCtx() }, { quoted: ctx.m });
        try {
            const result = Function(`"use strict"; return (${ctx.text})`)();
            await ctx.reply(`🧮 *Calculator*\n\n📥 Input : \`${ctx.text}\`\n📤 Result: *${result}*`);
        } catch {
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Invalid expression.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Qrcode ────────────────────────────────────────────────────
addCmd({
    name: 'qr',
    aliases: ['qrcode'],
    desc: 'Generate a QR code from text',
    usage: 'qr <text>',
    category: 'tools',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide text to encode.\n\nExample: `.qr https://example.com`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('⏳');
        try {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ctx.text)}`;
            await ctx.send({ image: { url }, caption: `🔳 *QR Code*\n\n${ctx.text}\n\n_${config.BOT_NAME}_` });
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Failed to generate QR code.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Upload to Catbox (tourl) ──────────────────────────────────
addCmd({
    name: 'tourl',
    aliases: ['upload', 'mediaurl'],
    desc: 'Upload replied media to catbox.moe and return a public URL.',
    usage: 'tourl  (reply to image/video/audio/document)',
    category: 'tools',
    handler: async (ctx) => {
        const FormData                 = require('form-data');
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');

        const quoted = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let rawMsg, msgType;
        const types = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
        for (const t of types) {
            if (ctx.m.message?.[t]) { rawMsg = ctx.m; msgType = t; break; }
            if (quoted?.[t])        {                  msgType = t; break; }
        }
        if (!msgType) return ctx.reply('❌ Reply to an *image, video, audio, document* or *sticker* to upload.');

        await ctx.react('⏳');
        try {
            let buf;
            if (rawMsg) {
                buf = await downloadMediaMessage(rawMsg, 'buffer', {});
            } else {
                const fakeMsg = {
                    message: quoted,
                    key:     ctx.m.message.extendedTextMessage.contextInfo,
                };
                buf = await downloadMediaMessage(fakeMsg, 'buffer', {});
            }
            if (!buf) throw new Error('Could not download media');

            // Catbox 200 MB cap
            if (buf.length > 200 * 1024 * 1024) throw new Error('File too large (max 200 MB).');

            const FileType = require('file-type');
            const ft = await FileType.fromBuffer(buf).catch(() => null);
            const ext = ft?.ext || 'bin';

            const form = new FormData();
            form.append('reqtype',      'fileupload');
            form.append('fileToUpload', buf, `upload.${ext}`);

            const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
                headers: form.getHeaders(),
                timeout: 60_000,
                maxBodyLength: Infinity,
            });

            const url = String(data).trim();
            if (!/^https?:\/\//.test(url)) throw new Error(`Upload failed: ${url}`);

            await ctx.reply(
                `*📤 Upload Complete*\n\n` +
                `🔗 ${url}\n` +
                `📦 Size: ${(buf.length / 1024 / 1024).toFixed(2)} MB\n` +
                `🗂️  Type: ${ft?.mime || 'unknown'}`
            );
            await ctx.react('✅');
        } catch (err) {
            await ctx.react('❌');
            await ctx.reply(`❌ Upload failed: ${err.message}`);
        }
    },
});
