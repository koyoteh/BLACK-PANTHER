'use strict';
// ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
//  🐾  BLACK PANTHER MD  —  downloader.js
//  ⬇️  TikTok · Facebook · Instagram · Twitter/X · YouTube
//  API: GuruTech API (api.gurutech.top)
// ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

const { addCmd }     = require('../../guru/handlers/loader');
const axios          = require('axios');
const config         = require('../../guru/config/settings');
const { channelCtx, sendButtons } = require('../../guru/utils/gmdFunctions2');
const { guruApi }    = require('../../guru/utils/guruApi');

// ━━ TikTok ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
            let vid = null, authorName = 'Unknown', titleText = '';

            // Primary: GuruTech API
            try {
                const data = await guruApi('tiktok-dl', { url });
                vid        = data?.video || data?.play || data?.nowm || data?.data?.play;
                authorName = data?.author || data?.data?.author?.nickname || 'Unknown';
                titleText  = (data?.title || data?.data?.title || '').slice(0, 100);
            } catch {}

            // Fallback: tiklydown
            if (!vid) {
                try {
                    const res  = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { timeout: 15000, headers: { 'User-Agent': 'BlackPantherMD/2.0' } });
                    vid        = res.data?.video?.noWatermark || res.data?.video?.watermark;
                    authorName = res.data?.author?.name || 'Unknown';
                    titleText  = (res.data?.title || '').slice(0, 100);
                } catch {}
            }

            // Fallback: tikwm
            if (!vid) {
                try {
                    const res  = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, { timeout: 15000, headers: { 'User-Agent': 'BlackPantherMD/2.0' } });
                    vid        = res.data?.data?.play || res.data?.data?.wmplay;
                    authorName = res.data?.data?.author?.nickname || 'Unknown';
                    titleText  = (res.data?.data?.title || '').slice(0, 100);
                } catch {}
            }

            if (!vid) return ctx.sock.sendMessage(ctx.from, { text: '❌ Could not extract video. Try another link or use a direct TikTok URL.', contextInfo: channelCtx() }, { quoted: ctx.m });

            await sendButtons(ctx.sock, ctx.from, {
                title:  '🎵 TikTok Download',
                text:   `👤 *Author:* ${authorName}\n` + (titleText ? `📝 *Caption:* ${titleText.slice(0, 120)}` : ''),
                footer: `© ${config.BOT_NAME} ${new Date().getFullYear()}`,
                buttons: [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🔗 Open Source', url }) },
                    { id: `${config.BOT_PREFIX}tiktok ${url}`, text: '⬇️ Download Again' },
                ],
            }, { quoted: ctx.m }).catch(() => {});
            await ctx.send({ video: { url: vid }, caption: `🎵 *TikTok Download*\n👤 *Author:* ${authorName}\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            await ctx.react('✅');
        } catch (err) {
            console.error('[TIKTOK]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ TikTok download failed. The link may have expired.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ━━ Facebook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
            let vid = null;

            // Primary: GuruTech API
            try {
                const data = await guruApi('facebook-dl', { url });
                vid = data?.hd || data?.sd || data?.video || data?.data?.hd || data?.data?.sd;
            } catch {}

            // Fallback: lolhuman
            if (!vid) {
                try {
                    const res = await axios.get(`https://api.lolhuman.xyz/api/fbdl?apikey=free&url=${encodeURIComponent(url)}`, { timeout: 15000 });
                    vid = res.data?.result?.hd || res.data?.result?.sd;
                } catch {}
            }

            if (!vid) return ctx.sock.sendMessage(ctx.from, { text: '❌ Could not download. Make sure the video is public.', contextInfo: channelCtx() }, { quoted: ctx.m });

            await sendButtons(ctx.sock, ctx.from, {
                title:  '📘 Facebook Download',
                text:   `🔗 Source: ${url.slice(0, 80)}`,
                footer: `© ${config.BOT_NAME} ${new Date().getFullYear()}`,
                buttons: [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🔗 Open Source', url }) },
                    { id: `${config.BOT_PREFIX}facebook ${url}`, text: '⬇️ Download Again' },
                ],
            }, { quoted: ctx.m }).catch(() => {});
            await ctx.send({ video: { url: vid }, caption: `📘 *Facebook Download*\n\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            await ctx.react('✅');
        } catch (err) {
            console.error('[FACEBOOK]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Facebook download failed. Make sure the post is public.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ━━ Instagram ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
            let mediaUrl = null, mediaType = 'video';

            // Primary: GuruTech API
            try {
                const data = await guruApi('instagram-dl', { url });
                const items = data?.medias || data?.data || (data?.url ? [data] : null);
                if (items && items.length > 0) {
                    mediaUrl  = items[0]?.url || items[0]?.src;
                    mediaType = items[0]?.type === 'image' ? 'image' : 'video';
                }
            } catch {}

            // Fallback: lolhuman
            if (!mediaUrl) {
                try {
                    const res = await axios.get(`https://api.lolhuman.xyz/api/igdl?apikey=free&url=${encodeURIComponent(url)}`, { timeout: 15000 });
                    const item = res.data?.result?.[0];
                    if (item) { mediaUrl = item.url; mediaType = item.type || 'video'; }
                } catch {}
            }

            if (!mediaUrl) return ctx.sock.sendMessage(ctx.from, { text: '❌ Could not download. The post must be public.', contextInfo: channelCtx() }, { quoted: ctx.m });

            await sendButtons(ctx.sock, ctx.from, {
                title:  '📸 Instagram Download',
                text:   `🔗 Source: ${url.slice(0, 80)}`,
                footer: `© ${config.BOT_NAME} ${new Date().getFullYear()}`,
                buttons: [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🔗 Open Source', url }) },
                    { id: `${config.BOT_PREFIX}instagram ${url}`, text: '⬇️ Download Again' },
                ],
            }, { quoted: ctx.m }).catch(() => {});
            if (mediaType === 'image') {
                await ctx.send({ image: { url: mediaUrl }, caption: `📷 *Instagram Download*\n\n_${config.BOT_NAME}_` });
            } else {
                await ctx.send({ video: { url: mediaUrl }, caption: `📸 *Instagram Download*\n\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            }
            await ctx.react('✅');
        } catch (err) {
            console.error('[INSTAGRAM]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Instagram download failed. Make sure it\'s a public post.');
        }
    },
});

// ━━ Twitter / X ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

            // Primary: GuruTech API
            try {
                const data = await guruApi('twitter-dl', { url });
                vid = data?.hd || data?.sd || data?.video || data?.data?.hd || data?.data?.sd;
            } catch {}

            // Fallback: lolhuman
            if (!vid) {
                try {
                    const res = await axios.get(`https://api.lolhuman.xyz/api/twitterdl?apikey=free&url=${encodeURIComponent(url)}`, { timeout: 15000 });
                    vid = res.data?.result?.hd || res.data?.result?.sd;
                } catch {}
            }

            if (!vid) return ctx.reply('❌ Could not extract video. Make sure it\'s a public tweet with video.');

            await sendButtons(ctx.sock, ctx.from, {
                title:  '🐦 Twitter/X Download',
                text:   `🔗 Source: ${url.slice(0, 80)}`,
                footer: `© ${config.BOT_NAME} ${new Date().getFullYear()}`,
                buttons: [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🔗 Open Tweet', url }) },
                    { id: `${config.BOT_PREFIX}twitter ${url}`, text: '⬇️ Download Again' },
                ],
            }, { quoted: ctx.m }).catch(() => {});
            await ctx.send({ video: { url: vid }, caption: `🐦 *Twitter Download*\n\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            await ctx.react('✅');
        } catch (err) {
            console.error('[TWITTER]', err.message);
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ Twitter download failed.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ━━ Snapchat ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'snapchat',
    aliases: ['snap', 'snapdl'],
    desc: 'Download Snapchat video/story',
    usage: 'snapchat <url>',
    category: 'downloader',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || !url.includes('snapchat'))
            return ctx.reply('❌ Provide a valid Snapchat URL.\n\nExample: `.snapchat https://www.snapchat.com/...`');
        await ctx.react('⏳');
        try {
            const data = await guruApi('snapchat-dl', { url });
            const vid  = data?.video || data?.url || data?.data?.video;
            if (!vid) return ctx.reply('❌ Could not download. Make sure it\'s a public Snapchat link.');
            await ctx.send({ video: { url: vid }, caption: `👻 *Snapchat Download*\n\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            await ctx.react('✅');
        } catch (err) {
            console.error('[SNAPCHAT]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Snapchat download failed.');
        }
    },
});

// ━━ Pinterest ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'pinterest',
    aliases: ['pin', 'pindl'],
    desc: 'Download Pinterest video/image',
    usage: 'pinterest <url>',
    category: 'downloader',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || !url.includes('pin'))
            return ctx.reply('❌ Provide a valid Pinterest URL.\n\nExample: `.pinterest https://pin.it/xxxxx`');
        await ctx.react('⏳');
        try {
            const data = await guruApi('pinterest-dl', { url });
            const vid  = data?.video || data?.url || data?.data?.video;
            const img  = data?.image || data?.data?.image;
            if (!vid && !img) return ctx.reply('❌ Could not download. Make sure it\'s a public Pinterest pin.');
            if (vid) {
                await ctx.send({ video: { url: vid }, caption: `📌 *Pinterest Download*\n\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            } else {
                await ctx.send({ image: { url: img }, caption: `📌 *Pinterest Download*\n\n_${config.BOT_NAME}_` });
            }
            await ctx.react('✅');
        } catch (err) {
            console.error('[PINTEREST]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Pinterest download failed.');
        }
    },
});

// ━━ Threads ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'threads',
    aliases: ['threadsdl'],
    desc: 'Download Threads video/image',
    usage: 'threads <url>',
    category: 'downloader',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || !url.includes('threads'))
            return ctx.reply('❌ Provide a valid Threads URL.\n\nExample: `.threads https://www.threads.net/...`');
        await ctx.react('⏳');
        try {
            const data = await guruApi('threads-dl', { url });
            const vid  = data?.video || data?.url || data?.data?.video;
            const img  = data?.image || data?.data?.image;
            if (!vid && !img) return ctx.reply('❌ Could not download. Make sure it\'s a public Threads post.');
            if (vid) {
                await ctx.send({ video: { url: vid }, caption: `🧵 *Threads Download*\n\n_${config.BOT_NAME}_`, mimetype: 'video/mp4' });
            } else {
                await ctx.send({ image: { url: img }, caption: `🧵 *Threads Download*\n\n_${config.BOT_NAME}_` });
            }
            await ctx.react('✅');
        } catch (err) {
            console.error('[THREADS]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Threads download failed.');
        }
    },
});

// ━━ Mediafire ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'mediafire',
    aliases: ['mf', 'mfdl'],
    desc: 'Download file from Mediafire',
    usage: 'mediafire <url>',
    category: 'downloader',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || !url.includes('mediafire'))
            return ctx.reply('❌ Provide a valid Mediafire URL.\n\nExample: `.mediafire https://www.mediafire.com/file/...`');
        await ctx.react('⏳');
        try {
            const data     = await guruApi('mediafire-dl', { url });
            const fileUrl  = data?.download || data?.url || data?.data?.download;
            const fileName = data?.filename || data?.name || 'file';
            const fileSize = data?.size || data?.data?.size || '';
            if (!fileUrl) return ctx.reply('❌ Could not get download link. Make sure it\'s a valid public Mediafire file.');
            await sendButtons(ctx.sock, ctx.from, {
                title:  '🗄️ Mediafire Download',
                text:   `📁 *File:* ${fileName}\n💾 *Size:* ${fileSize}`,
                footer: `© ${config.BOT_NAME} ${new Date().getFullYear()}`,
                buttons: [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '⬇️ Download File', url: fileUrl }) },
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🔗 Source', url }) },
                ],
            }, { quoted: ctx.m }).catch(() => ctx.reply(`📁 *${fileName}*\n💾 ${fileSize}\n\n🔗 ${fileUrl}`));
            await ctx.react('✅');
        } catch (err) {
            console.error('[MEDIAFIRE]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Mediafire download failed.');
        }
    },
});
