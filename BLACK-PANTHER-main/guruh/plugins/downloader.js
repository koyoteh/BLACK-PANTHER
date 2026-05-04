'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  downloader.js
//  ⬇️  TikTok · Facebook · Instagram · Twitter/X
//  (YouTube downloads moved to play.js)
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd } = require('../../guru/handlers/loader');
const axios      = require('axios');
const config     = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

async function fetchJson(url) {
    const res = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'BlackPantherMD/1.0' },
    });
    return res.data;
}

// ── TikTok ────────────────────────────────────────────────────
addCmd({
    name: 'tiktok',
    aliases: ['tt', 'tiktokdl'],
    desc: 'Download TikTok video (no watermark)',
    usage: 'tiktok <url>',
    category: 'downloader',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || !url.includes('tiktok'))
            return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a valid TikTok URL.\n\nExample: `.tiktok https://vm.tiktok.com/xxxxx`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('⏳');
        try {
            // Primary: tiklydown API
            let vid = null;
            let authorName = 'Unknown';
            let titleText  = '';

            try {
                const data = await fetchJson(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`);
                vid        = data?.video?.noWatermark || data?.video?.watermark;
                authorName = data?.author?.name || 'Unknown';
                titleText  = data?.title?.slice(0, 100) || '';
            } catch {}

            // Fallback: Musicaldown
            if (!vid) {
                try {
                    const data = await fetchJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
                    vid        = data?.data?.play || data?.data?.wmplay;
                    authorName = data?.data?.author?.nickname || 'Unknown';
                    titleText  = data?.data?.title?.slice(0, 100) || '';
                } catch {}
            }

            if (!vid) return ctx.sock.sendMessage(ctx.from, { text: '❌ Could not extract video. Try another link or use a direct TikTok URL.', contextInfo: channelCtx() }, { quoted: ctx.m });

            await ctx.send({
                video:    { url: vid },
                caption:
                    `🎵 *TikTok Download*\n\n` +
                    `👤 *Author :* ${authorName}\n` +
                    (titleText ? `📝 *Caption:* ${titleText}\n` : '') +
                    `\n_${config.BOT_NAME}_`,
                mimetype: 'video/mp4',
            });
            await ctx.react('✅');
        } catch (err) {
            console.error('[TIKTOK]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ TikTok download failed. The link may have expired.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Facebook ──────────────────────────────────────────────────
addCmd({
    name: 'facebook',
    aliases: ['fb', 'fbdl'],
    desc: 'Download Facebook video',
    usage: 'facebook <url>',
    category: 'downloader',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || (!url.includes('facebook') && !url.includes('fb.')))
            return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a valid Facebook video URL.\n\nExample: `.facebook https://fb.watch/xxxxx`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('⏳');
        try {
            // Try fdownloader API
            let vid = null;
            try {
                const data = await fetchJson(`https://api.lolhuman.xyz/api/fbdl?apikey=free&url=${encodeURIComponent(url)}`);
                vid = data?.result?.hd || data?.result?.sd;
            } catch {}

            // Fallback: getfvid
            if (!vid) {
                try {
                    const data = await fetchJson(`https://getfvid.com/downloader?url=${encodeURIComponent(url)}`);
                    vid = data?.link || null;
                } catch {}
            }

            if (!vid) return ctx.sock.sendMessage(ctx.from, { text: '❌ Could not download. Make sure the video is public.', contextInfo: channelCtx() }, { quoted: ctx.m });

            await ctx.send({
                video:    { url: vid },
                caption:  `📘 *Facebook Download*\n\n_${config.BOT_NAME}_`,
                mimetype: 'video/mp4',
            });
            await ctx.react('✅');
        } catch (err) {
            console.error('[FACEBOOK]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Facebook download failed. Make sure the post is public.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Instagram ─────────────────────────────────────────────────
addCmd({
    name: 'instagram',
    aliases: ['ig', 'igdl', 'insta'],
    desc: 'Download Instagram photo/video/reel',
    usage: 'instagram <url>',
    category: 'downloader',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || !url.includes('instagram'))
            return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a valid Instagram URL.\n\nExample: `.instagram https://www.instagram.com/p/xxxxx`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('⏳');
        try {
            let media = null;

            // Primary: lolhuman
            try {
                const data  = await fetchJson(`https://api.lolhuman.xyz/api/igdl?apikey=free&url=${encodeURIComponent(url)}`);
                media = data?.result?.[0];
            } catch {}

            // Fallback: snapinsta
            if (!media) {
                try {
                    const data = await fetchJson(`https://api.instadp.com/download?url=${encodeURIComponent(url)}`);
                    if (data?.url) media = { url: data.url, type: 'video' };
                } catch {}
            }

            if (!media) return ctx.sock.sendMessage(ctx.from, { text: '❌ Could not download. The post must be public.', contextInfo: channelCtx() }, { quoted: ctx.m });

            const type = media.type || 'video';
            if (type === 'image') {
                await ctx.send({ image: { url: media.url }, caption: `📷 *Instagram Download*\n\n_${config.BOT_NAME}_` });
            } else {
                await ctx.send({ video: { url: media.url }, caption: `📸 *Instagram Download*\n\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            }
            await ctx.react('✅');
        } catch (err) {
            console.error('[INSTAGRAM]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Instagram download failed. Make sure it\'s a public post.');
        }
    },
});

// ── Twitter / X ───────────────────────────────────────────────
addCmd({
    name: 'twitter',
    aliases: ['twdl', 'xdl', 'x'],
    desc: 'Download Twitter/X video',
    usage: 'twitter <url>',
    category: 'downloader',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || (!url.includes('twitter') && !url.includes('x.com')))
            return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a valid Twitter/X URL.\n\nExample: `.twitter https://x.com/user/status/xxxxx`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('⏳');
        try {
            let vid = null;

            // Primary
            try {
                const data = await fetchJson(`https://api.lolhuman.xyz/api/twitterdl?apikey=free&url=${encodeURIComponent(url)}`);
                vid = data?.result?.hd || data?.result?.sd;
            } catch {}

            // Fallback: twitsave
            if (!vid) {
                try {
                    const data = await fetchJson(`https://twitsave.com/info?url=${encodeURIComponent(url)}`);
                    vid = data?.video?.links?.[0]?.url;
                } catch {}
            }

            if (!vid) return ctx.reply('❌ Could not extract video. Make sure it\'s a public tweet with video.');

            await ctx.send({ video: { url: vid }, caption: `🐦 *Twitter Download*\n\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            await ctx.react('✅');
        } catch (err) {
            console.error('[TWITTER]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Twitter download failed.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});
