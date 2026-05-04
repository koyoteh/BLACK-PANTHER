'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  Extras Plugin
//  New commands: ping, calc, flip, roll, qr, remind, poll,
//                id, runtime, afk, unafk, encode, decode, 8ball
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd }     = require('../../guru/handlers/loader');
const config         = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

const BOT_START = Date.now();

// ── AFK store (in-memory) ──────────────────────────────────────
const AFK_MAP = new Map(); // jid → { reason, time }

// ── Reminder store (in-memory) ────────────────────────────────
const REMIND_MAP = new Map(); // key → timeout ref

// ── Helpers ───────────────────────────────────────────────────
function fmtUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s  / 60);
    const h = Math.floor(m  / 60);
    const d = Math.floor(h  / 24);
    const parts = [];
    if (d)      parts.push(`${d}d`);
    if (h % 24) parts.push(`${h % 24}h`);
    if (m % 60) parts.push(`${m % 60}m`);
    parts.push(`${s % 60}s`);
    return parts.join(' ');
}

function safeEval(expr) {
    // only allow safe math characters
    if (!/^[0-9+\-*/.()%^ \t]+$/.test(expr)) return null;
    try {
        // replace ^ with ** for power
        const clean = expr.replace(/\^/g, '**');
        // eslint-disable-next-line no-new-func
        const result = Function('"use strict"; return (' + clean + ')')();
        if (!isFinite(result)) return null;
        return result;
    } catch { return null; }
}

// ══════════════════════════════════════════════════════════════
//  PING — latency + uptime
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'ping',
    aliases: ['speed', 'latency'],
    desc: 'Check bot speed and uptime',
    category: 'general',
    handler: async (ctx) => {
        const start = Date.now();
        const sent  = await ctx.reply('🏓 Pinging...');
        const latency = Date.now() - start;
        const uptime  = fmtUptime(Date.now() - BOT_START);
        const memMB   = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        const text =
`╭─❖ *${config.BOT_NAME} — Ping* ❖─╮
│
├─❖ 🏓 *Latency  :* ${latency}ms
├─❖ ⏱️ *Uptime   :* ${uptime}
├─❖ 🧠 *Memory   :* ${memMB} MB
├─❖ 🌐 *Platform :* ${process.env.DYNO ? 'Heroku' : process.env.RENDER ? 'Render' : process.env.RAILWAY_ENVIRONMENT ? 'Railway' : 'Local/VPS'}
│
╰─❖ _${config.BOT_NAME}_ ❖─╯`;
        await ctx.sock.sendMessage(ctx.from, { text, edit: sent.key, contextInfo: channelCtx() });
    },
});

// ══════════════════════════════════════════════════════════════
//  RUNTIME — detailed bot stats
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'runtime',
    aliases: ['uptime', 'stats'],
    desc: 'Show bot runtime statistics',
    category: 'general',
    handler: async (ctx) => {
        const uptime  = fmtUptime(Date.now() - BOT_START);
        const memUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        const memTotal= Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
        const now     = new Date().toLocaleString('en-KE', { timeZone: config.TIME_ZONE || 'Africa/Nairobi' });
        await ctx.reply(
`╭─❖ *Bot Runtime Stats* ❖─╮
│
├─❖ 🤖 *Bot     :* ${config.BOT_NAME}
├─❖ ⏱️ *Uptime  :* ${uptime}
├─❖ 🧠 *Heap    :* ${memUsed}/${memTotal} MB
├─❖ 🔢 *Node    :* ${process.version}
├─❖ 📅 *Time    :* ${now}
├─❖ 👑 *Owner   :* ${config.OWNER_NAME}
│
╰─❖ _Powered by ${config.OWNER_NAME}_ ❖─╯`
        );
    },
});

// ══════════════════════════════════════════════════════════════
//  CALCULATOR
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'calc',
    aliases: ['calculate', 'math'],
    desc: 'Evaluate a math expression',
    usage: 'calc 2 + 2 * 10',
    category: 'general',
    handler: async (ctx) => {
        const expr = ctx.args.join(' ').trim();
        if (!expr) return ctx.reply('❌ Provide an expression.\n\nExample: `.calc 2 + 2 * 10`');
        const result = safeEval(expr);
        if (result === null) return ctx.reply('❌ Invalid or unsafe expression.');
        await ctx.reply(`🧮 *Calculator*\n\n📥 Input  : \`${expr}\`\n📤 Result : *${result}*`);
    },
});

