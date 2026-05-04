'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  play.js
//  🎵  .play · .ytmp3 · .ytmp4 · .ytsearch · .spotify · .tts · .shorten
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd } = require('../../guru/handlers/loader');
const axios      = require('axios');
const yts        = require('yt-search');
const config     = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

// ── HTTP helper ────────────────────────────────────────────────
async function getJson(url, opts = {}) {
    const res = await axios.get(url, {
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0 (BlackPantherMD/2.0)' },
        ...opts,
    });
    return res.data;
}

function fmtSecs(secs) {
    if (!secs || isNaN(secs)) return '?';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════
//  PARSE DOWNLOAD URL FROM ANY API RESPONSE
// ══════════════════════════════════════════════════════════════
function parseDownloadUrl(data) {
    if (!data) return null;
    // apiskeith.top style
    if (data.status === true && data.result && typeof data.result === 'string')
        return data.result;
    if (data.download_url)          return data.download_url;
    if (data.result?.download_url)  return data.result.download_url;
    if (data.result?.url)           return data.result.url;
    if (data.url)                   return data.url;
    if (data.link)                  return data.link;
    if (data.data?.url)             return data.data.url;
    if (data.audio)                 return data.audio;
    return null;
}

// ══════════════════════════════════════════════════════════════
//  QUERY API — waterfall through endpoint list
// ══════════════════════════════════════════════════════════════
async function queryAPI(videoUrl, endpoints, timeout = 20000) {
    // Run all endpoints in parallel — first valid result wins (no waiting for slow ones)
    return new Promise((resolve) => {
        let settled = false;
        let pending = endpoints.length;
        if (!pending) return resolve(null);

        for (const endpoint of endpoints) {
            axios.get(endpoint, { timeout })
                .then(res => {
                    const url = parseDownloadUrl(res.data);
                    if (url?.startsWith('http') && !settled) {
                        settled = true;
                        console.log(`✅ Fast-hit: ${endpoint}`);
                        resolve(url);
                    }
                })
                .catch(() => {})
                .finally(() => {
                    pending--;
                    if (pending === 0 && !settled) resolve(null);
                });
        }
    });
}

// ══════════════════════════════════════════════════════════════
//  YOUTUBE SEARCH  — yt-search (primary) + API fallbacks
// ══════════════════════════════════════════════════════════════
async function ytSearch(query) {
    // 1. yt-search npm package (no API key needed)
    try {
        const res  = await yts(query);
        const item = res?.videos?.[0];
        if (item) {
            return {
                title:    item.title || query,
                url:      item.url,
                channel:  item.author?.name || '',
                duration: item.timestamp || fmtSecs(item.seconds),
                views:    (item.views || 0).toLocaleString(),
                thumb:    item.thumbnail || item.image || '',
            };
        }
    } catch {}

    // 2. Invidious fallback
    try {
        const data = await getJson(
            `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=1`
        );
        const item = data?.[0];
        if (item) {
            return {
                title:    item.title || query,
                url:      `https://youtu.be/${item.videoId}`,
                channel:  item.author || '',
                duration: fmtSecs(item.lengthSeconds),
                views:    (item.viewCount || 0).toLocaleString(),
                thumb:    `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
            };
        }
    } catch {}

    // 3. Pipedapi fallback
    try {
        const data = await getJson(
            `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`
        );
        const item = data?.items?.[0];
        if (item) {
            const id = (item.url || '').replace('/watch?v=', '').split('&')[0];
            return {
                title:    item.title || query,
                url:      `https://youtu.be/${id}`,
                channel:  item.uploaderName || '',
                duration: fmtSecs(item.duration),
                views:    (item.views || 0).toLocaleString(),
                thumb:    item.thumbnail || '',
            };
        }
    } catch {}

    return null;
}

// ══════════════════════════════════════════════════════════════
//  YOUTUBE AUDIO DOWNLOAD
//  Primary: apiskeith.top  |  Fallbacks from ULTRA-GURU repo
// ══════════════════════════════════════════════════════════════
async function ytAudio(videoUrl) {
    const enc = encodeURIComponent(videoUrl);
    const endpoints = [
        `https://apiskeith.top/download/audio?url=${enc}`,
        `https://wadownloader.amitdas.site/api/yt?url=${enc}`,
        `https://silva-md-bot.onrender.com/api/download?url=${enc}`,
        `https://api-xeon.tech/api/download/ytmp3?url=${enc}`,
        `https://api.vreden.my.id/api/ytmp3?url=${enc}`,
        `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${enc}`,
        `https://yt-api.p.rapidapi.com/dl?id=${enc}`,
        `https://ytdl.freelancerpriyesh.workers.dev/?url=${enc}&type=audio`,
        `https://y2down.cc/api/audio?url=${enc}`,
        `https://loader.to/api/button/?url=${enc}&f=mp3`,
    ];
    return queryAPI(videoUrl, endpoints, 20000);
}

// ══════════════════════════════════════════════════════════════
//  YOUTUBE VIDEO DOWNLOAD
//  Primary: apiskeith.top  |  Fallbacks from ULTRA-GURU repo
// ══════════════════════════════════════════════════════════════
async function ytVideo(videoUrl) {
    const enc = encodeURIComponent(videoUrl);
    const endpoints = [
        `https://apiskeith.top/download/video?url=${enc}`,
        `https://wadownloader.amitdas.site/api/yt?url=${enc}&type=video`,
        `https://silva-md-bot.onrender.com/api/download?url=${enc}`,
        `https://api-xeon.tech/api/download/ytmp4?url=${enc}`,
        `https://api.vreden.my.id/api/ytmp4?url=${enc}`,
        `https://ytdl.freelancerpriyesh.workers.dev/?url=${enc}&type=video`,
        `https://y2down.cc/api/video?url=${enc}`,
    ];
    return queryAPI(videoUrl, endpoints, 20000);
}

// ═══════════════════════════════════════════════════════════════
//  🎵  PLAY
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'play',
    aliases: ['music', 'song', 'ytplay'],
    desc: 'Search and play a YouTube song as audio',
    usage: 'play <song name or YouTube URL>',
    category: 'music',
    handler: async (ctx) => {
        if (!ctx.text)
            return ctx.reply(`❌ Provide a song name or YouTube URL.\n\nExample: \`${config.BOT_PREFIX}play Shape of You\``);

        await ctx.react('🎵');

        try {
            let videoUrl = ctx.text;
            let title    = ctx.text;
            let channel  = '';
            let duration = '?';
            let thumb    = '';

            const isUrl = /youtu(be\.com|\.be)/i.test(ctx.text);

            if (!isUrl) {
                await ctx.react('🔍');
                const result = await ytSearch(ctx.text);
                if (!result) {
                    const fallback = await searchFallback(ctx.text);
                    if (!fallback) {
                        return ctx.reply(
                            `❌ No results found for: *${ctx.text}*\n\n` +
                            `💡 Try a longer song title or paste a YouTube URL directly.`
                        );
                    }
                    videoUrl = fallback.url || videoUrl;
                    title = fallback.title || title;
                    channel = fallback.channel || channel;
                    duration = fallback.duration || duration;
                    thumb = fallback.thumb || thumb;
                } else {
                    videoUrl = result.url;
                    title    = result.title;
                    channel  = result.channel;
                    duration = result.duration;
                    thumb    = result.thumb;
                }
            }

            await ctx.react('⏳');

            const audioUrl = await ytAudio(videoUrl);

            if (!audioUrl) {
                return ctx.reply(
                    `🎵 *${title}*\n` +
                    (channel ? `👤 ${channel}\n` : '') +
                    `⏱️ ${duration}\n\n` +
                    `🔗 ${videoUrl}\n\n` +
                    `⚠️ _Download servers are busy. Open the link to listen._\n\n` +
                    `_${config.BOT_NAME}_`
                );
            }

            // Send thumbnail + info first if we have one
            if (thumb) {
                await ctx.send({
                    image:   { url: thumb },
                    caption: `🎵 *${title}*\n` +
                             (channel ? `👤 *Channel:* ${channel}\n` : '') +
                             `⏱️ *Duration:* ${duration}\n` +
                             `🔗 ${videoUrl}\n\n_${config.BOT_NAME}_`,
                }).catch(() => {});
            }

            await ctx.send({
                audio:    { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName: `${title.slice(0, 60)}.mp3`,
                ptt:      false,
            });

            await ctx.react('✅');
        } catch (err) {
            console.error('[PLAY]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: `❌ Playback failed: ${err.message}\n\nTry a different song or paste the YouTube URL directly.`, contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  🔍  YTSEARCH
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'ytsearch',
    aliases: ['yts', 'ytsrc'],
    desc: 'Search YouTube and show top results',
    usage: 'ytsearch <query>',
    category: 'music',
    handler: async (ctx) => {
        if (!ctx.text)
            return ctx.reply(`❌ Provide a search term.\n\nExample: \`${config.BOT_PREFIX}ytsearch Afrobeats 2025\``);

        await ctx.react('🔍');

        try {
            let items = [];

            try {
                const data = await getJson(
                    `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(ctx.text)}&filter=videos`
                );
                items = (data?.items || []).slice(0, 6).map(item => ({
                    title:    item.title,
                    url:      `https://youtu.be/${(item.url || '').replace('/watch?v=', '').split('&')[0]}`,
                    channel:  item.uploaderName || '',
                    duration: fmtSecs(item.duration),
                    views:    (item.views || 0).toLocaleString(),
                }));
            } catch {}

            if (!items.length) {
                try {
                    const data = await getJson(
                        `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(ctx.text)}&type=video`
                    );
                    items = (data || []).slice(0, 6).map(item => ({
                        title:    item.title,
                        url:      `https://youtu.be/${item.videoId}`,
                        channel:  item.author || '',
                        duration: fmtSecs(item.lengthSeconds),
                        views:    (item.viewCount || 0).toLocaleString(),
                    }));
                } catch {}
            }

            if (!items.length)
                return ctx.sock.sendMessage(ctx.from, { text: '❌ No results found. Try a different search term.', contextInfo: channelCtx() }, { quoted: ctx.m });

            let text = `🔍 *YouTube Results for:* _${ctx.text}_\n${'─'.repeat(30)}\n\n`;

            items.forEach((item, i) => {
                text += `*${i + 1}.* ${item.title}\n`;
                text += `   ⏱️ ${item.duration}  👁️ ${item.views}\n`;
                if (item.channel) text += `   👤 ${item.channel}\n`;
                text += `   🔗 ${item.url}\n\n`;
            });

            text += `💡 _Use ${config.BOT_PREFIX}play <title> to download any song_\n_${config.BOT_NAME}_`;

            await ctx.reply(text);
            await ctx.react('✅');
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Search failed. Try again shortly.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  ⬇️  YTMP3
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'ytmp3',
    aliases: ['yta', 'ytaudio'],
    desc: 'Download YouTube audio (MP3) by URL',
    usage: 'ytmp3 <YouTube URL>',
    category: 'music',
    handler: async (ctx) => {
        if (!ctx.text)
            return ctx.reply(`❌ Provide a YouTube URL.\n\nExample: \`${config.BOT_PREFIX}ytmp3 https://youtu.be/xxxxx\`\n\n💡 _Use ${config.BOT_PREFIX}play to search by name._`);
        if (!/youtu/i.test(ctx.text))
            return ctx.sock.sendMessage(ctx.from, { text: `❌ Please provide a valid YouTube URL.\n\n💡 _Use ${config.BOT_PREFIX}play <song name> to search._`, contextInfo: channelCtx() }, { quoted: ctx.m });

        await ctx.react('⏳');
        try {
            const audioUrl = await ytAudio(ctx.text);
            if (!audioUrl) return ctx.sock.sendMessage(ctx.from, { text: `🎵 *YouTube Audio*\n\n🔗 ${ctx.text}\n\n⚠️ _Download unavailable right now. Try ${config.BOT_PREFIX}play instead._`, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.send({ audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: 'audio.mp3', ptt: false });
            await ctx.react('✅');
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Download failed. Try a direct YouTube URL.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  🎬  YTMP4
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'ytmp4',
    aliases: ['ytv', 'ytvideo'],
    desc: 'Download YouTube video (MP4)',
    usage: 'ytmp4 <YouTube URL>',
    category: 'music',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply(`❌ Provide a YouTube URL.\n\nExample: \`${config.BOT_PREFIX}ytmp4 https://youtu.be/xxxxx\``);
        if (!/youtu/i.test(ctx.text)) return ctx.sock.sendMessage(ctx.from, { text: '❌ Please provide a valid YouTube URL.', contextInfo: channelCtx() }, { quoted: ctx.m });

        await ctx.react('⏳');
        try {
            const videoUrl = await ytVideo(ctx.text);
            if (!videoUrl) return ctx.sock.sendMessage(ctx.from, { text: `🎬 *YouTube Video*\n\n🔗 ${ctx.text}\n\n⚠️ _Video unavailable. The video may be geo-restricted or too large._`, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.send({ video: { url: videoUrl }, caption: `🎬 *YouTube Video*\n\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            await ctx.react('✅');
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Download failed. The video may be too large or geo-restricted.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  🎧  SPOTIFY (Deezer)
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'spotify',
    aliases: ['deezer', 'musicsearch', 'findsong'],
    desc: 'Search for a song with full track info',
    usage: 'spotify <song name>',
    category: 'music',
    handler: async (ctx) => {
        if (!ctx.text)
            return ctx.reply(`❌ Provide a song name.\n\nExample: \`${config.BOT_PREFIX}spotify Blinding Lights\``);

        await ctx.react('🎧');
        try {
            const data   = await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(ctx.text)}&limit=5`);
            const tracks = data?.data;
            if (!tracks?.length) return ctx.sock.sendMessage(ctx.from, { text: '❌ No tracks found. Try a different song name.', contextInfo: channelCtx() }, { quoted: ctx.m });

            const t        = tracks[0];
            const duration = `${Math.floor(t.duration / 60)}:${String(t.duration % 60).padStart(2, '0')}`;

            let reply =
                `🎵 *${t.title}*\n${'─'.repeat(30)}\n` +
                `👤 *Artist  :* ${t.artist?.name}\n` +
                `💿 *Album   :* ${t.album?.title}\n` +
                `⏱️ *Duration:* ${duration}\n\n`;

            if (tracks.length > 1) {
                reply += `🔎 *More results:*\n`;
                tracks.slice(1).forEach((r, i) => { reply += `  ${i + 2}. ${r.title} — ${r.artist?.name}\n`; });
                reply += '\n';
            }
            reply += `🔗 ${t.link}\n\n_Use ${config.BOT_PREFIX}play ${t.title} to download_\n_${config.BOT_NAME}_`;

            if (t.album?.cover_medium) {
                await ctx.send({ image: { url: t.album.cover_medium }, caption: reply });
            } else {
                await ctx.reply(reply);
            }
            await ctx.react('✅');
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Music search failed. Try again.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  🔊  TTS
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'tts',
    aliases: ['speak', 'voice', 'texttospeech'],
    desc: 'Convert text to a voice note',
    usage: 'tts [lang] <text>  — e.g. tts sw Habari yako',
    category: 'music',
    handler: async (ctx) => {
        if (!ctx.text)
            return ctx.reply(
                `❌ Provide text to convert.\n\n` +
                `*Usage:* \`${config.BOT_PREFIX}tts <text>\`\n` +
                `*With language:* \`${config.BOT_PREFIX}tts sw Habari yako\`\n\n` +
                `_Supported: en, sw, fr, es, ar, zh, hi, pt, de, it_`
            );

        const LANGS = ['en','sw','fr','es','ar','zh','hi','pt','de','it','ru','ja','ko','tr','pl'];
        let lang = 'en';
        let text = ctx.text;

        if (LANGS.includes(ctx.args[0]?.toLowerCase())) {
            lang = ctx.args[0].toLowerCase();
            text = ctx.args.slice(1).join(' ');
        }

        if (!text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide the text to speak after the language code.', contextInfo: channelCtx() }, { quoted: ctx.m });
        if (text.length > 200) return ctx.sock.sendMessage(ctx.from, { text: '❌ Text too long. Maximum is 200 characters.', contextInfo: channelCtx() }, { quoted: ctx.m });

        await ctx.react('🔊');
        try {
            const ttsUrl =
                `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}` +
                `&client=tw-ob&q=${encodeURIComponent(text)}`;

            const res = await axios.get(ttsUrl, {
                responseType: 'arraybuffer',
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
                    'Referer': 'https://translate.google.com/',
                },
            });

            await ctx.send({ audio: Buffer.from(res.data), mimetype: 'audio/mpeg', ptt: true, fileName: 'tts.mp3' });
            await ctx.react('✅');
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ TTS failed. Try a shorter text or different language.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  🔗  SHORTEN
// ═══════════════════════════════════════════════════════════════
addCmd({
    name: 'shorten',
    aliases: ['short', 'shorturl', 'tinyurl'],
    desc: 'Shorten a long URL',
    usage: 'shorten <url>',
    category: 'tools',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || !url.startsWith('http'))
            return ctx.reply(`❌ Provide a valid URL starting with http.\n\nExample: \`${config.BOT_PREFIX}shorten https://example.com/very/long/path\``);

        await ctx.react('🔗');
        try {
            const res = await axios.get(
                `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`,
                { timeout: 10000 }
            );
            const short = res.data?.trim();
            if (!short?.startsWith('http')) throw new Error('Bad response');

            await ctx.reply(
                `🔗 *URL Shortened!*\n\n` +
                `📎 *Original:* ${url.slice(0, 60)}${url.length > 60 ? '...' : ''}\n\n` +
                `✨ *Short:* ${short}\n\n_${config.BOT_NAME}_`
            );
            await ctx.react('✅');
        } catch {
            try {
                const res2 = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000 });
                const short2 = res2.data?.trim();
                if (short2?.startsWith('http')) {
                    await ctx.sock.sendMessage(ctx.from, { text: `🔗 *URL Shortened!*\n\n✨ *Short:* ${short2}\n\n_${config.BOT_NAME}_`, contextInfo: channelCtx() }, { quoted: ctx.m });
                    await ctx.react('✅');
                    return;
                }
            } catch {}
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Could not shorten URL. Try again later.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});
