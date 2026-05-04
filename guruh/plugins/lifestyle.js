'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  lifestyle.js  (2026 Design)
//  💫  Horoscope · Love Calc · BMI · Age · Zodiac · Motivate
//  🏋️  Fitness · Sleep · Water · Affirmation · Personality
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd } = require('../../guru/handlers/loader');
const axios      = require('axios');
const config     = require('../../guru/config/settings');
const moment     = require('moment-timezone');
const { pickRandom } = require('../../guru/utils/gmdFunctions');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

function now(fmt) { return moment().tz(config.TIME_ZONE).format(fmt); }

function card(title, lines, footer = config.BOT_NAME) {
    let out = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
    out    += `┃  ${title}\n`;
    out    += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
    for (const l of lines) out += `  ${l}\n`;
    out    += `\n_© ${footer}_`;
    return out;
}

// ═══════════════════════════════════════════════════════════════
//  ♈  HOROSCOPE
// ═══════════════════════════════════════════════════════════════

const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo',
               'libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const SIGN_EMOJI = {
    aries:'♈',taurus:'♉',gemini:'♊',cancer:'♋',leo:'♌',virgo:'♍',
    libra:'♎',scorpio:'♏',sagittarius:'♐',capricorn:'♑',aquarius:'♒',pisces:'♓',
};

