'use strict';
const { addCmd } = require('../../guru/handlers/loader');
const axios      = require('axios');
const config     = require('../../guru/config/settings');
const { pickRandom } = require('../../guru/utils/helpers');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

// ── 8-Ball ─────────────────────────────────────────────────────
const BALL_RESPONSES = [
    '✅ It is certain.', '✅ It is decidedly so.', '✅ Without a doubt.',
    '✅ Yes definitely.', '✅ You may rely on it.', '✅ As I see it, yes.',
    '✅ Most likely.', '✅ Outlook good.', '✅ Yes.', '✅ Signs point to yes.',
    '🤔 Reply hazy, try again.', '🤔 Ask again later.',
    '🤔 Better not tell you now.', '🤔 Cannot predict now.',
    '🤔 Concentrate and ask again.',
    '❌ Don\'t count on it.', '❌ My reply is no.', '❌ My sources say no.',
    '❌ Outlook not so good.', '❌ Very doubtful.',
];

addCmd({
    name: '8ball',
    aliases: ['magic8ball'],
    desc: 'Ask the magic 8-ball a question',
    usage: '8ball <question>',
    category: 'fun',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Ask a question!\n\nExample: `.8ball Will I be rich?`', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.sock.sendMessage(ctx.from, { text: `🎱 *Magic 8-Ball*\n\n❓ *Q:* ${ctx.text}\n\n${pickRandom(BALL_RESPONSES)}`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── Jokes ─────────────────────────────────────────────────────
addCmd({
    name: 'joke',
    aliases: ['jokes'],
    desc: 'Get a random joke',
    category: 'fun',
    handler: async (ctx) => {
        try {
            const res  = await axios.get('https://official-joke-api.appspot.com/random_joke');
            const joke = res.data;
            await ctx.sock.sendMessage(ctx.from, { text: `😂 *Joke Time!*\n\n${joke.setup}\n\n||${joke.punchline}||`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            const jokes = [
                'Why don\'t scientists trust atoms? Because they make up everything!',
                'I told my wife she was drawing her eyebrows too high. She looked surprised.',
                'Why can\'t you give Elsa a balloon? Because she\'ll let it go!',
                'What do you call cheese that isn\'t yours? Nacho cheese!',
            ];
            await ctx.sock.sendMessage(ctx.from, { text: `😂 *Joke Time!*\n\n${pickRandom(jokes)}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Quotes ────────────────────────────────────────────────────
addCmd({
    name: 'quote',
    aliases: ['inspire', 'motivation'],
    desc: 'Get an inspirational quote',
    category: 'fun',
    handler: async (ctx) => {
        try {
            const res   = await axios.get('https://api.quotable.io/random');
            const quote = res.data;
            await ctx.sock.sendMessage(ctx.from, { text: `💬 *"${quote.content}"*\n\n— _${quote.author}_\n\n_${config.BOT_NAME}_`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            const quotes = [
                '"The only way to do great work is to love what you do." — Steve Jobs',
                '"In the middle of every difficulty lies opportunity." — Albert Einstein',
                '"It does not matter how slowly you go as long as you do not stop." — Confucius',
                '"Life is what happens when you\'re busy making other plans." — John Lennon',
            ];
            await ctx.sock.sendMessage(ctx.from, { text: `💬 *${pickRandom(quotes)}*\n\n_${config.BOT_NAME}_`, contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ── Coin flip ─────────────────────────────────────────────────
addCmd({
    name: 'coin',
    aliases: ['coinflip'],
    desc: 'Flip a coin — heads or tails',
    category: 'fun',
    handler: async (ctx) => {
        const result = Math.random() > 0.5 ? '🪙 *HEADS*' : '🪙 *TAILS*';
        await ctx.sock.sendMessage(ctx.from, { text: `🪙 Flipping coin...\n\n${result}`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── Dice ──────────────────────────────────────────────────────
addCmd({
    name: 'dice',
    aliases: ['roll', 'rolldice'],
    desc: 'Roll a dice',
    category: 'fun',
    handler: async (ctx) => {
        const sides = parseInt(ctx.args[0]) || 6;
        const roll  = Math.floor(Math.random() * sides) + 1;
        const emojis = ['⚀','⚁','⚂','⚃','⚄','⚅'];
        const display = sides === 6 ? emojis[roll - 1] : `*${roll}*`;
        await ctx.sock.sendMessage(ctx.from, { text: `🎲 Rolling a ${sides}-sided dice...\n\n${display} — You rolled *${roll}*!`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── Truth or Dare ─────────────────────────────────────────────
const TRUTHS = [
    'What is the most embarrassing thing you have ever done?',
    'Have you ever lied to get out of trouble?',
    'What is your biggest fear?',
    'Have you ever cheated on a test?',
    'What is the strangest dream you have ever had?',
    'What is something you have never told anyone?',
    'If you could change one thing about yourself, what would it be?',
];
const DARES = [
    'Send a voice note singing your favourite song.',
    'Change your profile picture to a funny face for 1 hour.',
    'Send "I love you" to the last person in your contacts.',
    'Do 20 push-ups and record it.',
    'Text your crush right now.',
    'Post a random status on WhatsApp.',
    'Call someone and speak in a funny accent for 1 minute.',
];

addCmd({
    name: 'truth',
    desc: 'Get a truth question',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.sock.sendMessage(ctx.from, { text: `🎭 *Truth*\n\n❓ ${pickRandom(TRUTHS)}\n\n_${config.BOT_NAME}_`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

addCmd({
    name: 'dare',
    desc: 'Get a dare challenge',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.sock.sendMessage(ctx.from, { text: `🎭 *Dare*\n\n🎯 ${pickRandom(DARES)}\n\n_Don't take it seriously 😂_`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── Would you rather ──────────────────────────────────────────
const WYR = [
    ['Be rich but never find love', 'Be poor but deeply in love'],
    ['Fly like a bird', 'Swim like a fish'],
    ['Know when you\'ll die', 'Know how you\'ll die'],
    ['Have 100 loyal friends', 'Have 1 best friend you can trust with your life'],
    ['Live 200 years in the past', 'Live 200 years in the future'],
];

addCmd({
    name: 'wyr',
    aliases: ['wouldyourather'],
    desc: 'Would you rather question',
    category: 'fun',
    handler: async (ctx) => {
        const [a, b] = pickRandom(WYR);
        await ctx.sock.sendMessage(ctx.from, { text: `🤔 *Would You Rather?*\n\n🅰️ ${a}\n\n*OR*\n\n🅱️ ${b}\n\n_Reply with A or B!_`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── Roast ─────────────────────────────────────────────────────
const ROASTS = [
    'You\'re the reason the gene pool needs a lifeguard.',
    'If brains were dynamite, you wouldn\'t have enough to blow your hat off.',
    'I\'d roast you harder but my mama told me not to burn trash.',
    'You\'re not stupid; you just have bad luck thinking.',
    'Your WiFi password is probably "12345" isn\'t it?',
    'Some people bring happiness wherever they go. You bring it whenever you go.',
];

addCmd({
    name: 'roast',
    desc: 'Get a funny roast',
    category: 'fun',
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant;
        const who    = target ? `@${target.split('@')[0]}` : ctx.pushName;
        const text   = `🔥 *Roast for ${who}*\n\n${pickRandom(ROASTS)}\n\n_Don't take it seriously 😂_`;
        await ctx.send({ text, mentions: target ? [target] : [] });
    },
});

// ── Compliment ────────────────────────────────────────────────
const COMPLIMENTS = [
    'You have a great sense of humour! 😄',
    'You make the world a better place just by being in it. 🌍',
    'You\'re more fun than bubble wrap. 🫧',
    'You have the best ideas. 💡',
    'Your smile could light up a whole room. 😊',
    'You are absolutely, undeniably, fantastically awesome. 🌟',
];

addCmd({
    name: 'compliment',
    aliases: ['comp'],
    desc: 'Send a compliment',
    category: 'fun',
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant;
        const who    = target ? `@${target.split('@')[0]}` : ctx.pushName;
        const text   = `💝 *Compliment for ${who}*\n\n${pickRandom(COMPLIMENTS)}\n\n_${config.BOT_NAME}_`;
        await ctx.send({ text, mentions: target ? [target] : [] });
    },
});
