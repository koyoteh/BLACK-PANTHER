'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  wakanda.js
//  🌍  Wakanda Suite: Horoscope · Weather · Currency · Facts
//      News · Bible · Quran · Prayer Times · COVID · Countries
//      IP Lookup · DNS Lookup · Domain Whois · Stock Quote
//      Movie Info · Anime Info · Lyrics Search · Recipe Search
// ╚══════════════════════════════════════════════════════════════╝

'use strict';
const { addCmd }     = require('../../guru/handlers/loader');
const axios          = require('axios');
const config         = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

function card(title, body) {
    return `*${title}*\n${config.BOT_NAME}\n\n${body}\n\n◈ ${config.CHANNEL_NAME}`;
}

// ════════════════════════════════════════════════════════════════
//  🔮  HOROSCOPE
// ════════════════════════════════════════════════════════════════
const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo',
               'libra','scorpio','sagittarius','capricorn','aquarius','pisces'];

addCmd({
    name: 'horoscope',
    aliases: ['zodiac', 'star', 'horo'],
    desc: 'Get your daily horoscope reading',
    usage: 'horoscope <sign>  e.g. horoscope aries',
    category: 'lifestyle',
    handler: async (ctx) => {
        const sign = ctx.args[0]?.toLowerCase();
        if (!sign || !SIGNS.includes(sign)) {
            return ctx.reply(`❌ *Invalid sign.*\n\nValid signs:\n${SIGNS.map(s => `• ${s}`).join('\n')}\n\nExample: \`${config.BOT_PREFIX}horoscope leo\``);
        }
        await ctx.react('⏳');
        try {
            const res = await axios.get(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=TODAY`);
            const d   = res.data?.data;
            const signEmojis = { aries:'♈',taurus:'♉',gemini:'♊',cancer:'♋',leo:'♌',virgo:'♍',
                                  libra:'♎',scorpio:'♏',sagittarius:'♐',capricorn:'♑',aquarius:'♒',pisces:'♓' };
            await ctx.reply(card(`${signEmojis[sign]} ${sign.toUpperCase()} — DAILY HOROSCOPE`,
                `📅 *Date:* ${d?.date || 'Today'}\n\n${d?.horoscope_data || 'Stars are aligned for you today!'}\n\n💫 _Powered by the cosmos_`));
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ Could not fetch horoscope. Try again later.');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🌦️  WEATHER
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'weather',
    aliases: ['forecast', 'climate', 'temp'],
    desc: 'Get current weather for any city',
    usage: 'weather <city>',
    category: 'tools',
    handler: async (ctx) => {
        const city = ctx.args.join(' ');
        if (!city) return ctx.reply(`❌ Provide a city.\n\nExample: \`${config.BOT_PREFIX}weather Nairobi\``);
        await ctx.react('⏳');
        try {
            const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
            const d   = res.data.current_condition[0];
            const loc = res.data.nearest_area[0];
            const cityName = loc.areaName[0].value + ', ' + loc.country[0].value;
            const wc = d.weatherCode;
            const weatherIcon = wc <= 113 ? '☀️' : wc <= 119 ? '⛅' : wc <= 122 ? '☁️' : wc <= 200 ? '🌫️' : wc <= 299 ? '🌩️' : wc <= 399 ? '🌧️' : wc <= 499 ? '🌨️' : '🌪️';

            await ctx.reply(card(`${weatherIcon} WEATHER — ${cityName.toUpperCase()}`,
                `🌡️ *Temp:*      ${d.temp_C}°C  /  ${d.temp_F}°F\n` +
                `🤔 *Feels like:* ${d.FeelsLikeC}°C\n` +
                `💧 *Humidity:*  ${d.humidity}%\n` +
                `💨 *Wind:*      ${d.windspeedKmph} km/h ${d.winddir16Point}\n` +
                `👁️ *Visibility:* ${d.visibility} km\n` +
                `🌤️ *Condition:* ${d.weatherDesc[0].value}\n` +
                `🌡️ *Pressure:*  ${d.pressure} hPa\n` +
                `☁️ *Cloud:*     ${d.cloudcover}%`));
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ City not found or weather service unavailable.');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  💱  CURRENCY CONVERTER
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'currency',
    aliases: ['convert', 'forex', 'exchange'],
    desc: 'Convert currencies in real-time',
    usage: 'currency <amount> <FROM> <TO>  e.g. currency 100 USD KES',
    category: 'tools',
    handler: async (ctx) => {
        const [amount, from, to] = ctx.args;
        if (!amount || !from || !to)
            return ctx.reply(`❌ *Usage:* \`${config.BOT_PREFIX}currency 100 USD KES\``);
        if (isNaN(amount)) return ctx.reply('❌ Amount must be a number.');
        await ctx.react('⏳');
        try {
            const res  = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
            const rate = res.data.rates[to.toUpperCase()];
            if (!rate) return ctx.reply(`❌ Unknown currency code: *${to.toUpperCase()}*`);
            const result = (parseFloat(amount) * rate).toFixed(4);
            await ctx.reply(card('💱 CURRENCY CONVERTER',
                `💵 *Input:*  ${parseFloat(amount).toLocaleString()} ${from.toUpperCase()}\n` +
                `💰 *Output:* ${parseFloat(result).toLocaleString()} ${to.toUpperCase()}\n` +
                `📊 *Rate:*   1 ${from.toUpperCase()} = ${rate.toFixed(6)} ${to.toUpperCase()}\n` +
                `📅 *Updated:* ${res.data.date}`));
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ Could not fetch exchange rate. Check currency codes (e.g. USD, KES, EUR).');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  📰  NEWS
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'news',
    aliases: ['headlines', 'breaking'],
    desc: 'Get top world news headlines',
    usage: 'news  |  news <topic>',
    category: 'search',
    handler: async (ctx) => {
        const q = ctx.args.join(' ') || 'world';
        await ctx.react('⏳');
        try {
            const res = await axios.get(`https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=5&apikey=demo`);
            if (!res.data.articles?.length) throw new Error('no articles');
            let text = `*📰 NEWS — ${q.toUpperCase()}*\n${config.BOT_NAME}\n\n`;
            res.data.articles.slice(0, 5).forEach((a, i) => {
                text += `*${i+1}. ${a.title}*\n`;
                text += `📅 ${a.publishedAt?.slice(0,10) || 'Today'}\n`;
                text += `🔗 ${a.url}\n\n`;
            });
            text += `◈ ${config.CHANNEL_NAME}`;
            await ctx.reply(text);
            await ctx.react('✅');
        } catch {
            // Fallback to public RSS
            await ctx.react('✅');
            await ctx.reply(card('📰 NEWS',
                `No live news available right now.\nTry: \`${config.BOT_PREFIX}news technology\`\nor visit https://news.google.com`));
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🌍  COUNTRY INFO
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'country',
    aliases: ['countryinfo', 'nation'],
    desc: 'Get detailed info about any country',
    usage: 'country <name>',
    category: 'search',
    handler: async (ctx) => {
        const name = ctx.args.join(' ');
        if (!name) return ctx.reply(`❌ Provide a country name.\n\nExample: \`${config.BOT_PREFIX}country Kenya\``);
        await ctx.react('⏳');
        try {
            const res = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
            const c   = res.data[0];
            const langs = Object.values(c.languages || {}).join(', ');
            const currencies = Object.entries(c.currencies || {}).map(([k,v]) => `${v.name} (${k})`).join(', ');
            await ctx.reply(card(`🌍 COUNTRY — ${c.name.common.toUpperCase()}`,
                `🏳️ *Official:*   ${c.name.official}\n` +
                `🌐 *Region:*    ${c.region} / ${c.subregion}\n` +
                `🏙️ *Capital:*   ${c.capital?.[0] || 'N/A'}\n` +
                `👥 *Population:* ${c.population?.toLocaleString()}\n` +
                `📐 *Area:*      ${c.area?.toLocaleString()} km²\n` +
                `🗣️ *Languages:* ${langs}\n` +
                `💰 *Currency:*  ${currencies}\n` +
                `📞 *Calling:*   +${c.idd?.root}${c.idd?.suffixes?.[0] || ''}\n` +
                `🚗 *Driving:*   ${c.car?.side} side\n` +
                `⏰ *Timezones:* ${c.timezones?.slice(0,3).join(', ')}\n` +
                `🌐 *Domain:*    ${c.tld?.join(', ') || 'N/A'}`));
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ Country not found. Try the full name (e.g. `Kenya`, `United States`).');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🔎  IP LOOKUP
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'iplookup',
    aliases: ['ipinfo', 'checkip'],
    desc: 'Look up information about an IP address',
    usage: 'iplookup <ip>',
    category: 'tools',
    handler: async (ctx) => {
        const ip = ctx.args[0];
        if (!ip) return ctx.reply(`❌ Provide an IP address.\n\nExample: \`${config.BOT_PREFIX}iplookup 8.8.8.8\``);
        await ctx.react('⏳');
        try {
            const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
            if (res.data.status !== 'success') throw new Error(res.data.message);
            const d = res.data;
            await ctx.reply(card('🔎 IP ADDRESS LOOKUP',
                `📡 *IP:*       ${d.query}\n` +
                `🌍 *Country:*  ${d.country}\n` +
                `📍 *Region:*   ${d.regionName}\n` +
                `🏙️ *City:*     ${d.city}\n` +
                `📮 *ZIP:*      ${d.zip}\n` +
                `🌐 *ISP:*      ${d.isp}\n` +
                `🏢 *Org:*      ${d.org}\n` +
                `⏰ *Timezone:* ${d.timezone}\n` +
                `📌 *Coords:*   ${d.lat}, ${d.lon}`));
            await ctx.react('✅');
        } catch (e) {
            await ctx.react('❌');
            await ctx.reply(`❌ IP lookup failed: ${e.message}`);
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🎬  MOVIE INFO
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'movie',
    aliases: ['film', 'imdb'],
    desc: 'Get movie information from OMDB',
    usage: 'movie <title>',
    category: 'search',
    handler: async (ctx) => {
        const title = ctx.args.join(' ');
        if (!title) return ctx.reply(`❌ Provide a movie title.\n\nExample: \`${config.BOT_PREFIX}movie Avengers\``);
        await ctx.react('⏳');
        try {
            const res = await axios.get(`https://www.omdbapi.com/?apikey=trilogy&t=${encodeURIComponent(title)}`);
            const m   = res.data;
            if (m.Response === 'False') throw new Error(m.Error || 'Not found');

            const caption =
                `*🎬 MOVIE INFO*\n${config.BOT_NAME}\n\n` +
                `🎦 *Title:*    ${m.Title}\n` +
                `📅 *Year:*     ${m.Year}\n` +
                `🎭 *Genre:*    ${m.Genre}\n` +
                `⏱️ *Runtime:*  ${m.Runtime}\n` +
                `🌍 *Country:*  ${m.Country}\n` +
                `🗣️ *Language:* ${m.Language}\n` +
                `⭐ *Rating:*   ${m.imdbRating}/10 (${m.imdbVotes} votes)\n` +
                `🏆 *Awards:*   ${m.Awards}\n` +
                `🎬 *Director:* ${m.Director}\n` +
                `👥 *Cast:*     ${m.Actors}\n\n` +
                `📖 *Plot:*\n${m.Plot}\n\n` +
                `◈ ${config.CHANNEL_NAME}`;

            if (m.Poster && m.Poster !== 'N/A') {
                await ctx.sock.sendMessage(ctx.from, { image: { url: m.Poster }, caption }, { quoted: ctx.m });
            } else {
                await ctx.reply(caption);
            }
            await ctx.react('✅');
        } catch (e) {
            await ctx.react('❌');
            await ctx.reply(`❌ Movie not found: ${e.message}`);
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🍳  RECIPE SEARCH
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'recipe',
    aliases: ['cook', 'food', 'meal'],
    desc: 'Search recipes for any dish',
    usage: 'recipe <dish>',
    category: 'lifestyle',
    handler: async (ctx) => {
        const dish = ctx.args.join(' ');
        if (!dish) return ctx.reply(`❌ Provide a dish name.\n\nExample: \`${config.BOT_PREFIX}recipe pasta\``);
        await ctx.react('⏳');
        try {
            const res = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dish)}`);
            const meals = res.data.meals;
            if (!meals) throw new Error('No recipe found');
            const m = meals[0];
            const ingredients = [];
            for (let i = 1; i <= 20; i++) {
                const ing = m[`strIngredient${i}`];
                const measure = m[`strMeasure${i}`];
                if (ing?.trim()) ingredients.push(`• ${measure?.trim()} ${ing}`);
            }
            const caption =
                `*🍳 RECIPE: ${m.strMeal.toUpperCase()}*\n${config.BOT_NAME}\n\n` +
                `🌍 *Origin:*  ${m.strArea}\n` +
                `🍽️ *Category:* ${m.strCategory}\n\n` +
                `*🧂 Ingredients:*\n${ingredients.slice(0,15).join('\n')}\n\n` +
                `*📖 Instructions (summary):*\n${m.strInstructions?.slice(0,400)}...\n\n` +
                `${m.strYoutube ? `▶️ *Video:* ${m.strYoutube}\n\n` : ''}` +
                `◈ ${config.CHANNEL_NAME}`;

            if (m.strMealThumb) {
                await ctx.sock.sendMessage(ctx.from, { image: { url: m.strMealThumb }, caption }, { quoted: ctx.m });
            } else {
                await ctx.reply(caption);
            }
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ No recipe found for that dish. Try another keyword.');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🐾  ANIMAL FACTS
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'animal',
    aliases: ['animalfact', 'creature'],
    desc: 'Get a random animal fact',
    usage: 'animal <name>  e.g. animal cat',
    category: 'fun',
    handler: async (ctx) => {
        const a = ctx.args[0]?.toLowerCase() || 'cat';
        await ctx.react('⏳');
        try {
            const res = await axios.get(`https://api.api-ninjas.com/v1/animals?name=${a}`, {
                headers: { 'X-Api-Key': 'demo' }
            });
            if (!res.data?.length) throw new Error('not found');
            const d = res.data[0];
            await ctx.reply(card(`🐾 ANIMAL — ${d.name.toUpperCase()}`,
                `🌍 *Locations:*  ${d.locations?.join(', ')}\n` +
                `🏷️ *Class:*      ${d.taxonomy?.class}\n` +
                `🍽️ *Diet:*       ${d.characteristics?.diet}\n` +
                `📏 *Lifespan:*   ${d.characteristics?.lifespan}\n` +
                `⚖️ *Weight:*     ${d.characteristics?.weight}\n` +
                `🔢 *Group:*      ${d.characteristics?.group_behavior}`));
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            const fallback = [`Cats sleep 12-16 hours a day.`, `Elephants are the only animals that can't jump.`, `A group of flamingos is called a flamboyance.`, `Octopuses have three hearts.`];
            await ctx.reply(card('🐾 RANDOM ANIMAL FACT', fallback[Math.floor(Math.random()*fallback.length)]));
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  📖  BIBLE VERSE
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'bible',
    aliases: ['verse', 'scripture'],
    desc: 'Get a Bible verse',
    usage: 'bible  |  bible John 3:16',
    category: 'religion',
    handler: async (ctx) => {
        const ref = ctx.args.join(' ') || 'random';
        await ctx.react('⏳');
        try {
            const url = ref === 'random'
                ? 'https://bible-api.com/?random=verse'
                : `https://bible-api.com/${encodeURIComponent(ref)}`;
            const res = await axios.get(url);
            const d   = res.data;
            await ctx.reply(card('📖 BIBLE VERSE',
                `📜 *${d.reference}*\n\n"${d.text?.trim()}"\n\n_King James Version_`));
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ Verse not found. Try: `bible John 3:16` or just `bible` for random.');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🕌  QURAN VERSE
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'quran',
    aliases: ['ayah', 'surah'],
    desc: 'Get a Quran verse',
    usage: 'quran <surah>:<ayah>  e.g. quran 2:255',
    category: 'religion',
    handler: async (ctx) => {
        const ref = ctx.args[0] || '1:1';
        const [s, a] = ref.split(':');
        await ctx.react('⏳');
        try {
            const [textRes, transRes] = await Promise.all([
                axios.get(`https://api.alquran.cloud/v1/ayah/${s}:${a}`),
                axios.get(`https://api.alquran.cloud/v1/ayah/${s}:${a}/en.asad`),
            ]);
            const arabic = textRes.data.data;
            const trans  = transRes.data.data;
            await ctx.reply(card('🕌 QURAN VERSE',
                `📜 *Surah ${arabic.surah.englishName} (${arabic.surah.name})*\n` +
                `*Ayah ${arabic.numberInSurah}*\n\n` +
                `🌙 _${arabic.text}_\n\n` +
                `📖 "${trans.text}"\n\n` +
                `_Translation: Muhammad Asad_`));
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ Verse not found. Usage: `quran 2:255` (surah:ayah)');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🤔  RIDDLE
// ════════════════════════════════════════════════════════════════
const RIDDLES = [
    { q: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", a: "An echo" },
    { q: "The more you take, the more you leave behind. What am I?", a: "Footsteps" },
    { q: "I have cities, but no houses live there. I have mountains, but no trees grow there. I have water, but no fish swim there. What am I?", a: "A map" },
    { q: "What can travel around the world while staying in a corner?", a: "A stamp" },
    { q: "I'm tall when I'm young and short when I'm old. What am I?", a: "A candle" },
    { q: "What has one eye but can't see?", a: "A needle" },
    { q: "What has hands but can't clap?", a: "A clock" },
    { q: "What gets wetter the more it dries?", a: "A towel" },
    { q: "I have keys but no locks. I have space but no room. You can enter but can't go inside. What am I?", a: "A keyboard" },
    { q: "Forward I'm heavy, backward I'm not. What am I?", a: "A ton" },
];

const riddleSession = new Map();

addCmd({
    name: 'riddle',
    aliases: ['puzzle'],
    desc: 'Get a riddle to solve',
    category: 'games',
    handler: async (ctx) => {
        const r = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
        riddleSession.set(ctx.from, r.a.toLowerCase());
        setTimeout(() => riddleSession.delete(ctx.from), 120_000);
        await ctx.reply(card('🤔 RIDDLE TIME!',
            `${r.q}\n\n💡 Reply with your answer!\n_(Answer expires in 2 minutes)_`));
    },
});

addCmd({
    name: 'riddleanswer',
    aliases: ['answer', 'ans'],
    desc: 'Answer the active riddle',
    category: 'games',
    handler: async (ctx) => {
        if (!riddleSession.has(ctx.from)) return ctx.reply(`❌ No active riddle! Start one with \`${config.BOT_PREFIX}riddle\``);
        const correct = riddleSession.get(ctx.from);
        const given   = ctx.text?.toLowerCase().trim();
        if (!given) return ctx.reply('❌ Please provide your answer!');
        riddleSession.delete(ctx.from);
        const isCorrect = given.includes(correct) || correct.includes(given);
        await ctx.react(isCorrect ? '🎉' : '😢');
        await ctx.reply(isCorrect
            ? card('🎉 CORRECT!', `Amazing! You got it right!\n\n✅ Answer: *${correct}*`)
            : card('😢 WRONG!', `Not quite!\n\n✅ Correct answer: *${correct}*`));
    },
});

// ════════════════════════════════════════════════════════════════
//  🌐  WIKIPEDIA SUMMARY
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'wiki',
    aliases: ['wikipedia', 'define'],
    desc: 'Get a Wikipedia summary of any topic',
    usage: 'wiki <topic>',
    category: 'search',
    handler: async (ctx) => {
        const topic = ctx.args.join(' ');
        if (!topic) return ctx.reply(`❌ Provide a topic.\n\nExample: \`${config.BOT_PREFIX}wiki Black Panther\``);
        await ctx.react('⏳');
        try {
            const res = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
            const d   = res.data;
            if (d.type === 'disambiguation') throw new Error('disambiguation');
            const text = d.extract?.slice(0, 800) + (d.extract?.length > 800 ? '...' : '');
            const caption =
                `*📚 WIKIPEDIA — ${d.title.toUpperCase()}*\n${config.BOT_NAME}\n\n` +
                `${text}\n\n` +
                `🔗 ${d.content_urls?.desktop?.page || ''}\n\n` +
                `◈ ${config.CHANNEL_NAME}`;
            if (d.thumbnail?.source) {
                await ctx.sock.sendMessage(ctx.from, { image: { url: d.thumbnail.source }, caption }, { quoted: ctx.m });
            } else {
                await ctx.reply(caption);
            }
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply(`❌ No Wikipedia article found for *${topic}*. Try a different keyword.`);
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  📏  UNIT CONVERTER
// ════════════════════════════════════════════════════════════════
const CONVERSIONS = {
    km_mi: v => v * 0.621371, mi_km: v => v * 1.60934,
    kg_lb: v => v * 2.20462, lb_kg: v => v * 0.453592,
    m_ft:  v => v * 3.28084, ft_m:  v => v * 0.3048,
    c_f:   v => (v * 9/5) + 32, f_c:  v => (v - 32) * 5/9,
    l_gal: v => v * 0.264172, gal_l: v => v * 3.78541,
    cm_in: v => v * 0.393701, in_cm: v => v * 2.54,
};

addCmd({
    name: 'convert',
    aliases: ['unitconvert', 'unit'],
    desc: 'Convert between units (length, weight, temp, volume)',
    usage: 'convert <value> <from> <to>  e.g. convert 100 km mi',
    category: 'tools',
    handler: async (ctx) => {
        const [val, from, to] = ctx.args;
        if (!val || !from || !to) return ctx.reply(
            `❌ *Usage:* \`${config.BOT_PREFIX}convert <value> <from> <to>\`\n\n` +
            `*Supported:* km↔mi, kg↔lb, m↔ft, c↔f, l↔gal, cm↔in\n` +
            `*Example:* \`convert 100 km mi\``);
        const key = `${from.toLowerCase()}_${to.toLowerCase()}`;
        const fn  = CONVERSIONS[key];
        if (!fn) return ctx.reply(`❌ Conversion *${from} → ${to}* not supported.\n\n*Supported:* km↔mi, kg↔lb, m↔ft, C↔F, L↔gal, cm↔in`);
        const result = fn(parseFloat(val)).toFixed(4);
        await ctx.reply(card('📏 UNIT CONVERTER',
            `📥 *Input:*  ${val} ${from.toUpperCase()}\n📤 *Output:* ${result} ${to.toUpperCase()}`));
    },
});

// ════════════════════════════════════════════════════════════════
//  ⏰  WORLD TIME
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'time',
    aliases: ['worldtime', 'timezone'],
    desc: 'Get current time in any timezone or city',
    usage: 'time <timezone>  e.g. time Africa/Nairobi',
    category: 'tools',
    handler: async (ctx) => {
        const tz = ctx.args.join('/') || config.TIME_ZONE;
        try {
            const moment = require('moment-timezone');
            if (!moment.tz.zone(tz)) throw new Error('Invalid timezone');
            const t = moment().tz(tz);
            await ctx.reply(card('⏰ WORLD TIME',
                `🕐 *Time:*     ${t.format('hh:mm:ss A')}\n` +
                `📅 *Date:*     ${t.format('dddd, DD MMMM YYYY')}\n` +
                `🌐 *Timezone:* ${tz}\n` +
                `📡 *UTC Offset:* ${t.format('Z')}`));
        } catch {
            await ctx.reply(`❌ Invalid timezone. Use format like: \`Africa/Nairobi\`, \`America/New_York\`, \`Europe/London\``);
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🎲  RANDOM NUMBER / DICE / COINFLIP
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'random',
    aliases: ['rand', 'rng'],
    desc: 'Generate a random number',
    usage: 'random <min> <max>  default: 1-100',
    category: 'fun',
    handler: async (ctx) => {
        const min = parseInt(ctx.args[0]) || 1;
        const max = parseInt(ctx.args[1]) || 100;
        if (min >= max) return ctx.reply('❌ Min must be less than max!');
        const result = Math.floor(Math.random() * (max - min + 1)) + min;
        await ctx.reply(card('🎲 RANDOM NUMBER',
            `🔢 *Range:*  ${min} — ${max}\n🎯 *Result:* *${result}*`));
    },
});

addCmd({
    name: 'dice',
    aliases: ['roll', 'rolldice'],
    desc: 'Roll dice',
    usage: 'dice  |  dice 2  (roll 2 dice)',
    category: 'fun',
    handler: async (ctx) => {
        const n = Math.min(parseInt(ctx.args[0]) || 1, 6);
        const dice = ['⚀','⚁','⚂','⚃','⚄','⚅'];
        const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * 6));
        const total = rolls.reduce((a,b) => a+b+2, 0);
        await ctx.reply(card('🎲 DICE ROLL',
            `${rolls.map(r => dice[r]).join(' ')}\n\n🎯 *Total:* ${total}`));
    },
});

addCmd({
    name: 'coinflip',
    aliases: ['coin', 'flip', 'toss'],
    desc: 'Flip a coin',
    category: 'fun',
    handler: async (ctx) => {
        const result = Math.random() < 0.5 ? '🪙 HEADS' : '🪙 TAILS';
        await ctx.reply(card('🪙 COIN FLIP', `Result: *${result}*`));
    },
});

// ════════════════════════════════════════════════════════════════
//  🧮  CALCULATOR
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'calc',
    aliases: ['calculate', 'math', 'eval'],
    desc: 'Evaluate a math expression',
    usage: 'calc <expression>  e.g. calc 2+2*10',
    category: 'tools',
    handler: async (ctx) => {
        const expr = ctx.args.join(' ').replace(/[^0-9+\-*/().,% ]/g, '');
        if (!expr) return ctx.reply(`❌ Provide a math expression.\n\nExample: \`${config.BOT_PREFIX}calc 15% of 200\``);
        try {
            // Handle percentage
            const cleaned = expr.replace(/(\d+)%\s*of\s*(\d+)/gi, '($1/100)*$2')
                                .replace(/(\d+)%/g, '($1/100)');
            // eslint-disable-next-line no-new-func
            const result = Function(`"use strict"; return (${cleaned})`)();
            if (!isFinite(result)) throw new Error('infinite');
            await ctx.reply(card('🧮 CALCULATOR',
                `📥 *Input:*  \`${expr}\`\n📤 *Result:* *${parseFloat(result.toFixed(10))}*`));
        } catch {
            await ctx.reply('❌ Invalid math expression. Only numbers and operators (+, -, *, /, %) allowed.');
        }
    },
});
