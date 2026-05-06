'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  gmdFunctions3.js  (Search & APIs)
//  👑  Owner : GuruTech  |  📞 +254105521300
//  🔍  Weather · News · Currency · Crypto · Dictionary · Lyrics
//  🎬  Movie · Sports · Anime · GitHub · Color · Font · More
// ╚══════════════════════════════════════════════════════════════╝

const axios  = require('axios');
const config = require('../config/settings');
const { gmdBanner, gmdTable, gmdList, gmdProgress, fmtBytes,
        fmtDuration, truncate, pickRandom } = require('./gmdFunctions');

const TIMEOUT = 15000;
const get     = (url, opts = {}) => axios.get(url, { timeout: TIMEOUT, ...opts }).then(r => r.data);

// ═══════════════════════════════════════════════════════════════
//  🌦️  WEATHER  (wttr.in — no API key needed)
// ═══════════════════════════════════════════════════════════════

async function fetchWeather(city) {
    const data = await get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const cur  = data.current_condition[0];
    const area = data.nearest_area[0];
    const fc   = data.weather;

    const emoji = weatherEmoji(cur.weatherCode);
    const rows  = [
        ['🌡️  Temp',    `${cur.temp_C}°C  /  ${cur.temp_F}°F`],
        ['💧 Humidity', `${cur.humidity}%`],
        ['💨 Wind',     `${cur.windspeedKmph} km/h`],
        ['☁️  Sky',      cur.weatherDesc[0].value],
        ['👁️  Visibility', `${cur.visibility} km`],
        ['🌡️  Feels Like', `${cur.FeelsLikeC}°C`],
        ['🌅 Sunrise',  fc[0]?.hourly?.[0]?.weatherDesc?.[0]?.value || 'N/A'],
    ];

    const title = `${emoji} Weather — ${area.areaName[0].value}, ${area.country[0].value}`;
    const table = gmdTable(title, rows, config.BOT_NAME);

    // 3-day forecast
    let forecast = '\n\n*📅 3-Day Forecast*\n' + '─'.repeat(30) + '\n';
    fc.slice(0, 3).forEach(day => {
        const d = day.date;
        const hi = day.maxtempC, lo = day.mintempC;
        const desc = day.hourly[4]?.weatherDesc?.[0]?.value || '';
        forecast += `📆 *${d}*  ${weatherEmoji(day.hourly[4]?.weatherCode)}  ${lo}°C – ${hi}°C  _${desc}_\n`;
    });

    return table + forecast;
}

function weatherEmoji(code) {
    code = parseInt(code);
    if (code === 113) return '☀️';
    if (code <= 116) return '⛅';
    if (code <= 122) return '☁️';
    if (code <= 143) return '🌫️';
    if (code <= 176) return '🌦️';
    if (code <= 200) return '🌧️';
    if (code <= 260) return '❄️';
    if (code <= 299) return '🌨️';
    if (code <= 399) return '🌧️';
    if (code <= 499) return '🌨️';
    return '⛈️';
}

// ═══════════════════════════════════════════════════════════════
//  📰  NEWS  (GNews free tier)
// ═══════════════════════════════════════════════════════════════

async function fetchNews(topic = 'world', country = 'KE') {
    try {
        const url  = `https://gnews.io/api/v4/top-headlines?topic=${topic}&lang=en&country=${country}&max=5&apikey=free`;
        const data = await get(url);
        const articles = data?.articles || [];
        if (!articles.length) return '❌ No news found for that topic.';

        let out = gmdBanner(`📰 Top ${topic.toUpperCase()} News`, [], config.BOT_NAME) + '\n\n';
        articles.forEach((a, i) => {
            out += `*${i + 1}.* ${a.title}\n`;
            out += `📅 _${new Date(a.publishedAt).toLocaleDateString()}_\n`;
            out += `🔗 ${a.url}\n\n`;
        });
        return out.trim();
    } catch {
        return '❌ Could not fetch news right now.';
    }
}

// ═══════════════════════════════════════════════════════════════
//  💱  CURRENCY CONVERTER  (ExchangeRate-API free)
// ═══════════════════════════════════════════════════════════════

async function fetchCurrency(amount, from, to) {
    try {
        const data   = await get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
        const rate   = data?.rates?.[to.toUpperCase()];
        if (!rate) return `❌ Unknown currency: *${to.toUpperCase()}*`;
        const result = (parseFloat(amount) * rate).toFixed(4);
        const rows   = [
            ['💵 Amount',   `${amount} ${from.toUpperCase()}`],
            ['📈 Rate',     `1 ${from.toUpperCase()} = ${rate} ${to.toUpperCase()}`],
            ['💰 Result',   `${result} ${to.toUpperCase()}`],
            ['📅 Date',     data.date || 'Today'],
        ];
        return gmdTable('💱 Currency Converter', rows, config.BOT_NAME);
    } catch {
        return '❌ Could not fetch exchange rate.';
    }
}

