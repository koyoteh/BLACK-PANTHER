'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  texttools.js
//  ✏️  Font styles · Text transformers · Encode/Decode
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd } = require('../../guru/handlers/loader');
const { toBold, toItalic, toSmallCaps, toFlip, toMock, toReverse } = require('../../guru/utils/gmdFunctions3');
const { gmdBanner, gmdList } = require('../../guru/utils/gmdFunctions');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

// ── Font showcase ─────────────────────────────────────────────
addCmd({
    name: 'font',
    aliases: ['style', 'fancy'],
    desc: 'Apply a fancy font style to text',
    usage: 'font <style> <text> — styles: bold, italic, smallcaps, flip, mock, reverse',
    category: 'tools',
    handler: async (ctx) => {
        const style = ctx.args[0]?.toLowerCase();
        const text  = ctx.args.slice(1).join(' ');

        const styles = { bold: toBold, italic: toItalic, smallcaps: toSmallCaps, flip: toFlip, mock: toMock, reverse: toReverse };

        if (!style || !text) {
            const sample = 'Black Panther MD';
            return ctx.reply(
                `✏️ *Font Styles*\n${'─'.repeat(30)}\n\n` +
                `◈ *bold*      → ${toBold(sample)}\n` +
                `◈ *italic*    → ${toItalic(sample)}\n` +
                `◈ *smallcaps* → ${toSmallCaps(sample)}\n` +
                `◈ *flip*      → ${toFlip(sample)}\n` +
                `◈ *mock*      → ${toMock(sample)}\n` +
                `◈ *reverse*   → ${toReverse(sample)}\n\n` +
                `*Usage:* \`.font bold Your text here\``
            );
        }

        const fn = styles[style];
        if (!fn) return ctx.reply(
            `❌ Unknown style *${style}*.\n\n` +
            `Valid: bold, italic, smallcaps, flip, mock, reverse`
        );
        await ctx.sock.sendMessage(ctx.from, { text: `✏️ *${style}*\n\n${fn(text)}`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── All fonts at once ─────────────────────────────────────────
addCmd({
    name: 'fonts',
    aliases: ['allfont', 'allstyles'],
    desc: 'Show all font styles for a given text',
    usage: 'fonts <text>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text;
        if (!text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide text.\n\n*Example:* `.fonts GuruTech`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.reply(
            `✨ *All Font Styles*\n${'═'.repeat(30)}\n\n` +
            `🔠 *Bold*\n${toBold(text)}\n\n` +
            `🔡 *Italic*\n${toItalic(text)}\n\n` +
            `🅰️ *Small Caps*\n${toSmallCaps(text)}\n\n` +
            `🙃 *Flip*\n${toFlip(text)}\n\n` +
            `🤪 *Mock*\n${toMock(text)}\n\n` +
            `🔄 *Reverse*\n${toReverse(text)}\n\n` +
            `_Powered by ${require('../../guru/config/settings').BOT_NAME}_`
        );
    },
});

// ── Text encode/decode ─────────────────────────────────────────
addCmd({
    name: 'encode',
    aliases: ['b64encode'],
    desc: 'Encode text to Base64',
    usage: 'encode <text>',
    category: 'tools',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide text to encode.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const encoded = Buffer.from(ctx.text).toString('base64');
        await ctx.reply(`🔐 *Base64 Encoded*\n\n\`${encoded}\``);
    },
});

addCmd({
    name: 'decode',
    aliases: ['b64decode'],
    desc: 'Decode Base64 text',
    usage: 'decode <base64>',
    category: 'tools',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide Base64 text to decode.', contextInfo: channelCtx() }, { quoted: ctx.m });
        try {
            const decoded = Buffer.from(ctx.text.trim(), 'base64').toString('utf-8');
            await ctx.sock.sendMessage(ctx.from, { text: `🔓 *Base64 Decoded*\n\n${decoded}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Invalid Base64 string.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Character count ───────────────────────────────────────────
addCmd({
    name: 'charcount',
    aliases: ['count', 'wc'],
    desc: 'Count characters, words and lines',
    usage: 'charcount <text>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text ||
            ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
        if (!text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide text or reply to a message.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const chars  = text.length;
        const words  = text.trim().split(/\s+/).length;
        const lines  = text.split('\n').length;
        const unique = new Set(text.toLowerCase().replace(/\s/g, '')).size;
        await ctx.reply(
            `📊 *Text Analysis*\n${'─'.repeat(30)}\n\n` +
            `📝 *Characters :* ${chars}\n` +
            `💬 *Words      :* ${words}\n` +
            `📄 *Lines      :* ${lines}\n` +
            `🔤 *Unique Chars:* ${unique}`
        );
    },
});

// ── Repeat text ───────────────────────────────────────────────
addCmd({
    name: 'repeat',
    aliases: ['spam'],
    desc: 'Repeat text N times',
    usage: 'repeat <n> <text>',
    category: 'tools',
    handler: async (ctx) => {
        const n    = parseInt(ctx.args[0]);
        const text = ctx.args.slice(1).join(' ');
        if (!n || !text || n < 1 || n > 20)
            return ctx.sock.sendMessage(ctx.from, { text: '❌ Usage: `.repeat 5 Hello`  (max 20 times)', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.reply(Array(n).fill(text).join('\n'));
    },
});

// ── ASCII Art (simple) ────────────────────────────────────────
addCmd({
    name: 'ascii',
    aliases: ['art'],
    desc: 'Convert short text to big ASCII letters',
    usage: 'ascii <text>',
    category: 'tools',
    handler: async (ctx) => {
        const text = (ctx.text || '').toUpperCase().slice(0, 8);
        if (!text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide text.\n\n*Example:* `.ascii GURU`', contextInfo: channelCtx() }, { quoted: ctx.m });
        // Simple block letters using unicode fullwidth
        const wide = text.split('').map(c =>
            c === ' ' ? '　' :
            c >= 'A' && c <= 'Z' ? String.fromCharCode(0xFF21 + c.charCodeAt(0) - 65) :
            c >= '0' && c <= '9' ? String.fromCharCode(0xFF10 + c.charCodeAt(0) - 48) : c
        ).join('');
        await ctx.sock.sendMessage(ctx.from, { text: `🔤 *ASCII*\n\n${wide}`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});
