'use strict';
const { addCmd }            = require('../../guru/handlers/loader');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const ffmpeg                = require('fluent-ffmpeg');
const ffmpegPath            = require('ffmpeg-static');
const fs                    = require('fs-extra');
const path                  = require('path');
const Jimp                  = require('jimp');
const config                = require('../../guru/config/settings');

ffmpeg.setFfmpegPath(ffmpegPath);

const TEMP = path.join(__dirname, '../../temp');
fs.ensureDirSync(TEMP);

// ── Helper: download quoted/current media ─────────────────────
async function downloadMedia(ctx, types = ['imageMessage', 'videoMessage', 'audioMessage']) {
    const quoted = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let msgType, rawMsg;

    for (const t of types) {
        if (ctx.m.message?.[t])        { msgType = t; rawMsg = ctx.m; break; }
        if (quoted?.[t])               { msgType = t; break; }
    }
    if (!msgType) return null;

    if (quoted && !rawMsg) {
        const fakeMsg = { message: quoted, key: ctx.m.message.extendedTextMessage.contextInfo };
        return downloadMediaMessage(fakeMsg, 'buffer', {}).catch(() => null);
    }
    return downloadMediaMessage(rawMsg, 'buffer', {}).catch(() => null);
}

// ── ffmpeg wrapper ────────────────────────────────────────────
function ffmpegConvert(inputPath, outputPath, options = []) {
    return new Promise((resolve, reject) => {
        let cmd = ffmpeg(inputPath);
        options.forEach(o => cmd = cmd.outputOptions(o));
        cmd.save(outputPath)
           .on('end', resolve)
           .on('error', reject);
    });
}