// ═══════════════════════════════════════════════════════════════
//  🪙  CRYPTO PRICES  (CoinGecko free)
// ═══════════════════════════════════════════════════════════════

async function fetchCrypto(coin = 'bitcoin') {
    try {
        const data = await get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,kes&include_24hr_change=true&include_market_cap=true`
        );
        const c    = data?.[coin.toLowerCase()];
        if (!c) return `❌ Coin *${coin}* not found.`;

        const change = c.usd_24h_change?.toFixed(2);
        const arrow  = change >= 0 ? '📈' : '📉';
        const rows   = [
            ['🪙 Coin',       coin.toUpperCase()],
            ['💵 USD Price',  `$${c.usd?.toLocaleString()}`],
            ['🇰🇪 KES Price',  `Ksh ${c.kes?.toLocaleString()}`],
            [`${arrow} 24h`,  `${change}%`],
            ['📊 Market Cap', `$${(c.usd_market_cap / 1e9).toFixed(2)}B`],
        ];
        return gmdTable(`🪙 ${coin.toUpperCase()} Price`, rows, config.BOT_NAME);
    } catch {
        return '❌ Could not fetch crypto price.';
    }
}

// ═══════════════════════════════════════════════════════════════
//  📖  DICTIONARY  (Free Dictionary API)
// ═══════════════════════════════════════════════════════════════

async function fetchDictionary(word) {
    try {
        const data  = await get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        const entry = data?.[0];
        if (!entry) return `❌ No definition found for *${word}*.`;

        const phonetic = entry.phonetic || entry.phonetics?.[0]?.text || '';
        let out = gmdBanner(`📖 Dictionary: ${entry.word}`, [
            `🔊 Pronunciation: ${phonetic}`,
        ], config.BOT_NAME) + '\n\n';

        entry.meanings?.slice(0, 3).forEach(m => {
            out += `*${m.partOfSpeech}*\n`;
            m.definitions?.slice(0, 2).forEach((d, i) => {
                out += `  ${i + 1}. ${truncate(d.definition, 120)}\n`;
                if (d.example) out += `     _"${truncate(d.example, 80)}"_\n`;
            });
            if (m.synonyms?.length) out += `  🔁 Synonyms: ${m.synonyms.slice(0, 5).join(', ')}\n`;
            out += '\n';
        });
        return out.trim();
    } catch {
        return `❌ Word *${word}* not found in dictionary.`;
    }
}

// ═══════════════════════════════════════════════════════════════
//  🎵  LYRICS  (lyrics.ovh — free)
// ═══════════════════════════════════════════════════════════════

async function fetchLyrics(artist, title) {
    try {
        const data = await get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
        if (!data?.lyrics) return '❌ Lyrics not found.';
        const lyrics = data.lyrics.trim().slice(0, 3500);
        const header = gmdBanner(`🎵 ${title}`, [`🎤 Artist: ${artist}`], config.BOT_NAME);
        return `${header}\n\n${lyrics}${data.lyrics.length > 3500 ? '\n\n_...truncated_' : ''}`;
    } catch {
        return '❌ Could not fetch lyrics.';
    }
}

// ═══════════════════════════════════════════════════════════════
//  🎬  MOVIE INFO  (OMDb — free API key needed but works with `free`)
// ═══════════════════════════════════════════════════════════════

async function fetchMovie(title) {
    try {
        const data = await get(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=trilogy`);
        if (data.Response === 'False') return `❌ Movie *${title}* not found.`;

        const rows = [
            ['🎬 Title',    data.Title],
            ['📅 Year',     data.Year],
            ['🎭 Genre',    data.Genre],
            ['⏱️  Runtime',  data.Runtime],
            ['⭐ Rating',   `${data.imdbRating}/10 (IMDb)`],
            ['🌍 Language', data.Language],
            ['🎥 Director', data.Director],
            ['👥 Actors',   truncate(data.Actors, 35)],
            ['🏆 Awards',   truncate(data.Awards, 35)],
        ];
        let out = gmdTable(`🎬 ${data.Title} (${data.Year})`, rows, config.BOT_NAME);
        out    += `\n\n📝 *Plot:*\n${truncate(data.Plot, 300)}`;
        if (data.Poster && data.Poster !== 'N/A') out += `\n\n🖼️ Poster: ${data.Poster}`;
        return out;
    } catch {
        return '❌ Could not fetch movie info.';
    }
}

// ═══════════════════════════════════════════════════════════════
//  😂  MEME  (Meme API — free)
// ═══════════════════════════════════════════════════════════════

