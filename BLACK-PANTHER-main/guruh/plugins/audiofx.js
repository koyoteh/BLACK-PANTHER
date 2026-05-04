'use strict';
// ╭─────────────────────────────────────────╮
//   BLACK PANTHER MD  ·  audiofx.js
//   FFmpeg audio effects (ported from Vesper)
// ╰─────────────────────────────────────────╯

const { addCmd }               = require('../../guru/handlers/loader');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const ffmpeg                   = require('fluent-ffmpeg');
const ffmpegPath               = require('ffmpeg-static');
const fs                       = require('fs-extra');
const path                     = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const TEMP = path.join(__dirname, '../../temp');
fs.ensureDirSync(TEMP);

// Pull a quoted audio/video buffer
async function downloadAudio(ctx) {
    const quoted = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let rawMsg, msgType;
    for (const t of ['audioMessage', 'videoMessage']) {
        if (ctx.m.message?.[t])  { rawMsg = ctx.m;   msgType = t; break; }
        if (quoted?.[t])         {                   msgType = t; break; }
    }
    if (!msgType) return null;
    if (quoted && !rawMsg) {
        const fakeMsg = {
            message: quoted,
            key:     ctx.m.message.extendedTextMessage.contextInfo,
        };
        return downloadMediaMessage(fakeMsg, 'buffer', {}).catch(() => null);
    }
    return downloadMediaMessage(rawMsg, 'buffer', {}).catch(() => null);
}

// Apply a raw `-af` filter and return processed mp3 buffer
function applyFilter(inputPath, outputPath, filter) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioFilters(filter)
            .audioCodec('libmp3lame')
            .audioBitrate('128k')
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });
}

// Effect registry — name, aliases, ffmpeg filter
const EFFECTS = [
    { name: 'bass',       filter: 'equalizer=f=54:width_type=o:width=2:g=20',                desc: 'Bass-boost an audio file.' },
    { name: 'blown',      filter: 'atempo=4/4,asetrate=44500*2/3',                           desc: 'Blown / lo-fi effect.' },
    { name: 'volaudio',   aliases: ['volume'],   filter: 'volume=2.0',                       desc: 'Boost volume 2×.' },
    { name: 'treble',     filter: 'equalizer=f=10000:width_type=o:width=2:g=15',             desc: 'Treble-boost an audio file.' },
    { name: 'fast',       filter: 'atempo=1.5',                                              desc: 'Speed audio up 1.5×.' },
    { name: 'slow',       filter: 'atempo=0.8',                                              desc: 'Slow audio down to 0.8×.' },
    { name: 'reverse',    filter: 'areverse',                                                desc: 'Play audio in reverse.' },
    { name: 'echo',       filter: 'aecho=0.8:0.9:1000:0.3',                                  desc: 'Add echo to audio.' },
    { name: 'robot',      filter: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75", desc: 'Robotic voice effect.' },
    { name: 'deep',       filter: 'asetrate=44100*0.7,aresample=44100',                      desc: 'Deep / pitched-down voice.' },
    { name: 'chipmunk',   filter: 'asetrate=44100*1.5,aresample=44100',                      desc: 'Chipmunk / pitched-up voice.' },
    { name: 'nightcore',  filter: 'atempo=1.06,asetrate=44100*1.25',                         desc: 'Nightcore remix effect.' },
];

for (const fx of EFFECTS) {
    addCmd({
        name:     fx.name,
        aliases:  fx.aliases || [],
        desc:     fx.desc,
        usage:    `${fx.name}  (reply to an audio)`,
        category: 'audio',
        handler:  async (ctx) => {
            const buf = await downloadAudio(ctx);
            if (!buf) return ctx.reply(`❌ Reply to an *audio* file with *${ctx.config.BOT_PREFIX}${fx.name}*.`);

            await ctx.react('⏳');
            const inp = path.join(TEMP, `fx_${Date.now()}_in`);
            const out = path.join(TEMP, `fx_${Date.now()}_out.mp3`);
            try {
                await fs.writeFile(inp, buf);
                await applyFilter(inp, out, fx.filter);
                const audio = await fs.readFile(out);
                await ctx.send(
                    { audio, mimetype: 'audio/mpeg' },
                    { quoted: ctx.m }
                );
                await ctx.react('✅');
            } catch (err) {
                await ctx.reply(`❌ ${fx.name} failed: ${err.message}`);
            } finally {
                await fs.remove(inp).catch(() => {});
                await fs.remove(out).catch(() => {});
            }
        },
    });
}