// ── To Voice Note (PTT) ───────────────────────────────────────
addCmd({
    name: 'tovoice',
    aliases: ['toptt', 'toaudio', 'tova'],
    desc: 'Convert audio/video to voice note',
    category: 'media',
    handler: async (ctx) => {
        const buf = await downloadMedia(ctx, ['audioMessage', 'videoMessage']);
        if (!buf) return ctx.sock.sendMessage(ctx.from, { text: '❌ Reply to an *audio* or *video* message.', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('⏳');

        const inp = path.join(TEMP, `in_${Date.now()}`);
        const out = path.join(TEMP, `out_${Date.now()}.ogg`);
        try {
            await fs.writeFile(inp, buf);
            await ffmpegConvert(inp, out, ['-c:a libopus', '-b:a 128k', '-vn']);
            const result = await fs.readFile(out);
            await ctx.send({ audio: result, mimetype: 'audio/ogg; codecs=opus', ptt: true });
            await ctx.react('✅');
        } catch (err) {
            console.error('[TOVOICE]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Conversion failed.', contextInfo: channelCtx() }, { quoted: ctx.m });
        } finally {
            fs.remove(inp).catch(() => {});
            fs.remove(out).catch(() => {});
        }
    },
});

// ── To MP3 ────────────────────────────────────────────────────
addCmd({
    name: 'tomp3',
    desc: 'Convert video/voice note to MP3',
    category: 'media',
    handler: async (ctx) => {
        const buf = await downloadMedia(ctx, ['videoMessage', 'audioMessage']);
        if (!buf) return ctx.sock.sendMessage(ctx.from, { text: '❌ Reply to a *video* or *audio* message.', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('⏳');

        const inp = path.join(TEMP, `in_${Date.now()}`);
        const out = path.join(TEMP, `out_${Date.now()}.mp3`);
        try {
            await fs.writeFile(inp, buf);
            await ffmpegConvert(inp, out, ['-q:a 0', '-map a']);
            const result = await fs.readFile(out);
            await ctx.send({ audio: result, mimetype: 'audio/mpeg', fileName: 'audio.mp3' });
            await ctx.react('✅');
        } catch (err) {
            console.error('[TOMP3]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Conversion failed.', contextInfo: channelCtx() }, { quoted: ctx.m });
        } finally {
            fs.remove(inp).catch(() => {});
            fs.remove(out).catch(() => {});
        }
    },
});

// ── Image effects (Jimp) ──────────────────────────────────────
async function applyJimpEffect(ctx, effectName, applyFn) {
    const buf = await downloadMedia(ctx, ['imageMessage']);
    if (!buf) return ctx.sock.sendMessage(ctx.from, { text: '❌ Reply to an *image*.', contextInfo: channelCtx() }, { quoted: ctx.m });
    await ctx.react('⏳');
    const out = path.join(TEMP, `img_${Date.now()}.jpg`);
    try {
        const img = await Jimp.read(buf);
        applyFn(img);
        await img.quality(90).writeAsync(out);
        const result = await fs.readFile(out);
        await ctx.send({ image: result, caption: `✨ *${effectName}*\n\n_${config.BOT_NAME}_` });
        await ctx.react('✅');
    } catch (err) {
        console.error(`[${effectName.toUpperCase()}]`, err.message);
        await ctx.react('❌');
        await ctx.sock.sendMessage(ctx.from, { text: '❌ Effect failed.', contextInfo: channelCtx() }, { quoted: ctx.m });
    } finally {
        fs.remove(out).catch(() => {});
    }
}

addCmd({
    name: 'blur',
    desc: 'Blur an image',
    category: 'media',
    handler: (ctx) => applyJimpEffect(ctx, 'Blur', img => img.blur(10)),
});

addCmd({
    name: 'grayscale',
    aliases: ['grey', 'bw'],
    desc: 'Convert image to grayscale',
    category: 'media',
    handler: (ctx) => applyJimpEffect(ctx, 'Grayscale', img => img.grayscale()),
});

addCmd({
    name: 'invert',
    desc: 'Invert image colors',
    category: 'media',
    handler: (ctx) => applyJimpEffect(ctx, 'Invert', img => img.invert()),
});

addCmd({
    name: 'flip',
    aliases: ['mirror'],
    desc: 'Flip an image horizontally',
    category: 'media',
    handler: (ctx) => applyJimpEffect(ctx, 'Flip', img => img.flip(true, false)),
});

addCmd({
    name: 'rotate',
    aliases: ['spin'],
    desc: 'Rotate an image (default 90°)',
    category: 'media',
    handler: (ctx) => {
        const deg = parseInt(ctx.args[0]) || 90;
        return applyJimpEffect(ctx, `Rotate ${deg}°`, img => img.rotate(deg));
    },
});

addCmd({
    name: 'brightness',
    desc: 'Adjust image brightness (-1 to 1)',
    category: 'media',
    handler: (ctx) => {
        const val = parseFloat(ctx.args[0]);
        if (isNaN(val) || val < -1 || val > 1)
            return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a value between -1 and 1.\n\nExample: `.brightness 0.5`', contextInfo: channelCtx() }, { quoted: ctx.m });
        return applyJimpEffect(ctx, 'Brightness', img => img.brightness(val));
    },
});

addCmd({
    name: 'pixelate',
    desc: 'Pixelate an image',
    category: 'media',
    handler: (ctx) => {
        const size = parseInt(ctx.args[0]) || 8;
        return applyJimpEffect(ctx, 'Pixelate', img => img.pixelate(size));
    },
});

// ── Take screenshot ───────────────────────────────────────────
addCmd({
    name: 'screenshot',
    aliases: ['ss', 'webss'],
    desc: 'Take screenshot of a website',
    usage: 'screenshot <url>',
    category: 'media',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || !url.startsWith('http'))
            return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a valid URL.\n\nExample: `.screenshot https://google.com`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('⏳');
        try {
            const api  = `https://api.lolhuman.xyz/api/ssweb?apikey=free&url=${encodeURIComponent(url)}`;
            const res  = await require('axios').get(api, { responseType: 'arraybuffer' }).catch(() => null);
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
            if (!res?.data) return ctx.sock.sendMessage(ctx.from, { text: '❌ Screenshot failed.', contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.send({
                image:   Buffer.from(res.data),
                caption: `🖥️ *Screenshot*\n🔗 ${url}\n\n_${config.BOT_NAME}_`,
            });
            await ctx.react('✅');
        } catch (err) {
            console.error('[SCREENSHOT]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Could not take screenshot.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});