async function fetchMeme(subreddit = 'memes') {
    try {
        const data = await get(`https://meme-api.com/gimme/${subreddit}`);
        return {
            title: data.title,
            url:   data.url,
            ups:   data.ups,
            sub:   data.subreddit,
        };
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
//  🌍  COUNTRY INFO  (RestCountries)
// ═══════════════════════════════════════════════════════════════

async function fetchCountry(name) {
    try {
        const data = await get(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`);
        const c    = data?.[0];
        if (!c) return `❌ Country *${name}* not found.`;

        const currencies = Object.values(c.currencies || {}).map(x => `${x.name} (${x.symbol})`).join(', ');
        const languages  = Object.values(c.languages || {}).join(', ');
        const dialCode   = `+${c.idd?.root?.replace('+', '')}${c.idd?.suffixes?.[0] || ''}`;

        const rows = [
            ['🏳️  Flag',      c.flag || c.emoji || ''],
            ['🌍 Region',    c.region],
            ['🏙️  Capital',   c.capital?.[0] || 'N/A'],
            ['👥 Population', c.population?.toLocaleString()],
            ['💰 Currency',  currencies],
            ['🗣️  Language',  languages],
            ['📞 Dial Code', dialCode],
            ['🚗 Drive Side', c.car?.side || 'N/A'],
            ['🕐 Timezones', c.timezones?.[0] || 'N/A'],
        ];

        const flag = c.flags?.png || c.flags?.svg || null;
        const text = gmdTable(`🌍 ${c.name.common}`, rows, config.BOT_NAME);
        return { text, flag };
    } catch {
        return { text: `❌ Country not found.`, flag: null };
    }
}

// ═══════════════════════════════════════════════════════════════
//  🐙  GITHUB USER  (GitHub API — free)
// ═══════════════════════════════════════════════════════════════

async function fetchGithub(username) {
    try {
        const data = await get(`https://api.github.com/users/${username}`);
        const rows = [
            ['👤 Name',      data.name || 'N/A'],
            ['🐙 Username',  data.login],
            ['🏢 Company',   data.company || 'N/A'],
            ['📍 Location',  data.location || 'N/A'],
            ['📝 Bio',       truncate(data.bio || 'N/A', 35)],
            ['📦 Repos',     data.public_repos],
            ['⭐ Stars',     data.public_gists],
            ['👥 Followers', data.followers],
            ['➡️  Following', data.following],
            ['📅 Joined',    new Date(data.created_at).toLocaleDateString()],
        ];
        return {
            text:   gmdTable(`🐙 GitHub: @${username}`, rows, config.BOT_NAME),
            avatar: data.avatar_url,
            url:    data.html_url,
        };
    } catch {
        return { text: `❌ GitHub user *${username}* not found.`, avatar: null, url: null };
    }
}

// ═══════════════════════════════════════════════════════════════
//  📱  PHONE INFO  (numverify-style free)
// ═══════════════════════════════════════════════════════════════

async function fetchPhoneInfo(number) {
    try {
        const clean = number.replace(/\D/g, '');
        // Basic prefix detection (no API needed)
        const prefixMap = {
            '254': { country: 'Kenya 🇰🇪',     carriers: { '7': 'Safaricom', '1': 'Airtel', '0': 'Telkom' } },
            '255': { country: 'Tanzania 🇹🇿',  carriers: {} },
            '256': { country: 'Uganda 🇺🇬',    carriers: {} },
            '27':  { country: 'South Africa 🇿🇦', carriers: {} },
            '234': { country: 'Nigeria 🇳🇬',   carriers: {} },
            '1':   { country: 'USA/Canada 🇺🇸', carriers: {} },
            '44':  { country: 'UK 🇬🇧',        carriers: {} },
            '91':  { country: 'India 🇮🇳',     carriers: {} },
        };

        let country = 'Unknown', carrier = 'Unknown';
        for (const [prefix, info] of Object.entries(prefixMap)) {
            if (clean.startsWith(prefix)) {
                country = info.country;
                const sub = clean[prefix.length];
                carrier = info.carriers[sub] || 'Unknown';
                break;
            }
        }

        const rows = [
            ['📞 Number',  `+${clean}`],
            ['🌍 Country', country],
            ['📡 Carrier', carrier],
            ['🔢 Length',  `${clean.length} digits`],
        ];
        return gmdTable('📱 Phone Info', rows, config.BOT_NAME);
    } catch {
        return '❌ Could not analyse number.';
    }
}

// ═══════════════════════════════════════════════════════════════
//  🎨  COLOR INFO  (thecolorapi.com — free)
// ═══════════════════════════════════════════════════════════════

async function fetchColor(hex) {
    try {
        const clean = hex.replace('#', '');
        const data  = await get(`https://www.thecolorapi.com/id?hex=${clean}`);
        const rows  = [
            ['🎨 Name',  data.name?.value || 'Unknown'],
            ['#️⃣  HEX',   `#${clean.toUpperCase()}`],
            ['🔴 RGB',   `${data.rgb?.r}, ${data.rgb?.g}, ${data.rgb?.b}`],
            ['🌊 HSL',   `${data.hsl?.h}°, ${data.hsl?.s}%, ${data.hsl?.l}%`],
            ['🖼️  Image', data.image?.bare || ''],
        ];
        return {
            text:  gmdTable('🎨 Color Info', rows, config.BOT_NAME),
            image: data.image?.bare || null,
        };
    } catch {
        return { text: '❌ Invalid hex color.', image: null };
    }
}

// ═══════════════════════════════════════════════════════════════
//  ✂️  TEXT TOOLS (fancy fonts, encode/decode)
// ═══════════════════════════════════════════════════════════════

function toBold(str) {
    const map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bold = '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵'.split('');
    return str.split('').map(c => { const i = map.indexOf(c); return i >= 0 ? bold[i] : c; }).join('');
}

function toItalic(str) {
    return str.replace(/[a-zA-Z]/g, c => String.fromCodePoint(
        c >= 'a' && c <= 'z' ? 0x1D44E + c.charCodeAt(0) - 97 :
        0x1D434 + c.charCodeAt(0) - 65));
}

function toSmallCaps(str) {
    const map = { a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',
                  l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',
                  w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ' };
    return str.toLowerCase().split('').map(c => map[c] || c).join('');
}

function toFlip(str) {
    const map = { a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',
                  l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',
                  w:'ʍ',x:'x',y:'ʎ',z:'z' };
    return str.split('').reverse().map(c => map[c.toLowerCase()] || c).join('');
}

function toMock(str) {
    return str.split('').map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join('');
}

function toReverse(str) {
    return str.split('').reverse().join('');
}

// ═══════════════════════════════════════════════════════════════
//  🌐  IP INFO  (ip-api.com — free)
// ═══════════════════════════════════════════════════════════════

async function fetchIPInfo(ip) {
    try {
        const data = await get(`http://ip-api.com/json/${ip}`);
        if (data.status !== 'success') return '❌ Invalid IP address.';
        const rows = [
            ['🌐 IP',       data.query],
            ['🌍 Country',  `${data.country} (${data.countryCode})`],
            ['🏙️  City',     data.city],
            ['📍 Region',   data.regionName],
            ['📮 ZIP',      data.zip || 'N/A'],
            ['🕐 Timezone', data.timezone],
            ['📡 ISP',      data.isp],
            ['🏢 Org',      data.org || 'N/A'],
            ['📍 Lat/Lon',  `${data.lat}, ${data.lon}`],
        ];
        return gmdTable(`🌐 IP Info: ${ip}`, rows, config.BOT_NAME);
    } catch {
        return '❌ Could not fetch IP info.';
    }
}

// ═══════════════════════════════════════════════════════════════
//  🍜  FOOD RECIPE  (TheMealDB — free)
// ═══════════════════════════════════════════════════════════════

async function fetchRecipe(name) {
    try {
        const data = await get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`);
        const meal = data?.meals?.[0];
        if (!meal) return `❌ No recipe found for *${name}*.`;

        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ing  = meal[`strIngredient${i}`];
            const meas = meal[`strMeasure${i}`];
            if (ing && ing.trim()) ingredients.push(`${meas?.trim() || ''} ${ing.trim()}`.trim());
        }

        let out = gmdBanner(`🍜 Recipe: ${meal.strMeal}`, [
            `🌍 Origin: ${meal.strArea}`,
            `🏷️  Category: ${meal.strCategory}`,
        ], config.BOT_NAME);
        out += `\n\n*🥘 Ingredients:*\n${ingredients.map(i => `◈ ${i}`).join('\n')}`;
        out += `\n\n*👨‍🍳 Instructions:*\n${truncate(meal.strInstructions, 600)}`;
        if (meal.strYoutube) out += `\n\n🎬 Video: ${meal.strYoutube}`;

        return { text: out, thumb: meal.strMealThumb };
    } catch {
        return { text: '❌ Could not fetch recipe.', thumb: null };
    }
}

// ═══════════════════════════════════════════════════════════════
//  📦  EXPORTS
// ═══════════════════════════════════════════════════════════════
module.exports = {
    // Info / Search
    fetchWeather,
    fetchNews,
    fetchCurrency,
    fetchCrypto,
    fetchDictionary,
    fetchLyrics,
    fetchMovie,
    fetchMeme,
    fetchCountry,
    fetchGithub,
    fetchPhoneInfo,
    fetchColor,
    fetchIPInfo,
    fetchRecipe,
    // Text tools
    toBold, toItalic, toSmallCaps, toFlip, toMock, toReverse,
};
