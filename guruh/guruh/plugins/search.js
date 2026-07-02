'use strict';
// ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
//  🐾  BLACK PANTHER MD  —  search.js
//  🍜  Recipe · Color · Phone · Wikipedia · WikiSearch
//  NOTE: Weather, Crypto, Currency, Movie, GitHub, IP, Lyrics,
//        Dictionary, News, Country → now in gurutech.js (GuruTech API)
// ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

const { addCmd } = require('../../guru/handlers/loader');
const { channelCtx, sendButtons } = require('../../guru/utils/gmdFunctions2');
const config = require('../../guru/config/settings');
const {
    fetchMeme,
    fetchCountry, fetchGithub, fetchPhoneInfo, fetchColor,
    fetchIPInfo, fetchRecipe,
} = require('../../guru/utils/gmdFunctions3');

// ━━ Phone Info ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

// ━━ Color Info ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

// ━━ Recipe ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
