'use strict';
// ╭─────────────────────────────────────────╮
//   BLACK PANTHER MD  ·  religion.js
//   Bible & Quran lookups (ported from Vesper)
// ╰─────────────────────────────────────────╯

const axios      = require('axios');
const { addCmd } = require('../../guru/handlers/loader');

const BIBLE_BOOKS = [
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
    '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
    'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
    'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
    'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
    'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians',
    'Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians',
    '1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
    '1 John','2 John','3 John','Jude','Revelation',
];

addCmd({
    name: 'bible',
    desc: 'Look up a Bible passage. Example: bible John 3:16',
    usage: 'bible <book chapter:verse>',
    category: 'religion',
    handler: async (ctx) => {
        const ref = ctx.text?.trim();
        if (!ref) return ctx.reply(
            `📖 *Bible Lookup*\n\n` +
            `Usage: *${ctx.config.BOT_PREFIX}bible John 3:16*`
        );

        try {
            const { data } = await axios.get(
                `https://bible-api.com/${encodeURIComponent(ref)}`,
                { timeout: 15_000 }
            );
            if (!data?.verses?.length) {
                return ctx.reply(`❌ No verses found for *${ref}*.`);
            }
            const text =
                `*📖 The Holy Bible*\n` +
                `*${data.reference}*\n` +
                `_Translation:_ ${data.translation_name}\n` +
                `_Verses:_ ${data.verses.length}\n\n` +
                data.text.trim();
            await ctx.reply(text);
        } catch (err) {
            await ctx.reply(`❌ Bible lookup failed: ${err.message}`);
        }
    },
});

addCmd({
    name: 'biblelist',
    aliases: ['biblebooks'],
    desc: 'List all books of the Bible.',
    category: 'religion',
    handler: async (ctx) => {
        const ot = BIBLE_BOOKS.slice(0, 39).map((b, i) => `${i + 1}. ${b}`).join('\n');
        const nt = BIBLE_BOOKS.slice(39).map((b, i) => `${i + 1}. ${b}`).join('\n');
        await ctx.reply(
            `📜 *Old Testament*\n${ot}\n\n` +
            `✝️ *New Testament*\n${nt}`
        );
    },
});

addCmd({
    name: 'quran',
    desc: 'Get a Quran verse. Example: quran 2:255',
    usage: 'quran <surah:ayah>',
    category: 'religion',
    handler: async (ctx) => {
        const ref = ctx.text?.trim();
        if (!ref || !/^\d+:\d+$/.test(ref)) {
            return ctx.reply(
                `🕌 *Quran Lookup*\n\n` +
                `Usage: *${ctx.config.BOT_PREFIX}quran 2:255*`
            );
        }
        try {
            const { data } = await axios.get(
                `https://api.alquran.cloud/v1/ayah/${ref}/editions/quran-uthmani,en.asad`,
                { timeout: 15_000 }
            );
            if (data?.code !== 200) throw new Error('Verse not found');
            const arabic  = data.data[0];
            const english = data.data[1];
            await ctx.reply(
                `*🕌 The Holy Quran*\n` +
                `*${arabic.surah.englishName}* (${arabic.surah.name})\n` +
                `Ayah ${arabic.numberInSurah} · Juz ${arabic.juz}\n\n` +
                `${arabic.text}\n\n` +
                `_${english.text}_`
            );
        } catch (err) {
            await ctx.reply(`❌ Quran lookup failed: ${err.message}`);
        }
    },
});
