'use strict';
// ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
//  🐾  BLACK PANTHER MD  —  gurutech.js
//  🌐  Powered by GuruTech API (api.gurutech.top)
//  📦  Weather · Crypto · Currency · News · QR · Shorten
//       Search · Lyrics · Movie · GitHub · IP · Stalk · TTS
// ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

const { addCmd }     = require('../../guru/handlers/loader');
const config         = require('../../guru/config/settings');
const { channelCtx, sendButtons } = require('../../guru/utils/gmdFunctions2');
const { guruApi }    = require('../../guru/utils/guruApi');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🌤️  WEATHER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'weather',
    aliases: ['climate', 'forecast', 'wx'],
    desc: 'Get weather forecast for any city (GuruTech)',
    usage: 'weather <city>',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply('❌ Provide a city name.\n\nExample: `.weather Nairobi`');
        await ctx.react('🌤️');
        try {
            const d = await guruApi('weather', { city: ctx.text });
            const forecast = (d.forecast || []).map(f =>
                `  📅 ${f.date}: ${f.condition} 🌡️ ${f.max_c}°/${f.min_c}°C`
            ).join('\n');

            const text =
`🌤️ *Weather — ${d.location}, ${d.country}*

🌡️ *Temp:*       ${d.temp_c}°C (${d.temp_f}°F)
🌡️ *Feels Like:* ${d.feels_like_c}°C
☁️ *Condition:*  ${d.condition}
💧 *Humidity:*   ${d.humidity}%
💨 *Wind:*        ${d.wind_kmh} km/h

📆 *3-Day Forecast:*
${forecast || 'Unavailable'}

_${config.BOT_NAME}_`;
            await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[weather]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ City not found or weather service unavailable. Try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ₿  CRYPTO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'crypto',
    aliases: ['coin', 'btc', 'price'],
    desc: 'Get live crypto price (GuruTech)',
    usage: 'crypto <symbol>  e.g. crypto bitcoin',
    category: 'search',
    handler: async (ctx) => {
        const symbol = ctx.args[0] || 'bitcoin';
        await ctx.react('₿');
        try {
            const d     = await guruApi('crypto', { symbol, currency: 'usd' });
            const name  = d.name || symbol;
            const price = d.price || d.current_price || d.usd || '?';
            const change= d.change_24h !== undefined ? `${d.change_24h > 0 ? '📈' : '📉'} ${d.change_24h}%` : '';
            const cap   = d.market_cap ? `$${Number(d.market_cap).toLocaleString()}` : '';
            const vol   = d.volume_24h ? `$${Number(d.volume_24h).toLocaleString()}` : '';

            const text =
`₿ *Crypto Price — ${name}*

💰 *Price:*       $${typeof price === 'number' ? price.toLocaleString() : price}
${change ? `📊 *24h Change:*  ${change}` : ''}
${cap ? `🏛️ *Market Cap:*  ${cap}` : ''}
${vol ? `📦 *24h Volume:*  ${vol}` : ''}

_${config.BOT_NAME}_`;
            await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[crypto]', err.message);
            await ctx.react('❌');
            await ctx.reply(`❌ Could not fetch price for *${symbol}*. Try: bitcoin, ethereum, solana`);
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  💱  CURRENCY CONVERTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'currency',
    aliases: ['convert', 'fx'],
    desc: 'Convert currency (GuruTech)',
    usage: 'currency <amount> <FROM> <TO>  e.g. currency 100 USD KES',
    category: 'search',
    handler: async (ctx) => {
        const [amount, from, to] = ctx.args;
        if (!amount || !from || !to)
            return ctx.reply('❌ Usage: `.currency 100 USD KES`');
        const amt = parseFloat(amount);
        if (isNaN(amt)) return ctx.reply('❌ Amount must be a number.');
        await ctx.react('💱');
        try {
            const d      = await guruApi('currency', { from: from.toUpperCase(), to: to.toUpperCase(), amount: amt });
            const result = d.result || d.converted || d.amount || '?';
            const rate   = d.rate || '';
            await ctx.sock.sendMessage(ctx.from, {
                text: `💱 *Currency Convert*\n\n📥 ${amt} *${from.toUpperCase()}*\n📤 ${result} *${to.toUpperCase()}*${rate ? `\n📊 *Rate:* 1 ${from.toUpperCase()} = ${rate} ${to.toUpperCase()}` : ''}\n\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[currency]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Currency conversion failed. Check currency codes (e.g. USD, KES, EUR).');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📰  NEWS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'news',
    aliases: ['headlines', 'topnews'],
    desc: 'Get latest news headlines (GuruTech)',
    usage: 'news [topic]  e.g. news technology',
    category: 'search',
    handler: async (ctx) => {
        const topic = ctx.text || 'world';
        await ctx.react('📰');
        try {
            const d       = await guruApi('news', { q: topic, category: topic });
            const articles = d.articles || d.news || d.results || d.data || [];
            if (!articles.length) return ctx.reply('❌ No news found. Try: world, tech, sports, health');

            let text = `📰 *Top News — ${topic.charAt(0).toUpperCase() + topic.slice(1)}*\n\n`;
            articles.slice(0, 5).forEach((a, i) => {
                const title  = a.title || a.headline || 'No title';
                const source = a.source?.name || a.source || a.publisher || '';
                const url    = a.url || a.link || '';
                text += `*${i + 1}.* ${title}${source ? `\n   _— ${source}_` : ''}${url ? `\n   🔗 ${url}` : ''}\n\n`;
            });
            text += `_${config.BOT_NAME}_`;
            await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[news]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ News fetch failed. Try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📱  QR CODE GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'qr',
    aliases: ['qrcode', 'makeqr'],
    desc: 'Generate a QR code from text/URL (GuruTech)',
    usage: 'qr <text or URL>',
    category: 'tools',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply('❌ Provide text or URL.\n\nExample: `.qr https://gurutech.top`');
        await ctx.react('📱');
        try {
            const d   = await guruApi('qrcode', { data: ctx.text, size: 300 });
            const img = d.url || d.image || d.qr || d.data;
            if (!img) return ctx.reply('❌ QR code generation failed.');
            await ctx.sock.sendMessage(ctx.from, {
                image:   { url: img },
                caption: `📱 *QR Code*\n\n📝 _${ctx.text.slice(0, 100)}_\n\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[qr]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ QR generation failed. Try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔗  URL SHORTENER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'shorten',
    aliases: ['shorturl', 'tinyurl', 'short'],
    desc: 'Shorten a URL (GuruTech)',
    usage: 'shorten <URL>',
    category: 'tools',
    handler: async (ctx) => {
        const url = ctx.text;
        if (!url || !url.startsWith('http')) return ctx.reply('❌ Provide a valid URL.\n\nExample: `.shorten https://example.com/very/long/url`');
        await ctx.react('🔗');
        try {
            const d     = await guruApi('shorten', { url });
            const short = d.short || d.shortened || d.result || d.url;
            await sendButtons(ctx.sock, ctx.from, {
                title:  '🔗 URL Shortened',
                text:   `📥 *Original:* ${url.slice(0, 80)}\n📤 *Short:* ${short}`,
                footer: `© ${config.BOT_NAME} ${new Date().getFullYear()}`,
                buttons: [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '🔗 Open Short URL', url: short }) },
                    { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Short URL', copy_code: short }) },
                ],
            }, { quoted: ctx.m }).catch(() => ctx.reply(`🔗 *URL Shortened*\n\n📤 ${short}`));
            await ctx.react('✅');
        } catch (err) {
            console.error('[shorten]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ URL shortening failed. Try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔍  WEB SEARCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'search',
    aliases: ['google', 'websearch', 'web'],
    desc: 'Search the web (GuruTech)',
    usage: 'search <query>',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply('❌ Provide a search query.\n\nExample: `.search Kenya news today`');
        await ctx.react('🔍');
        try {
            const d       = await guruApi('google-search', { q: ctx.text });
            const results = d.results || d.organic || d.items || d.data || [];
            if (!results.length) return ctx.reply(`❌ No results found for *${ctx.text}*.`);

            let text = `🔍 *Web Search: "${ctx.text}"*\n\n`;
            results.slice(0, 5).forEach((r, i) => {
                const title   = r.title || r.name || 'No title';
                const snippet = (r.snippet || r.description || '').slice(0, 100);
                const link    = r.link || r.url || '';
                text += `*${i + 1}.* *${title}*\n${snippet ? `   ${snippet}\n` : ''}${link ? `   🔗 ${link}\n` : ''}\n`;
            });
            text += `_${config.BOT_NAME}_`;
            await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[search]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Search failed. Try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🎵  LYRICS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'lyrics',
    aliases: ['lyric', 'songlyr'],
    desc: 'Get song lyrics (GuruTech)',
    usage: 'lyrics <artist> - <song>',
    category: 'search',
    handler: async (ctx) => {
        const parts = ctx.text?.split('-');
        if (!parts || parts.length < 2)
            return ctx.reply('❌ Usage: `.lyrics Adele - Hello`');
        const artist = parts[0].trim();
        const title  = parts.slice(1).join('-').trim();
        await ctx.react('🎵');
        try {
            const d      = await guruApi('lyrics-search', { artist, title });
            const lyrics = d.lyrics || d.text || d.result;
            if (!lyrics) return ctx.reply('❌ Lyrics not found. Check artist and song name.');
            const header = `🎵 *${title}* — _${artist}_\n\n`;
            // Send in chunks if too long
            const maxLen = 3500;
            if ((header + lyrics).length <= maxLen) {
                await ctx.sock.sendMessage(ctx.from, { text: header + lyrics + `\n\n_${config.BOT_NAME}_`, contextInfo: channelCtx() }, { quoted: ctx.m });
            } else {
                await ctx.sock.sendMessage(ctx.from, { text: header, contextInfo: channelCtx() }, { quoted: ctx.m });
                const chunks = lyrics.match(/.{1,3500}/gs) || [];
                for (const chunk of chunks) {
                    await ctx.sock.sendMessage(ctx.from, { text: chunk, contextInfo: channelCtx() }, { quoted: ctx.m });
                }
            }
            await ctx.react('✅');
        } catch (err) {
            console.error('[lyrics]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Lyrics fetch failed. Try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🎬  MOVIE INFO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'movie',
    aliases: ['film', 'movieinfo'],
    desc: 'Get movie info (GuruTech)',
    usage: 'movie <title>',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply('❌ Provide a movie title.\n\nExample: `.movie Inception`');
        await ctx.react('🎬');
        try {
            const d      = await guruApi('movie-info', { q: ctx.text });
            const title  = d.title || d.name || ctx.text;
            const year   = d.year || d.release_year || '';
            const rating = d.rating || d.imdb_rating || d.score || '';
            const genre  = Array.isArray(d.genre) ? d.genre.join(', ') : (d.genre || '');
            const plot   = (d.plot || d.overview || d.synopsis || '').slice(0, 300);
            const poster = d.poster || d.image || d.thumbnail || '';

            const text =
`🎬 *${title}* ${year ? `(${year})` : ''}

${rating ? `⭐ *Rating:* ${rating}` : ''}
${genre ? `🎭 *Genre:* ${genre}` : ''}
${plot ? `\n📖 *Plot:*\n${plot}` : ''}

_${config.BOT_NAME}_`;

            if (poster) {
                await ctx.sock.sendMessage(ctx.from, {
                    image: { url: poster },
                    caption: text,
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            } else {
                await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
            }
            await ctx.react('✅');
        } catch (err) {
            console.error('[movie]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Movie not found. Check the title and try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🐙  GITHUB USER INFO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'github',
    aliases: ['gh', 'githubuser'],
    desc: 'Get GitHub user profile (GuruTech)',
    usage: 'github <username>',
    category: 'search',
    handler: async (ctx) => {
        const username = ctx.args[0] || ctx.text;
        if (!username) return ctx.reply('❌ Provide a GitHub username.\n\nExample: `.github torvalds`');
        await ctx.react('🐙');
        try {
            const d      = await guruApi('github-user', { username });
            const name   = d.name || username;
            const bio    = d.bio || '';
            const repos  = d.public_repos ?? d.repos ?? '';
            const followers = d.followers ?? '';
            const following = d.following ?? '';
            const location  = d.location || '';
            const blog      = d.blog || d.website || '';
            const avatar    = d.avatar_url || d.avatar || '';
            const profileUrl = d.html_url || `https://github.com/${username}`;

            const text =
`🐙 *GitHub: ${name}*
🔗 @${username}

${bio ? `💬 _${bio}_\n` : ''}
${repos !== '' ? `📦 *Repos:*     ${repos}` : ''}
${followers !== '' ? `👥 *Followers:* ${followers}` : ''}
${following !== '' ? `👤 *Following:* ${following}` : ''}
${location ? `📍 *Location:* ${location}` : ''}
${blog ? `🌐 *Blog:* ${blog}` : ''}
🔗 ${profileUrl}

_${config.BOT_NAME}_`;

            if (avatar) {
                await ctx.sock.sendMessage(ctx.from, {
                    image: { url: avatar },
                    caption: text,
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            } else {
                await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
            }
            await ctx.react('✅');
        } catch (err) {
            console.error('[github]', err.message);
            await ctx.react('❌');
            await ctx.reply(`❌ GitHub user *${username}* not found.`);
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🌐  IP INFO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'ipinfo',
    aliases: ['ip', 'iplookup'],
    desc: 'Get info about an IP address (GuruTech)',
    usage: 'ipinfo <IP>  e.g. ipinfo 8.8.8.8',
    category: 'search',
    handler: async (ctx) => {
        const ip = ctx.args[0];
        if (!ip) return ctx.reply('❌ Provide an IP address.\n\nExample: `.ipinfo 8.8.8.8`');
        await ctx.react('🌐');
        try {
            const d        = await guruApi('ip-info', { ip });
            const country  = d.country || d.country_name || '';
            const city     = d.city || '';
            const region   = d.region || '';
            const isp      = d.isp || d.org || '';
            const timezone = d.timezone || '';
            const lat      = d.lat || d.latitude || '';
            const lon      = d.lon || d.longitude || '';

            await ctx.sock.sendMessage(ctx.from, {
                text:
`🌐 *IP Info — ${ip}*

🏳️ *Country:*  ${country}
🏙️ *City:*     ${city}
🗺️ *Region:*   ${region}
📡 *ISP:*      ${isp}
🕐 *Timezone:* ${timezone}
${lat && lon ? `📍 *Coords:*   ${lat}, ${lon}` : ''}

_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[ipinfo]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ IP lookup failed. Enter a valid IP like 8.8.8.8');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔊  TEXT TO SPEECH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'tts',
    aliases: ['texttospeech', 'speak'],
    desc: 'Convert text to speech audio (GuruTech)',
    usage: 'tts <text>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text ||
            ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
        if (!text) return ctx.reply('❌ Provide text to speak.\n\nExample: `.tts Hello from BLACK PANTHER MD`');
        await ctx.react('🔊');
        try {
            const d    = await guruApi('tts', { q: text, lang: 'en' });
            const audio = d.url || d.audio || d.result;
            if (!audio) return ctx.reply('❌ TTS failed. Try again.');
            await ctx.sock.sendMessage(ctx.from, {
                audio:    { url: audio },
                mimetype: 'audio/mpeg',
                ptt:      true,
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[tts]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Text-to-speech failed. Try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🌍  COUNTRY INFO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'country',
    aliases: ['countryinfo', 'nation'],
    desc: 'Get info about a country (GuruTech)',
    usage: 'country <name>  e.g. country Kenya',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply('❌ Provide a country name.\n\nExample: `.country Kenya`');
        await ctx.react('🌍');
        try {
            const d        = await guruApi('country-info', { q: ctx.text });
            const name     = d.name || ctx.text;
            const capital  = d.capital || '';
            const pop      = d.population ? Number(d.population).toLocaleString() : '';
            const area     = d.area ? `${Number(d.area).toLocaleString()} km²` : '';
            const currency = d.currency || d.currencies || '';
            const lang     = d.language || d.languages || '';
            const region   = d.region || '';
            const flag     = d.flag || d.emoji || '';

            await ctx.sock.sendMessage(ctx.from, {
                text:
`${flag} *${name}*

🏙️ *Capital:*    ${capital}
👥 *Population:* ${pop}
📐 *Area:*       ${area}
💰 *Currency:*   ${currency}
🗣️ *Language:*   ${lang}
🌍 *Region:*     ${region}

_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[country]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Country not found. Check the spelling and try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📖  DICTIONARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'define',
    aliases: ['dict', 'dictionary', 'meaning'],
    desc: 'Get word definition (GuruTech)',
    usage: 'define <word>',
    category: 'search',
    handler: async (ctx) => {
        const word = ctx.args[0] || ctx.text;
        if (!word) return ctx.reply('❌ Provide a word.\n\nExample: `.define serendipity`');
        await ctx.react('📖');
        try {
            const d    = await guruApi('dictionary', { q: word });
            const def  = d.definition || d.meaning || d.result || d.text;
            const pos  = d.part_of_speech || d.type || '';
            const ex   = d.example || d.examples?.[0] || '';
            const syn  = Array.isArray(d.synonyms) ? d.synonyms.slice(0, 5).join(', ') : (d.synonyms || '');

            await ctx.sock.sendMessage(ctx.from, {
                text:
`📖 *${word}*${pos ? ` _(${pos})_` : ''}

📝 *Definition:*
${def || 'No definition found.'}
${ex ? `\n💬 *Example:* _${ex}_` : ''}
${syn ? `\n🔤 *Synonyms:* ${syn}` : ''}

_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[define]', err.message);
            await ctx.react('❌');
            await ctx.reply(`❌ Could not find definition for *${word}*.`);
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  👁️  SOCIAL STALK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'stalk',
    aliases: ['socialstalk', 'igstalk', 'ttstalk'],
    desc: 'Stalk a social media profile (GuruTech)',
    usage: 'stalk <platform> <username>  e.g. stalk instagram zuck',
    category: 'search',
    handler: async (ctx) => {
        const [platform, ...userParts] = ctx.args;
        const username = userParts.join('');
        if (!platform || !username)
            return ctx.reply('❌ Usage: `.stalk <platform> <username>`\n\nPlatforms: instagram, tiktok, twitter, github, reddit, youtube');
        await ctx.react('👁️');

        const actionMap = {
            instagram: 'instagram-stalk',
            ig:        'instagram-stalk',
            tiktok:    'tiktok-stalk',
            tt:        'tiktok-stalk',
            twitter:   'twitter-stalk',
            x:         'twitter-stalk',
            github:    'github-user',
            gh:        'github-user',
            reddit:    'reddit-stalk',
            youtube:   'youtube-stalk',
            yt:        'youtube-stalk',
        };

        const action = actionMap[platform.toLowerCase()];
        if (!action) return ctx.reply(`❌ Unknown platform *${platform}*.\n\nSupported: instagram, tiktok, twitter, github, reddit, youtube`);

        try {
            const d        = await guruApi(action, { username });
            const name     = d.name || d.full_name || d.display_name || username;
            const bio      = d.bio || d.description || '';
            const followers = d.followers || d.follower_count || '';
            const following = d.following || d.following_count || '';
            const posts    = d.posts || d.media_count || '';
            const avatar   = d.avatar || d.profile_pic || d.profile_image || '';
            const verified = d.verified ? '✅' : '';
            const profileUrl = d.url || d.profile_url || '';

            const text =
`👁️ *${platform.toUpperCase()} — @${username}* ${verified}

👤 *Name:*      ${name}
${bio ? `💬 *Bio:*       ${bio.slice(0, 150)}\n` : ''}
${followers !== '' ? `👥 *Followers:* ${Number(followers).toLocaleString()}` : ''}
${following !== '' ? `👤 *Following:* ${Number(following).toLocaleString()}` : ''}
${posts !== '' ? `📸 *Posts:*     ${Number(posts).toLocaleString()}` : ''}
${profileUrl ? `🔗 ${profileUrl}` : ''}

_${config.BOT_NAME}_`;

            if (avatar) {
                await ctx.sock.sendMessage(ctx.from, {
                    image: { url: avatar },
                    caption: text,
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            } else {
                await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
            }
            await ctx.react('✅');
        } catch (err) {
            console.error('[stalk]', err.message);
            await ctx.react('❌');
            await ctx.reply(`❌ Could not stalk @${username} on ${platform}. Profile may be private or not found.`);
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  🔢  MATH AI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'mathsolve',
    aliases: ['mathsai', 'solvemath', 'maths'],
    desc: 'Solve math problems with AI (GuruTech)',
    usage: 'mathsolve <problem>',
    category: 'ai',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply('❌ Provide a math problem.\n\nExample: `.mathsolve Solve: 2x + 5 = 13`');
        await ctx.react('🔢');
        try {
            const d    = await guruApi('maths-ai', { q: ctx.text });
            const ans  = d.answer || d.result || d.solution || d.text;
            await ctx.sock.sendMessage(ctx.from, {
                text: `🔢 *Math AI*\n\n❓ *Problem:* ${ctx.text}\n\n💡 *Solution:*\n${ans || 'Could not solve. Try rephrasing.'}`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[mathsolve]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Math solver failed. Try again.');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📚  BIBLE VERSE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'bible',
    aliases: ['verse', 'bibleverse'],
    desc: 'Get a Bible verse (GuruTech)',
    usage: 'bible <reference>  e.g. bible john 3:16',
    category: 'fun',
    handler: async (ctx) => {
        const ref = ctx.text || 'john 3:16';
        await ctx.react('📖');
        try {
            const d    = await guruApi('bible-search', { q: ref });
            const verse = d.text || d.verse || d.result || d.content;
            const ref2  = d.reference || d.book || ref;
            await ctx.sock.sendMessage(ctx.from, {
                text: `📖 *${ref2}*\n\n_"${verse || 'Verse not found.'}"_\n\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch {
            await ctx.reply('📖 *John 3:16*\n\n_"For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life."_');
        }
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📲  WHATSAPP NUMBER CHECK  (.stalk wa)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'wachek',
    aliases: ['wacheck', 'wainfo', 'stalwa', 'wacheck'],
    desc: 'Check if a number is on WhatsApp + get profile info (GuruTech)',
    usage: 'wachek <number>  e.g. wachek 254712345678',
    category: 'tools',
    handler: async (ctx) => {
        const raw = ctx.args[0] || ctx.text;
        if (!raw) return ctx.reply(
            `❌ Provide a phone number.\n\nExample: \`${config.BOT_PREFIX}wachek 254712345678\`\n\n_Include country code, no + or spaces_`
        );

        // Sanitise: strip +, spaces, dashes
        const number = raw.replace(/[\s+\-()]/g, '');
        if (!/^\d{7,15}$/.test(number))
            return ctx.reply('❌ Invalid number. Use digits only with country code.\n\nExample: `254712345678`');

        await ctx.react('🔍');

        try {
            // Check if number exists on WhatsApp
            const check = await guruApi('wa-check', { number }).catch(() => null);
            const exists = check?.exists ?? check?.registered ?? check?.status === 'registered';

            if (check && !exists) {
                await ctx.sock.sendMessage(ctx.from, {
                    text: `📲 *WhatsApp Check*\n\n🔢 *Number:* +${number}\n❌ *Not registered on WhatsApp*\n\n_${config.BOT_NAME}_`,
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
                await ctx.react('✅');
                return;
            }

            // Fetch full profile info
            const info = await guruApi('wa-info', { number }).catch(() => null);

            const name    = info?.name    || info?.pushname  || info?.display_name || '';
            const bio     = info?.bio     || info?.status    || info?.about        || '';
            const avatar  = info?.avatar  || info?.profile_picture || info?.pp     || '';
            const jid     = info?.jid     || `${number}@s.whatsapp.net`;
            const isVerified = info?.verified  || info?.isBusiness || false;
            const isBiz   = info?.is_business  || info?.business   || false;

            const text =
`📲 *WhatsApp Info*

🔢 *Number:*   +${number}
${name  ? `👤 *Name:*     ${name}` : ''}
${bio   ? `💬 *Bio:*      ${bio.slice(0, 200)}` : ''}
${isBiz     ? `🏢 *Account:*  Business` : ''}
${isVerified ? `✅ *Verified:* Yes` : ''}
✅ *Status:*   Registered on WhatsApp

_${config.BOT_NAME}_`;

            if (avatar) {
                await ctx.sock.sendMessage(ctx.from, {
                    image:   { url: avatar },
                    caption: text,
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            } else {
                await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
            }
            await ctx.react('✅');

        } catch (err) {
            console.error('[wachek]', err.message);
            // Fallback: just use Baileys to verify
            try {
                const [result] = await ctx.sock.onWhatsApp(`${number}@s.whatsapp.net`);
                if (result?.exists) {
                    await ctx.sock.sendMessage(ctx.from, {
                        text: `📲 *WhatsApp Check*\n\n🔢 *Number:* +${number}\n✅ *Registered on WhatsApp*\n\n_${config.BOT_NAME}_`,
                        contextInfo: channelCtx(),
                    }, { quoted: ctx.m });
                    await ctx.react('✅');
                } else {
                    await ctx.reply(`📲 *WhatsApp Check*\n\n🔢 *Number:* +${number}\n❌ *Not on WhatsApp*`);
                    await ctx.react('✅');
                }
            } catch {
                await ctx.react('❌');
                await ctx.reply('❌ Could not check that number. Make sure it includes the country code.');
            }
        }
    },
});

// ━━ stalk wa alias ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'stalkwa',
    aliases: ['stalwa', 'wastalk'],
    desc: 'Alias for wachek — stalk a WhatsApp number',
    usage: 'stalkwa <number>',
    category: 'tools',
    handler: async (ctx) => {
        ctx.text = ctx.args[0] || ctx.text;
        return require('../../guru/handlers/loader').findCmd('wachek')?.handler(ctx);
    },
});