addCmd({
    name: 'horoscope',
    aliases: ['horo', 'zodiac'],
    desc: 'Get your daily horoscope',
    usage: 'horoscope <sign>  e.g. horoscope leo',
    category: 'lifestyle',
    handler: async (ctx) => {
        const sign = ctx.args[0]?.toLowerCase();
        if (!sign || !SIGNS.includes(sign)) {
            return ctx.reply(
                card('♈ *H O R O S C O P E*',
                    ['❌ Invalid zodiac sign.', '',
                     '🔮 Available signs:',
                     SIGNS.map(s => `  ${SIGN_EMOJI[s]} ${s}`).join('\n'),
                    ],
                    config.BOT_NAME
                )
            );
        }

        await ctx.react('🔮');
        try {
            const res  = await axios.get(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=TODAY`, { timeout: 10000 });
            const data = res.data?.data;
            const text = data?.horoscope_data || 'The stars are aligning for you today!';
            const date = data?.date || now('DD MMM YYYY');
            const emoji = SIGN_EMOJI[sign];

            await ctx.reply(
                card(`${emoji} *${sign.toUpperCase()} — Daily Horoscope*`,
                    [`📅 Date   ›  *${date}*`, '',
                     `✨ ${text}`, '',
                     `💫 _Trust the universe today_`,
                    ],
                    config.BOT_NAME
                )
            );
            await ctx.react('✅');
        } catch {
            const fallback = [
                'Today is a great day to pursue your goals with confidence.',
                'The stars are aligned in your favour. Take that bold step!',
                'Patience is your superpower today. Good things are coming.',
                'Your intuition is sharp today. Trust your gut feelings.',
                'A positive attitude will attract amazing opportunities your way.',
                'Focus on self-care today and let the universe handle the rest.',
            ];
            await ctx.reply(
                card(`${SIGN_EMOJI[sign]} *${sign.toUpperCase()} — Daily Horoscope*`,
                    [`📅 Date › *${now('DD MMM YYYY')}*`, '', `✨ ${pickRandom(fallback)}`],
                    config.BOT_NAME
                )
            );
            await ctx.react('✅');
        }
    },
});

// ═══════════════════════════════════════════════════════════════
//  💕  LOVE CALCULATOR
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'lovecalc',
    aliases: ['love', 'ship', 'match'],
    desc: 'Calculate love compatibility between two people',
    usage: 'lovecalc <name1> & <name2>',
    category: 'lifestyle',
    handler: async (ctx) => {
        const input = ctx.text || '';
        const parts = input.split(/\s*[&+]\s*/);
        const name1 = parts[0]?.trim() || ctx.pushName;
        const name2 = parts[1]?.trim();

        if (!name2) return ctx.reply(`❌ Format: \`${config.BOT_PREFIX}lovecalc Name1 & Name2\``);

        await ctx.react('💘');

        // Deterministic score based on names
        const hash = [...(name1 + name2).toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0);
        const score = (hash % 41) + 60; // 60–100 range for fun
        const bar   = '❤️'.repeat(Math.round(score / 10)) + '🖤'.repeat(10 - Math.round(score / 10));
        let verdict;
        if (score >= 90) verdict = '🔥 *SOULMATES!* Perfect match made in heaven!';
        else if (score >= 80) verdict = '💞 *GREAT MATCH!* Amazing chemistry!';
        else if (score >= 70) verdict = '💛 *GOOD MATCH!* Worth exploring further.';
        else verdict              = '💙 *GROWING MATCH!* Patience will unlock true love.';

        await ctx.reply(
            card('💕 *L O V E  C A L C U L A T O R*',
                [`👤 Person 1  ›  *${name1}*`,
                 `👤 Person 2  ›  *${name2}*`,
                 '',
                 `💖 Score    ›  *${score}%*`,
                 `${bar}`,
                 '',
                 verdict,
                ],
                config.BOT_NAME
            )
        );
        await ctx.react('💘');
    },
});

// ═══════════════════════════════════════════════════════════════
//  🏋️  BMI CALCULATOR
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'bmi',
    desc: 'Calculate your Body Mass Index',
    usage: 'bmi <weight_kg> <height_cm>',
    category: 'lifestyle',
    handler: async (ctx) => {
        const [weight, height] = ctx.args.map(Number);
        if (!weight || !height || weight <= 0 || height <= 0)
            return ctx.reply(`❌ Usage: \`${config.BOT_PREFIX}bmi 70 175\` (weight in kg, height in cm)`);

        const h   = height / 100;
        const bmi = (weight / (h * h)).toFixed(1);
        let cat, tip;

        if (bmi < 18.5)       { cat = '⚠️ *Underweight*';   tip = 'Increase calorie intake with nutrient-rich foods.'; }
        else if (bmi < 25)    { cat = '✅ *Normal Weight*';  tip = 'Great job! Maintain your healthy lifestyle.'; }
        else if (bmi < 30)    { cat = '⚠️ *Overweight*';    tip = 'Consider more exercise and a balanced diet.'; }
        else                  { cat = '🔴 *Obese*';          tip = 'Consult a healthcare professional for guidance.'; }

        const bar   = Math.min(Math.round(bmi), 40);
        const fill  = Math.round(bar / 4);
        const prog  = '▰'.repeat(fill) + '▱'.repeat(10 - fill);

        await ctx.reply(
            card('🏋️ *B M I  C A L C U L A T O R*',
                [`⚖️  Weight    ›  *${weight} kg*`,
                 `📏 Height    ›  *${height} cm*`,
                 `📊 BMI       ›  *${bmi}*`,
                 `${prog}`,
                 `🏷️  Category  ›  ${cat}`,
                 '',
                 `💡 _${tip}_`,
                ],
                config.BOT_NAME
            )
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  🎂  AGE CALCULATOR
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'age',
    desc: 'Calculate your exact age',
    usage: 'age <DD/MM/YYYY>',
    category: 'lifestyle',
    handler: async (ctx) => {
        const input = ctx.args[0];
        if (!input) return ctx.reply(`❌ Usage: \`${config.BOT_PREFIX}age 15/08/2000\``);

        const dob = moment(input, ['DD/MM/YYYY', 'D/M/YYYY', 'YYYY-MM-DD'], true);
        if (!dob.isValid()) return ctx.sock.sendMessage(ctx.from, { text: '❌ Invalid date format. Use DD/MM/YYYY', contextInfo: channelCtx() }, { quoted: ctx.m });

        const today = moment();
        if (dob.isAfter(today)) return ctx.sock.sendMessage(ctx.from, { text: '❌ Date of birth cannot be in the future!', contextInfo: channelCtx() }, { quoted: ctx.m });

        const years  = today.diff(dob, 'years');
        dob.add(years, 'years');
        const months = today.diff(dob, 'months');
        dob.add(months, 'months');
        const days   = today.diff(dob, 'days');

        const totalDays  = today.diff(moment(input, 'DD/MM/YYYY'), 'days');
        const nextBday   = moment(input, 'DD/MM/YYYY').year(today.year());
        if (nextBday.isBefore(today)) nextBday.add(1, 'year');
        const daysLeft   = nextBday.diff(today, 'days');

        await ctx.reply(
            card('🎂 *A G E  C A L C U L A T O R*',
                [`📅 Date of Birth  ›  *${moment(input, 'DD/MM/YYYY').format('DD MMM YYYY')}*`,
                 '',
                 `🎉 Age  ›  *${years} yrs, ${months} mos, ${days} days*`,
                 `📆 Total Days Lived  ›  *${totalDays.toLocaleString()} days*`,
                 `🎁 Next Birthday  ›  *${daysLeft} day(s) away*`,
                 '',
                 years < 18 ? '🌱 _Young and growing — enjoy every moment!_' :
                 years < 30 ? '🔥 _In your prime — make the most of it!_' :
                 years < 50 ? '💪 _Experience is your greatest asset!_' :
                              '🦉 _Wisdom, grace and strength — truly inspiring!_',
                ],
                config.BOT_NAME
            )
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  💧  WATER INTAKE CALCULATOR
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'water',
    aliases: ['hydration', 'h2o'],
    desc: 'Calculate daily water intake recommendation',
    usage: 'water <weight_kg>',
    category: 'lifestyle',
    handler: async (ctx) => {
        const weight = Number(ctx.args[0]);
        if (!weight || weight <= 0) return ctx.reply(`❌ Usage: \`${config.BOT_PREFIX}water 70\` (your weight in kg)`);

        const liters     = (weight * 0.033).toFixed(2);
        const glasses    = Math.round(liters / 0.25);
        const hour       = parseInt(now('H'));
        const soFar      = Math.round((hour / 24) * glasses);
        const pct        = Math.min(Math.round((soFar / glasses) * 10), 10);
        const prog       = '💧'.repeat(pct) + '🩶'.repeat(10 - pct);

        await ctx.reply(
            card('💧 *H Y D R A T I O N  T R A C K E R*',
                [`⚖️  Your Weight  ›  *${weight} kg*`,
                 '',
                 `🥤 Daily Target  ›  *${liters} litres*`,
                 `🥛 = *${glasses} glasses* of 250ml`,
                 '',
                 `🕐 Current Time  ›  *${now('hh:mm A')}*`,
                 `📊 ${prog}`,
                 `   _Suggested so far: ~${soFar} glass(es)_`,
                 '',
                 `💡 _Drink water regularly to stay healthy & energised!_`,
                ],
                config.BOT_NAME
            )
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  💬  DAILY AFFIRMATION
// ═══════════════════════════════════════════════════════════════

const AFFIRMATIONS = [
    'I am capable of achieving anything I set my mind to. 🌟',
    'I radiate positivity and attract great opportunities. ✨',
    'Every day I grow stronger, wiser, and more resilient. 💪',
    'I am worthy of love, success, and all good things. 💖',
    'My potential is limitless and my future is bright. 🔥',
    'I choose joy, peace, and abundance in all areas of my life. 🌈',
    'I trust the process and know that everything works out for me. 🙏',
    'I am the architect of my own destiny. 🏛️',
    'I embrace challenges as opportunities for growth. 🌱',
    'Today I will be the best version of myself. 👑',
    'I am surrounded by love and everything is fine. 💛',
    'My hard work and dedication always pay off. 🎯',
    'I deserve all the good things life has to offer. 🎁',
    'I am a magnet for miracles and positive experiences. 🧲',
    'Happiness flows through me like a river. 🌊',
];

addCmd({
    name: 'affirmation',
    aliases: ['affirm', 'mantra', 'positive'],
    desc: 'Get a daily positive affirmation',
    category: 'lifestyle',
    handler: async (ctx) => {
        await ctx.reply(
            card('🌟 *D A I L Y  A F F I R M A T I O N*',
                [`📅 ${now('dddd, DD MMM YYYY')}`, '',
                 `💬 _"${pickRandom(AFFIRMATIONS)}"_`, '',
                 `🌈 _Start your day with this powerful truth!_`,
                ],
                config.BOT_NAME
            )
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  😴  SLEEP CALCULATOR
// ═══════════════════════════════════════════════════════════════

addCmd({
    name: 'sleep',
    aliases: ['bedtime', 'sleeptime'],
    desc: 'Calculate best bedtime or wake-up times',
    usage: 'sleep <HH:MM>  — provide wake-up time to get bedtimes',
    category: 'lifestyle',
    handler: async (ctx) => {
        const input = ctx.args[0];
        if (!input) {
            const m = moment();
            const times = [90, 180, 270, 360, 450, 540].map(min => {
                return moment().add(min + 14, 'minutes').format('hh:mm A');
            });
            return ctx.reply(
                card('😴 *S L E E P  C A L C U L A T O R*',
                    [`🕐 It is currently *${m.format('hh:mm A')}*`, '',
                     `🌙 Recommended bedtimes:`,
                     `  ➤  ${times[0]}  _(1.5 hrs • 1 cycle)_`,
                     `  ➤  ${times[1]}  _(3 hrs  • 2 cycles)_`,
                     `  ➤  ${times[2]}  _(4.5 hrs • 3 cycles)_`,
                     `  ➤  ${times[3]}  _(6 hrs  • 4 cycles)_`,
                     `  ➤  ${times[4]}  _(7.5 hrs • 5 cycles)_`,
                     `  ➤  ${times[5]}  _(9 hrs  • 6 cycles)_`,
                     '',
                     `💡 _Each sleep cycle = 90 minutes_`,
                     `💡 _Fall-asleep time: ~14 minutes_`,
                    ],
                    config.BOT_NAME
                )
            );
        }

        const wake = moment(input, ['HH:mm', 'hh:mm A', 'h:mm A']);
        if (!wake.isValid()) return ctx.sock.sendMessage(ctx.from, { text: '❌ Invalid time format. Use HH:MM  e.g. `.sleep 06:30`', contextInfo: channelCtx() }, { quoted: ctx.m });
        if (wake.isBefore(moment())) wake.add(1, 'day');

        const times = [90, 180, 270, 360, 450, 540].map(min => {
            return wake.clone().subtract(min + 14, 'minutes').format('hh:mm A');
        }).reverse();

        await ctx.reply(
            card('😴 *S L E E P  C A L C U L A T O R*',
                [`⏰ Wake-up time: *${wake.format('hh:mm A')}*`, '',
                 `🛌 Go to bed at:`,
                 `  ➤  ${times[0]}  _(9 hrs • 6 cycles)_`,
                 `  ➤  ${times[1]}  _(7.5 hrs • 5 cycles)_`,
                 `  ➤  ${times[2]}  _(6 hrs • 4 cycles)_`,
                 `  ➤  ${times[3]}  _(4.5 hrs • 3 cycles)_`,
                 `  ➤  ${times[4]}  _(3 hrs • 2 cycles)_`,
                 `  ➤  ${times[5]}  _(1.5 hrs • 1 cycle)_`,
                 '',
                 `💡 _Best: 6 full cycles (9 hrs) for optimal rest_`,
                ],
                config.BOT_NAME
            )
        );
    },
});

// ═══════════════════════════════════════════════════════════════
//  🏃  FITNESS TIP
// ═══════════════════════════════════════════════════════════════

const FITNESS_TIPS = [
    { tip: 'Do 30 min of brisk walking daily — it burns 150+ calories!', emoji: '🚶' },
    { tip: '3 sets of 15 push-ups will transform your chest & arms in 30 days.', emoji: '💪' },
    { tip: 'Drink water before each meal — it boosts metabolism by up to 30%.', emoji: '💧' },
    { tip: 'A 10-minute plank session daily builds a rock-solid core.', emoji: '🏋️' },
    { tip: 'Sleep 7–9 hours — it\'s when your muscles recover and grow!', emoji: '😴' },
    { tip: 'Jumping jacks for 5 minutes raises your heart rate fast.', emoji: '🤸' },
    { tip: 'Eat protein within 30 minutes after a workout for best results.', emoji: '🥗' },
    { tip: 'Take the stairs — every flight burns roughly 3–5 calories.', emoji: '🪜' },
    { tip: 'Stretch for 10 minutes every morning to prevent injury.', emoji: '🧘' },
    { tip: 'High-Intensity Interval Training (HIIT) burns fat 48 hrs after!', emoji: '⚡' },
];

addCmd({
    name: 'fitness',
    aliases: ['workout', 'exercise', 'gym'],
    desc: 'Get a random fitness tip for the day',
    category: 'lifestyle',
    handler: async (ctx) => {
        const { tip, emoji } = pickRandom(FITNESS_TIPS);
        await ctx.reply(
            card('🏃 *F I T N E S S  T I P  O F  T H E  D A Y*',
                [`📅 ${now('dddd, DD MMM YYYY')}`, '',
                 `${emoji} ${tip}`, '',
                 `🔥 _Stay consistent — results take time!_`,
                ],
                config.BOT_NAME
            )
        );
    },
});
