'use strict';
const { addCmd } = require('../../guru/handlers/loader');
const config     = require('../../guru/config/settings');
const { pickRandom } = require('../../guru/utils/helpers');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
const { guruApi }    = require('../../guru/utils/guruApi');

// ━━ 8-Ball ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BALL_RESPONSES = [
    '✅ It is certain.','✅ It is decidedly so.','✅ Without a doubt.',
    '✅ Yes definitely.','✅ You may rely on it.','✅ As I see it, yes.',
    '✅ Most likely.','✅ Outlook good.','✅ Yes.','✅ Signs point to yes.',
    '🤔 Reply hazy, try again.','🤔 Ask again later.',
    '🤔 Better not tell you now.','🤔 Cannot predict now.',
    '🤔 Concentrate and ask again.',
    '❌ Don\'t count on it.','❌ My reply is no.','❌ My sources say no.',
    '❌ Outlook not so good.','❌ Very doubtful.',
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

// ━━ Jokes via GuruTech ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'joke',
    aliases: ['jokes'],
    desc: 'Get a random joke (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('😂');
        try {
            const data = await guruApi('jokes', {});
            const setup     = data?.setup || data?.joke || data?.question || data?.text;
            const punchline = data?.punchline || data?.answer || '';
            const text = punchline
                ? `😂 *Joke Time!*\n\n${setup}\n\n||${punchline}||`
                : `😂 *Joke Time!*\n\n${setup || 'Why did the programmer quit? Because he didn\'t get arrays!'}`;
            await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch {
            const fallback = [
                'Why don\'t scientists trust atoms? Because they make up everything!',
                'I told my wife she was drawing her eyebrows too high. She looked surprised.',
                'What do you call cheese that isn\'t yours? Nacho cheese!',
                'Why can\'t a bicycle stand on its own? Because it\'s two-tired!',
            ];
            await ctx.sock.sendMessage(ctx.from, { text: `😂 *Joke Time!*\n\n${pickRandom(fallback)}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ━━ Dad Jokes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'dadjoke',
    aliases: ['dad'],
    desc: 'Get a random dad joke',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('👨');
        try {
            const data = await guruApi('dad-jokes', {});
            const joke = data?.joke || data?.text || data?.result;
            await ctx.sock.sendMessage(ctx.from, { text: `👨 *Dad Joke*\n\n${joke || 'I\'m on a seafood diet. I see food and eat it!'}`, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch {
            await ctx.reply('👨 *Dad Joke*\n\nI used to hate facial hair... but then it grew on me! 😄');
        }
    },
});

// ━━ Quote via GuruTech ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'quote',
    aliases: ['inspire', 'motivation'],
    desc: 'Get an inspirational quote (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('💬');
        try {
            const data  = await guruApi('quote', {});
            const text  = data?.quote || data?.content || data?.text || data?.result;
            const author = data?.author || data?.by || '';
            await ctx.sock.sendMessage(ctx.from, {
                text: `💬 *"${text}"*${author ? `\n\n— _${author}_` : ''}\n\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
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

// ━━ Meme via GuruTech ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'meme',
    aliases: ['memes', 'randommeme'],
    desc: 'Get a random trending meme (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('🎭');
        try {
            const data  = await guruApi('meme', {});
            const img   = data?.url || data?.image || data?.postLink || data?.data?.url;
            const title = data?.title || data?.data?.title || 'Random Meme';
            if (!img) return ctx.reply('❌ Could not fetch meme. Try again!');
            await ctx.sock.sendMessage(ctx.from, {
                image:   { url: img },
                caption: `🎭 *${title}*\n\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[meme]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Meme fetch failed. Try again!');
        }
    },
});

// ━━ Random Poem ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'poem',
    aliases: ['poetry'],
    desc: 'Generate a random AI poem (GuruTech)',
    usage: 'poem [theme]',
    category: 'fun',
    handler: async (ctx) => {
        const theme = ctx.text || 'life';
        await ctx.react('📜');
        try {
            const data = await guruApi('random-poem', { theme });
            const poem = data?.poem || data?.text || data?.result || data?.content;
            await ctx.sock.sendMessage(ctx.from, {
                text: `📜 *A Poem on "${theme}"*\n\n${poem || 'Words fail me today...'}`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch {
            await ctx.reply(`📜 *Poem*\n\n_The stars above shine bright and clear,\nA reminder that you are always here.\nKeep going, keep pushing, never stop,\nFor from the bottom, there\'s nowhere but the top._\n\n_${config.BOT_NAME}_`);
        }
    },
});

// ━━ Trivia ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'trivia',
    aliases: ['quiz'],
    desc: 'Get a random trivia question (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('🧠');
        try {
            const data     = await guruApi('trivia', {});
            const question = data?.question || data?.text;
            const answer   = data?.answer || data?.correct_answer;
            const category = data?.category || '';
            await ctx.sock.sendMessage(ctx.from, {
                text: `🧠 *Trivia*${category ? ` — ${category}` : ''}\n\n❓ ${question}\n\n||💡 *Answer:* ${answer}||`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch {
            await ctx.reply('🧠 *Trivia*\n\n❓ What is the capital of Kenya?\n\n||💡 *Answer:* Nairobi||');
        }
    },
});

// ━━ Coin flip ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

// ━━ Dice ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

// ━━ Truth or Dare ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'truth',
    desc: 'Get a truth question (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('🎭');
        try {
            const data = await guruApi('truth', {});
            const q    = data?.truth || data?.question || data?.text || data?.result;
            await ctx.sock.sendMessage(ctx.from, { text: `🎭 *Truth*\n\n❓ ${q || 'What is your biggest secret?'}\n\n_${config.BOT_NAME}_`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            const truths = [
                'What is the most embarrassing thing you have ever done?',
                'Have you ever lied to get out of trouble?',
                'What is your biggest fear?',
                'What is something you have never told anyone?',
            ];
            await ctx.sock.sendMessage(ctx.from, { text: `🎭 *Truth*\n\n❓ ${pickRandom(truths)}\n\n_${config.BOT_NAME}_`, contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

addCmd({
    name: 'dare',
    desc: 'Get a dare challenge (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('🎯');
        try {
            const data = await guruApi('dare', {});
            const d    = data?.dare || data?.challenge || data?.text || data?.result;
            await ctx.sock.sendMessage(ctx.from, { text: `🎯 *Dare*\n\n${d || 'Send a voice note singing your favourite song!'}\n\n_Don't take it seriously 😂_`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            const dares = [
                'Send a voice note singing your favourite song.',
                'Change your profile picture to a funny face for 1 hour.',
                'Text your crush right now.',
                'Call someone and speak in a funny accent for 1 minute.',
            ];
            await ctx.sock.sendMessage(ctx.from, { text: `🎯 *Dare*\n\n${pickRandom(dares)}\n\n_Don't take it seriously 😂_`, contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

// ━━ Would you rather ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'wyr',
    aliases: ['wouldyourather'],
    desc: 'Would you rather question (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('🤔');
        try {
            const data = await guruApi('wyr', {});
            const a    = data?.option1 || data?.a || data?.optionA;
            const b    = data?.option2 || data?.b || data?.optionB;
            if (a && b) {
                await ctx.sock.sendMessage(ctx.from, { text: `🤔 *Would You Rather?*\n\n🅰️ ${a}\n\n*OR*\n\n🅱️ ${b}\n\n_Reply with A or B!_`, contextInfo: channelCtx() }, { quoted: ctx.m });
                return;
            }
        } catch {}
        const WYR = [
            ['Be rich but never find love','Be poor but deeply in love'],
            ['Fly like a bird','Swim like a fish'],
            ['Know when you\'ll die','Know how you\'ll die'],
            ['Have 100 loyal friends','Have 1 best friend you can trust with your life'],
        ];
        const [a, b] = pickRandom(WYR);
        await ctx.sock.sendMessage(ctx.from, { text: `🤔 *Would You Rather?*\n\n🅰️ ${a}\n\n*OR*\n\n🅱️ ${b}\n\n_Reply with A or B!_`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ━━ Roast ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ROASTS = [
    'You\'re the reason the gene pool needs a lifeguard.',
    'If brains were dynamite, you wouldn\'t have enough to blow your hat off.',
    'I\'d roast you harder but my mama told me not to burn trash.',
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

// ━━ Compliment ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

// ━━ Never Have I Ever ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'neverhaveiever',
    aliases: ['nhie', 'nhi'],
    desc: 'Get a "Never have I ever" statement (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('🖐️');
        try {
            const data = await guruApi('never-have-i', {});
            const stmt = data?.statement || data?.text || data?.result;
            await ctx.sock.sendMessage(ctx.from, { text: `🖐️ *Never Have I Ever...*\n\n${stmt || 'Never have I ever eaten a whole pizza by myself!'}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            await ctx.reply('🖐️ *Never Have I Ever...*\n\nNever have I ever stayed up all night scrolling on my phone!');
        }
    },
});

// ━━ Paranoia ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'paranoia',
    desc: 'Get a paranoia question for group games (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('😱');
        try {
            const data = await guruApi('paranoia', {});
            const q    = data?.question || data?.text || data?.result;
            await ctx.sock.sendMessage(ctx.from, { text: `😱 *Paranoia*\n\n${q || 'Who in this group would survive a zombie apocalypse?'}\n\n_Name someone — they must guess the question!_`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            await ctx.reply('😱 *Paranoia*\n\nWho in this group would survive a zombie apocalypse?\n\n_Name someone — they must guess the question!_');
        }
    },
});

// ━━ Pick-up Line ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'pickup',
    aliases: ['pickupline', 'flirt'],
    desc: 'Get a cheesy pick-up line (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('😏');
        try {
            const data = await guruApi('pickupline', {});
            const line = data?.line || data?.pickup || data?.text || data?.result;
            await ctx.sock.sendMessage(ctx.from, { text: `😏 *Pick-up Line*\n\n${line || 'Are you a bank loan? Because you have my interest!'}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            await ctx.reply('😏 *Pick-up Line*\n\nAre you a magician? Because whenever I look at you, everyone else disappears!');
        }
    },
});

// ━━ Insult (funny) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'insult',
    desc: 'Get a funny (harmless) insult (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('😤');
        try {
            const data   = await guruApi('insult', {});
            const insult = data?.insult || data?.text || data?.result;
            const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant;
            const who    = target ? `@${target.split('@')[0]}` : ctx.pushName;
            const text   = `😤 *Insult for ${who}*\n\n${insult || 'You\'re not stupid; you just have bad luck thinking.'}\n\n_Just kidding 😂_`;
            await ctx.send({ text, mentions: target ? [target] : [] });
        } catch {
            await ctx.reply('😤 You\'re proof that even evolution takes a day off sometimes. _Just kidding 😂_');
        }
    },
});

// ━━ Advice ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'advice',
    aliases: ['tip'],
    desc: 'Get a random piece of advice (GuruTech)',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('💡');
        try {
            const data = await guruApi('advice', {});
            const text = data?.advice || data?.text || data?.result;
            await ctx.sock.sendMessage(ctx.from, { text: `💡 *Advice of the Day*\n\n${text || 'Always be yourself, everyone else is already taken.'}\n\n_${config.BOT_NAME}_`, contextInfo: channelCtx() }, { quoted: ctx.m });
        } catch {
            await ctx.reply('💡 *Advice of the Day*\n\nAlways be yourself, everyone else is already taken.\n\n_' + config.BOT_NAME + '_');
        }
    },
});