// ══════════════════════════════════════════════════════════════
//  COIN FLIP
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'flip',
    aliases: ['coinflip', 'coin'],
    desc: 'Flip a coin',
    category: 'fun',
    handler: async (ctx) => {
        const result = Math.random() < 0.5 ? '🪙 *HEADS*' : '🪙 *TAILS*';
        await ctx.reply(`${result}\n\n_${config.BOT_NAME}_`);
    },
});

// ══════════════════════════════════════════════════════════════
//  DICE ROLL
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'roll',
    aliases: ['dice', 'rolldice'],
    desc: 'Roll a dice (default d6, or specify sides)',
    usage: 'roll [sides]',
    category: 'fun',
    handler: async (ctx) => {
        const sides  = parseInt(ctx.args[0]) || 6;
        if (sides < 2 || sides > 1000) return ctx.reply('❌ Sides must be between 2 and 1000.');
        const result = Math.floor(Math.random() * sides) + 1;
        await ctx.reply(`🎲 *Dice Roll (d${sides})*\n\nYou rolled: *${result}*\n\n_${config.BOT_NAME}_`);
    },
});

// ══════════════════════════════════════════════════════════════
//  8 BALL
// ══════════════════════════════════════════════════════════════
addCmd({
    name: '8ball',
    aliases: ['eightball', 'magic8'],
    desc: 'Ask the magic 8-ball a yes/no question',
    usage: '8ball <question>',
    category: 'fun',
    handler: async (ctx) => {
        const question = ctx.text;
        if (!question) return ctx.reply('❌ Ask a question!\n\nExample: `.8ball Will I win?`');
        const answers = [
            '✅ It is certain.', '✅ It is decidedly so.', '✅ Without a doubt.',
            '✅ Yes, definitely.', '✅ You may rely on it.', '✅ As I see it, yes.',
            '✅ Most likely.', '✅ Outlook good.', '✅ Yes.',
            '✅ Signs point to yes.', '⚠️ Reply hazy, try again.', '⚠️ Ask again later.',
            '⚠️ Better not tell you now.', '⚠️ Cannot predict now.', '⚠️ Concentrate and ask again.',
            '❌ Don\'t count on it.', '❌ My reply is no.', '❌ My sources say no.',
            '❌ Outlook not so good.', '❌ Very doubtful.',
        ];
        const answer = answers[Math.floor(Math.random() * answers.length)];
        await ctx.reply(`🎱 *Magic 8-Ball*\n\n❓ *Q:* ${question}\n\n🔮 *A:* ${answer}\n\n_${config.BOT_NAME}_`);
    },
});

// ══════════════════════════════════════════════════════════════
//  ENCODE / DECODE (Base64)
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'encode',
    aliases: ['b64encode', 'base64encode'],
    desc: 'Encode text to Base64',
    usage: 'encode <text>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text;
        if (!text) return ctx.reply('❌ Provide text to encode.\n\nExample: `.encode Hello World`');
        const encoded = Buffer.from(text).toString('base64');
        await ctx.reply(`🔒 *Base64 Encode*\n\n📥 Input  : ${text}\n📤 Output : \`${encoded}\``);
    },
});

addCmd({
    name: 'decode',
    aliases: ['b64decode', 'base64decode'],
    desc: 'Decode Base64 text',
    usage: 'decode <base64>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text;
        if (!text) return ctx.reply('❌ Provide Base64 text to decode.\n\nExample: `.decode SGVsbG8gV29ybGQ=`');
        try {
            const decoded = Buffer.from(text, 'base64').toString('utf-8');
            await ctx.reply(`🔓 *Base64 Decode*\n\n📥 Input  : ${text}\n📤 Output : ${decoded}`);
        } catch {
            await ctx.reply('❌ Invalid Base64 string.');
        }
    },
});

// ══════════════════════════════════════════════════════════════
//  MY ID — show sender & chat JID
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'id',
    aliases: ['myid', 'jid', 'chatid'],
    desc: 'Show your JID and the current chat JID',
    category: 'general',
    handler: async (ctx) => {
        await ctx.reply(
`🆔 *ID Info*

👤 *Your JID :* \`${ctx.sender}\`
💬 *Chat JID :* \`${ctx.from}\`
📛 *Name     :* ${ctx.pushName || 'Unknown'}
🤖 *Bot JID  :* \`${ctx.sock.user?.id || 'N/A'}\``
        );
    },
});

