'use strict';
// ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
//  🐾  BLACK PANTHER MD  —  play.js
//  🎵  .play · .ytmp3 · .ytmp4 · .ytvideo
//  API: GuruTech API (api.gurutech.top)
// ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

const { addCmd }     = require('../../guru/handlers/loader');
const axios          = require('axios');
const config         = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
const { guruApi }    = require('../../guru/utils/guruApi');

const API_TIMEOUT = 30000;

// ━━ Search YouTube ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function ytSearch(query) {
    const data = await guruApi('yt-search', { q: query });
    return data?.results || data?.items || data?.data || [];
}

// ━━ Get YouTube info ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function ytInfo(url) {
    return await guruApi('yt-info', { url });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🎵  PLAY  —  sends audio (mp3) via GuruTech API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name:     'play',
    aliases:  ['ytmp3', 'ytaudio', 'yta', 'music', 'song'],
    desc:     'Download and send a song as audio',
    usage:    'play <song name or YouTube URL>',
    category: 'music',
    handler: async (ctx) => {
        if (!ctx.text)
            return ctx.reply(`❌ *Provide a song name or YouTube link.*\n\nExample: \`${config.BOT_PREFIX}play mambichwa\``);

        await ctx.react('🔍');

        try {
            let videoUrl, videoTitle, videoDuration, videoThumb;

            const isUrl = /youtu(be\.com|\.be)/i.test(ctx.text);

            if (isUrl) {
                videoUrl = ctx.text;
                try {
                    const info  = await ytInfo(videoUrl);
                    videoTitle  = info?.title || ctx.text;
                    videoDuration = info?.duration || '?';
                    videoThumb  = info?.thumbnail || '';
                } catch {
                    videoTitle  = ctx.text;
                    videoDuration = '?';
                    videoThumb  = '';
                }
            } else {
                const results = await ytSearch(ctx.text).catch(() => []);
                if (!results?.length) {
                    await ctx.react('❌');
                    return ctx.sock.sendMessage(ctx.from, {
                        text: `❌ No results found for *${ctx.text}*. Try a different song name.`,
                        contextInfo: channelCtx(),
                    }, { quoted: ctx.m });
                }
                const top     = results[0];
                videoUrl      = top.url  || top.link || `https://youtu.be/${top.id}`;
                videoTitle    = top.title || ctx.text;
                videoDuration = top.duration || top.timestamp || '?';
                videoThumb    = top.thumbnail || top.image || '';
            }

            await ctx.react('⬇️');

            // Download mp3 via GuruTech
            const mp3Data = await guruApi('yt-mp3', { url: videoUrl });
            const mp3Url  = mp3Data?.download || mp3Data?.url || mp3Data?.audio || mp3Data?.data?.download;

            if (!mp3Url) {
                await ctx.react('❌');
                return ctx.sock.sendMessage(ctx.from, {
                    text: `❌ Could not fetch audio for *${videoTitle}*.\nPlease try again later.`,
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            }

            const title     = mp3Data?.title || videoTitle;
            const duration  = mp3Data?.duration || videoDuration;
            const safeTitle = title.replace(/[^\w\s.-]/gi, '');
            const thumb     = mp3Data?.thumbnail || videoThumb;

            // Download buffer
            const audioRes = await axios.get(mp3Url, {
                responseType: 'arraybuffer',
                timeout: API_TIMEOUT,
                headers: { 'User-Agent': 'BlackPantherMD/2.0' },
            });
            const buffer = Buffer.from(audioRes.data);

            if (!buffer || buffer.length < 0x2800) {
                await ctx.react('❌');
                return ctx.sock.sendMessage(ctx.from, {
                    text: '❌ Failed to download audio. Please try again.',
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            }

            // Send info card with thumbnail
            if (thumb) {
                await ctx.sock.sendMessage(ctx.from, {
                    image: { url: thumb },
                    caption: `🎵 *${title}*\n⏱️ *Duration:* ${duration}\n\n_${config.BOT_NAME}_`,
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m }).catch(() => {});
            }

            // Send as playable audio
            await ctx.sock.sendMessage(ctx.from, {
                audio:    buffer,
                mimetype: 'audio/mpeg',
                ptt:      false,
            }, { quoted: ctx.m });

            // Send as downloadable document
            await ctx.sock.sendMessage(ctx.from, {
                document: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${safeTitle}.mp3`,
                caption:  `🎵 *${title}*\n⏱️ *Duration:* ${duration}\n\n_${config.BOT_NAME}_`,
            }, { quoted: ctx.m });

            await ctx.react('✅');

        } catch (err) {
            console.error('[play]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, {
                text: `❌ Something went wrong. Please try again.\n\nError: ${err.message}`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🎬  YTMP4  —  sends video via GuruTech API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name:     'ytmp4',
    aliases:  ['ytvideo', 'ytv', 'ytvid'],
    desc:     'Download and send a YouTube video (mp4)',
    usage:    'ytmp4 <YouTube URL or search query>',
    category: 'music',
    handler: async (ctx) => {
        if (!ctx.text)
            return ctx.reply(`❌ *Provide a YouTube URL or search query.*\n\nExample: \`${config.BOT_PREFIX}ytmp4 https://youtu.be/dQw4w9WgXcQ\``);

        await ctx.react('🔍');

        try {
            let videoUrl, videoTitle, videoDuration, videoThumb;

            const isUrl = /youtu(be\.com|\.be)/i.test(ctx.text);

            if (isUrl) {
                videoUrl = ctx.text;
                try {
                    const info  = await ytInfo(videoUrl);
                    videoTitle  = info?.title || ctx.text;
                    videoDuration = info?.duration || '?';
                    videoThumb  = info?.thumbnail || '';
                } catch {
                    videoTitle = ctx.text;
                    videoDuration = '?';
                    videoThumb = '';
                }
            } else {
                const results = await ytSearch(ctx.text).catch(() => []);
                if (!results?.length) {
                    await ctx.react('❌');
                    return ctx.reply(`❌ No results found for *${ctx.text}*.`);
                }
                const top     = results[0];
                videoUrl      = top.url || top.link || `https://youtu.be/${top.id}`;
                videoTitle    = top.title || ctx.text;
                videoDuration = top.duration || top.timestamp || '?';
                videoThumb    = top.thumbnail || top.image || '';
            }

            await ctx.react('⬇️');

            // Download mp4 via GuruTech
            const mp4Data = await guruApi('yt-mp4', { url: videoUrl });
            const mp4Url  = mp4Data?.download || mp4Data?.url || mp4Data?.video || mp4Data?.data?.download;

            if (!mp4Url) {
                await ctx.react('❌');
                return ctx.reply(`❌ Could not fetch video for *${videoTitle}*.\nPlease try again later.`);
            }

            const title    = mp4Data?.title || videoTitle;
            const duration = mp4Data?.duration || videoDuration;

            await ctx.sock.sendMessage(ctx.from, {
                video:    { url: mp4Url },
                caption:  `🎬 *${title}*\n⏱️ *Duration:* ${duration}\n\n_${config.BOT_NAME}_`,
                mimetype: 'video/mp4',
            }, { quoted: ctx.m });

            await ctx.react('✅');

        } catch (err) {
            console.error('[ytmp4]', err.message);
            await ctx.react('❌');
            await ctx.reply(`❌ Video download failed. Please try again.\n\nError: ${err.message}`);
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔍  YTSEARCH  —  search YouTube
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name:     'ytsearch',
    aliases:  ['yts', 'youtubesearch'],
    desc:     'Search YouTube for videos',
    usage:    'ytsearch <query>',
    category: 'music',
    handler: async (ctx) => {
        if (!ctx.text)
            return ctx.reply(`❌ Provide a search query.\n\nExample: \`${config.BOT_PREFIX}ytsearch lofi beats\``);

        await ctx.react('🔍');

        try {
            const results = await ytSearch(ctx.text);

            if (!results?.length)
                return ctx.reply(`❌ No results found for *${ctx.text}*.`);

            const top5 = results.slice(0, 5);
            let text = `🔍 *YouTube Search: "${ctx.text}"*\n\n`;

            top5.forEach((v, i) => {
                const url      = v.url || v.link || `https://youtu.be/${v.id}`;
                const title    = v.title || 'Unknown';
                const duration = v.duration || v.timestamp || '?';
                const views    = v.views ? `👁 ${v.views}` : '';
                text += `*${i + 1}.* ${title}\n`;
                text += `   ⏱️ ${duration}  ${views}\n`;
                text += `   🔗 ${url}\n\n`;
            });

            text += `_Use \`.play <title>\` or \`.ytmp4 <url>\` to download_\n\n_${config.BOT_NAME}_`;
            await ctx.reply(text);
            await ctx.react('✅');

        } catch (err) {
            console.error('[ytsearch]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ YouTube search failed. Please try again.');
        }
    },
});
