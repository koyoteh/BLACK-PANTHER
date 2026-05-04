'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  search.js
//  🔍  Weather · News · Crypto · Currency · Movie · Github · IP
//  🍜  Recipe · Color · Phone · Dictionary · Lyrics · Meme
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd } = require('../../guru/handlers/loader');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
const {
    fetchWeather, fetchNews, fetchCurrency, fetchCrypto,
    fetchDictionary, fetchLyrics, fetchMovie, fetchMeme,
    fetchCountry, fetchGithub, fetchPhoneInfo, fetchColor,
    fetchIPInfo, fetchRecipe,
} = require('../../guru/utils/gmdFunctions3');

// ── Weather ───────────────────────────────────────────────────
addCmd({
    name: 'weather',
    aliases: ['climate', 'forecast'],
    desc: 'Get weather forecast for a city',
    usage: 'weather <city>',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply(
            '❌ Provide a city name.\n\n*Example:* `.weather Nairobi`'
        );
        await ctx.react('🌤️');
        try {
            const result = await fetchWeather(ctx.text);
            await ctx.reply(result);
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, { text: '❌ City not found. Check the spelling and try again.', contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── News ──────────────────────────────────────────────────────
addCmd({
    name: 'news',
    aliases: ['headlines'],
    desc: 'Get top news headlines',
    usage: 'news [topic] — topics: world, technology, sports, health, entertainment',
    category: 'search',
    handler: async (ctx) => {
        const topic = ctx.args[0] || 'world';
        await ctx.react('📰');
        const result = await fetchNews(topic);
        await ctx.reply(result);
        await ctx.react('✅');
    },
});

// ── Currency ──────────────────────────────────────────────────
addCmd({
    name: 'currency',
    aliases: ['convert', 'fx'],
    desc: 'Convert between currencies',
    usage: 'currency <amount> <FROM> <TO>',
    category: 'search',
    handler: async (ctx) => {
        const [amount, from, to] = ctx.args;
        if (!amount || !from || !to)
            return ctx.reply(
                '❌ Usage: `.currency 100 USD KES`\n\n' +
                '*Examples:*\n◈ `.currency 50 USD EUR`\n◈ `.currency 1000 KES USD`'
            );
        await ctx.react('💱');
        const result = await fetchCurrency(amount, from, to);
        await ctx.reply(result);
        await ctx.react('✅');
    },
});

// ── Crypto ────────────────────────────────────────────────────
addCmd({
    name: 'crypto',
    aliases: ['coin', 'price'],
    desc: 'Get live cryptocurrency price',
    usage: 'crypto <coin>  e.g. bitcoin, ethereum, solana',
    category: 'search',
    handler: async (ctx) => {
        const coin = ctx.text || 'bitcoin';
        await ctx.react('🪙');
        const result = await fetchCrypto(coin);
        await ctx.reply(result);
        await ctx.react('✅');
    },
});

// ── Dictionary ────────────────────────────────────────────────
addCmd({
    name: 'define',
    aliases: ['dict', 'dictionary', 'meaning'],
    desc: 'Look up a word in the dictionary',
    usage: 'define <word>',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a word.\n\n*Example:* `.define serendipity`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('📖');
        const result = await fetchDictionary(ctx.text.trim().split(' ')[0]);
        await ctx.reply(result);
        await ctx.react('✅');
    },
});

// ── Lyrics ────────────────────────────────────────────────────
addCmd({
    name: 'lyrics',
    aliases: ['lyric'],
    desc: 'Search song lyrics',
    usage: 'lyrics <Artist> - <Song Title>',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply(
            '❌ Provide artist and song.\n\n*Example:* `.lyrics Ed Sheeran - Shape of You`'
        );
        const parts  = ctx.text.split(' - ');
        const artist = parts[0]?.trim() || ctx.text;
        const title  = parts[1]?.trim() || ctx.text;
        await ctx.react('🎵');
        const result = await fetchLyrics(artist, title);
        await ctx.reply(result);
        await ctx.react('✅');
    },
});

// ── Movie Info ────────────────────────────────────────────────
addCmd({
    name: 'movie',
    aliases: ['film', 'imdb'],
    desc: 'Get movie or series information',
    usage: 'movie <title>',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a movie title.\n\n*Example:* `.movie Black Panther`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('🎬');
        const result = await fetchMovie(ctx.text);
        await ctx.reply(result);
        await ctx.react('✅');
    },
});

// ── Meme ──────────────────────────────────────────────────────
addCmd({
    name: 'meme',
    aliases: ['dankmeme', 'randommeme'],
    desc: 'Get a random meme',
    usage: 'meme [subreddit]',
    category: 'fun',
    handler: async (ctx) => {
        const sub = ctx.args[0] || 'memes';
        await ctx.react('😂');
        const data = await fetchMeme(sub);
        if (!data) return ctx.sock.sendMessage(ctx.from, { text: '❌ Could not fetch a meme right now.', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.send({
            image:   { url: data.url },
            caption:
                `😂 *${data.title}*\n\n` +
                `👍 ${data.ups?.toLocaleString()} upvotes  |  r/${data.sub}`,
        });
        await ctx.react('✅');
    },
});

// ── Country ───────────────────────────────────────────────────
addCmd({
    name: 'country',
    aliases: ['nation', 'countryinfo'],
    desc: 'Get information about any country',
    usage: 'country <name>',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a country name.\n\n*Example:* `.country Kenya`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('🌍');
        const { text, flag } = await fetchCountry(ctx.text);
        if (flag) {
            await ctx.send({ image: { url: flag }, caption: text });
        } else {
            await ctx.reply(text);
        }
        await ctx.react('✅');
    },
});

// ── GitHub ────────────────────────────────────────────────────
addCmd({
    name: 'github',
    aliases: ['git', 'gh'],
    desc: 'Get GitHub user profile information',
    usage: 'github <username>',
    category: 'search',
    handler: async (ctx) => {
        const user = ctx.text || ctx.args[0];
        if (!user) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a GitHub username.\n\n*Example:* `.github torvalds`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('🐙');
        const { text, avatar, url } = await fetchGithub(user);
        if (avatar) {
            await ctx.send({ image: { url: avatar }, caption: text });
        } else {
            await ctx.reply(text);
        }
        await ctx.react('✅');
    },
});

// ── Phone Info ────────────────────────────────────────────────
addCmd({
    name: 'phoneinfo',
    aliases: ['numinfo', 'whois_num'],
    desc: 'Get info about a phone number',
    usage: 'phoneinfo <number>',
    category: 'search',
    handler: async (ctx) => {
        const num = ctx.text || ctx.args[0];
        if (!num) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a number.\n\n*Example:* `.phoneinfo 254712345678`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('📱');
        const result = await fetchPhoneInfo(num);
        await ctx.reply(result);
        await ctx.react('✅');
    },
});

// ── Color Info ────────────────────────────────────────────────
addCmd({
    name: 'color',
    aliases: ['colour', 'hex'],
    desc: 'Get info about a HEX color code',
    usage: 'color <hex>  e.g. #FF5733',
    category: 'tools',
    handler: async (ctx) => {
        const hex = ctx.text?.replace('#', '') || ctx.args[0]?.replace('#', '');
        if (!hex) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a hex color.\n\n*Example:* `.color #FF5733`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('🎨');
        const { text, image } = await fetchColor(hex);
        if (image) {
            await ctx.send({ image: { url: image }, caption: text });
        } else {
            await ctx.reply(text);
        }
        await ctx.react('✅');
    },
});

// ── IP Info ───────────────────────────────────────────────────
addCmd({
    name: 'ip',
    aliases: ['ipinfo', 'ipcheck'],
    desc: 'Get information about an IP address',
    usage: 'ip <address>',
    category: 'search',
    handler: async (ctx) => {
        const ip = ctx.text || ctx.args[0];
        if (!ip) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide an IP address.\n\n*Example:* `.ip 8.8.8.8`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('🌐');
        const result = await fetchIPInfo(ip);
        await ctx.reply(result);
        await ctx.react('✅');
    },
});

// ── Recipe ────────────────────────────────────────────────────
addCmd({
    name: 'recipe',
    aliases: ['cook', 'meal', 'food'],
    desc: 'Get a recipe for a food',
    usage: 'recipe <food name>',
    category: 'search',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a food name.\n\n*Example:* `.recipe Pasta`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('🍜');
        const { text, thumb } = await fetchRecipe(ctx.text);
        if (thumb) {
            await ctx.send({ image: { url: thumb }, caption: text });
        } else {
            await ctx.reply(text);
        }
        await ctx.react('✅');
    },
});