// ══════════════════════════════════════════════════════════════
//  POLL
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'poll',
    aliases: ['vote'],
    desc: 'Create a poll',
    usage: 'poll <Question> | <Option1> | <Option2> [| Option3...]',
    category: 'group',
    handler: async (ctx) => {
        const raw = ctx.text;
        if (!raw) return ctx.reply('❌ Usage: `.poll Question | Option1 | Option2`');
        const parts = raw.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length < 3) return ctx.reply('❌ Need a question and at least 2 options.\n\nExample: `.poll Best bot? | Yes | No | Maybe`');
        const [question, ...options] = parts;
        if (options.length > 12) return ctx.reply('❌ Maximum 12 options allowed.');
        await ctx.sock.sendMessage(ctx.from, {
            poll: { name: question, values: options, selectableCount: 1 },
            contextInfo: channelCtx(),
        });
    },
});

// ══════════════════════════════════════════════════════════════
//  REMIND
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'remind',
    aliases: ['reminder', 'remindme'],
    desc: 'Set a reminder (max 24h)',
    usage: 'remind <time> <unit> <message>  e.g. remind 30 min Buy groceries',
    category: 'tools',
    handler: async (ctx) => {
        const [amount, unit, ...msgParts] = ctx.args;
        const message = msgParts.join(' ');
        if (!amount || !unit || !message)
            return ctx.reply('❌ Usage: `.remind 30 min Buy groceries`\n\nUnits: *sec*, *min*, *hr*');

        const n = parseInt(amount);
        if (isNaN(n) || n <= 0) return ctx.reply('❌ Time must be a positive number.');

        let ms;
        const u = unit.toLowerCase();
        if (u.startsWith('s'))      ms = n * 1000;
        else if (u.startsWith('m')) ms = n * 60 * 1000;
        else if (u.startsWith('h')) ms = n * 60 * 60 * 1000;
        else return ctx.reply('❌ Unit must be *sec*, *min*, or *hr*.');

        if (ms > 24 * 60 * 60 * 1000)
            return ctx.reply('❌ Maximum reminder time is 24 hours.');

        const key = `${ctx.sender}_${Date.now()}`;
        const tid = setTimeout(async () => {
            REMIND_MAP.delete(key);
            await ctx.sock.sendMessage(ctx.from, {
                text: `⏰ *Reminder!*\n\n@${ctx.sender.split('@')[0]}, you asked me to remind you:\n\n_${message}_`,
                mentions: [ctx.sender],
                contextInfo: channelCtx(),
            }).catch(() => {});
        }, ms);
        REMIND_MAP.set(key, tid);

        const fmtTime = u.startsWith('s') ? `${n} second(s)` : u.startsWith('m') ? `${n} minute(s)` : `${n} hour(s)`;
        await ctx.reply(`✅ *Reminder Set!*\n\n⏰ In: *${fmtTime}*\n📝 Message: _${message}_`);
    },
});

// ══════════════════════════════════════════════════════════════
//  AFK
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'afk',
    aliases: ['away'],
    desc: 'Set yourself as AFK (Away From Keyboard)',
    usage: 'afk [reason]',
    category: 'general',
    handler: async (ctx) => {
        const reason = ctx.text || 'No reason given';
        AFK_MAP.set(ctx.sender, { reason, time: Date.now() });
        await ctx.reply(`😴 *${ctx.pushName || 'You'} is now AFK*\n\n📝 Reason: _${reason}_\n\n_You will be marked as back when you send a message._`);
    },
});

addCmd({
    name: 'unafk',
    aliases: ['back', 'iamback'],
    desc: 'Remove your AFK status',
    category: 'general',
    handler: async (ctx) => {
        if (!AFK_MAP.has(ctx.sender)) return ctx.reply('ℹ️ You are not AFK.');
        const { reason, time } = AFK_MAP.get(ctx.sender);
        AFK_MAP.delete(ctx.sender);
        const gone = fmtUptime(Date.now() - time);
        await ctx.reply(`✅ *Welcome back, ${ctx.pushName || 'User'}!*\n\n⏱️ Away for: *${gone}*\n📝 Was AFK for: _${reason}_`);
    },
});

// ── Export AFK_MAP so message handler can check it ─────────────
module.exports = { AFK_MAP };
