'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  panther_tools.js
//  🔧  Advanced Tools & Owner Commands:
//      • broadcastmsg · setbotname · setbotpp · resetbot
//      • blacklist/whitelist users · speedtest · uptime
//      • fake-reply · forwardmsg · copymsg · deletemsg
//      • qrcode · barcode · screenshot
//      • tts (text-to-speech) · ocr (image-to-text)
//      • base64 encode/decode · hash md5/sha256
//      • pastebin · shorturl · urlinfo
//      • getstic (get sticker info) · togif
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd }     = require('../../guru/handlers/loader');
const axios          = require('axios');
const config         = require('../../guru/config/settings');
const { channelCtx, sendCopyButton, sendButtons } = require('../../guru/utils/gmdFunctions2');
const crypto         = require('crypto');

function card(title, body) {
    return `*${title}*\n${config.BOT_NAME}\n\n${body}\n\n◈ ${config.CHANNEL_NAME}`;
}

// ════════════════════════════════════════════════════════════════
//  🔐  BASE64 ENCODE / DECODE
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'encode',
    aliases: ['base64encode', 'b64enc'],
    desc: 'Encode text to Base64',
    usage: 'encode <text>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text;
        if (!text) return ctx.reply(`❌ Provide text to encode.\n\nExample: \`${config.BOT_PREFIX}encode Hello World\``);
        const encoded = Buffer.from(text).toString('base64');
        await ctx.reply(card('🔐 BASE64 ENCODE',
            `📥 *Input:*\n\`${text}\`\n\n📤 *Encoded:*\n\`${encoded}\``));
    },
});

addCmd({
    name: 'decode',
    aliases: ['base64decode', 'b64dec'],
    desc: 'Decode Base64 text',
    usage: 'decode <base64>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text;
        if (!text) return ctx.reply(`❌ Provide Base64 text to decode.`);
        try {
            const decoded = Buffer.from(text, 'base64').toString('utf8');
            await ctx.reply(card('🔓 BASE64 DECODE',
                `📥 *Input:*\n\`${text}\`\n\n📤 *Decoded:*\n\`${decoded}\``));
        } catch { await ctx.reply('❌ Invalid Base64 input.'); }
    },
});

// ════════════════════════════════════════════════════════════════
//  #️⃣  HASH GENERATOR
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'hash',
    aliases: ['md5', 'sha256', 'checksum'],
    desc: 'Generate hash of text (MD5/SHA256/SHA512)',
    usage: 'hash <algorithm> <text>  e.g. hash md5 hello',
    category: 'tools',
    handler: async (ctx) => {
        const algo = ctx.args[0]?.toLowerCase();
        const text = ctx.args.slice(1).join(' ');
        const valid = ['md5','sha1','sha256','sha512'];
        if (!algo || !valid.includes(algo)) return ctx.reply(
            `❌ Valid algorithms: ${valid.join(', ')}\n\nExample: \`${config.BOT_PREFIX}hash sha256 hello world\``);
        if (!text) return ctx.reply('❌ Provide text to hash.');
        const result = crypto.createHash(algo).update(text).digest('hex');
        await ctx.reply(card(`#️⃣ ${algo.toUpperCase()} HASH`,
            `📥 *Input:*  \`${text}\`\n🔑 *Hash:*   \`${result}\``));
    },
});

// ════════════════════════════════════════════════════════════════
//  🔗  URL SHORTENER
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'shorturl',
    aliases: ['shorten', 'tinyurl'],
    desc: 'Shorten a URL',
    usage: 'shorturl <url>',
    category: 'tools',
    handler: async (ctx) => {
        const url = ctx.args[0];
        if (!url || !url.startsWith('http')) return ctx.reply(`❌ Provide a valid URL.\n\nExample: \`${config.BOT_PREFIX}shorturl https://example.com\``);
        await ctx.react('⏳');
        try {
            const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
            await ctx.reply(card('🔗 URL SHORTENER',
                `📥 *Original:*\n${url}\n\n🔗 *Shortened:*\n${res.data}`));
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ URL shortening failed. Try again.');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  📊  QR CODE GENERATOR
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'qr',
    aliases: ['qrcode', 'makeqr'],
    desc: 'Generate a QR code from text or URL',
    usage: 'qr <text or url>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text;
        if (!text) return ctx.reply(`❌ Provide text or URL.\n\nExample: \`${config.BOT_PREFIX}qr https://wa.me/254105521300\``);
        await ctx.react('⏳');
        try {
            const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`;
            await ctx.sock.sendMessage(ctx.from,
                { image: { url }, caption: `*📊 QR CODE*\n${config.BOT_NAME}\n\n📝 *Content:* ${text.slice(0, 100)}\n\n◈ ${config.CHANNEL_NAME}`, contextInfo: channelCtx() },
                { quoted: ctx.m });
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ QR code generation failed.');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  📝  PASTEBIN
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'paste',
    aliases: ['pastebin', 'hastebin'],
    desc: 'Paste text online and get a link',
    usage: 'paste <text>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text;
        if (!text) return ctx.reply(`❌ Provide text to paste.\n\nExample: \`${config.BOT_PREFIX}paste Hello World!\``);
        await ctx.react('⏳');
        try {
            const res = await axios.post('https://hastebin.com/documents', text, {
                headers: { 'Content-Type': 'text/plain' }
            });
            await ctx.reply(card('📝 PASTEBIN',
                `✅ *Pasted successfully!*\n\n🔗 *Link:* https://hastebin.com/${res.data.key}\n📏 *Length:* ${text.length} chars`));
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ Paste failed. Try again.');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🔀  REVERSE TEXT
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'reverse',
    aliases: ['flip', 'reversetext'],
    desc: 'Reverse a text string',
    usage: 'reverse <text>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text;
        if (!text) return ctx.reply(`❌ Provide text to reverse.`);
        const reversed = text.split('').reverse().join('');
        await ctx.reply(card('🔀 TEXT REVERSE',
            `📥 *Input:*    ${text}\n📤 *Reversed:* ${reversed}`));
    },
});

// ════════════════════════════════════════════════════════════════
//  📊  WORD/CHAR/LINE COUNT
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'count',
    aliases: ['wordcount', 'charcount', 'wc'],
    desc: 'Count words, characters and lines in text',
    usage: 'count <text>',
    category: 'tools',
    handler: async (ctx) => {
        const text = ctx.text ||
            ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
        if (!text) return ctx.reply('❌ Provide text or reply to a message.');
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const chars = text.length;
        const charsNoSpace = text.replace(/\s/g, '').length;
        const lines = text.split('\n').length;
        const sentences = text.split(/[.!?]+/).filter(Boolean).length;
        await ctx.reply(card('📊 TEXT ANALYSIS',
            `🔤 *Characters:*        ${chars}\n` +
            `🔤 *Chars (no spaces):* ${charsNoSpace}\n` +
            `📝 *Words:*             ${words}\n` +
            `📄 *Lines:*             ${lines}\n` +
            `📖 *Sentences:*         ${sentences}`));
    },
});

// ════════════════════════════════════════════════════════════════
//  🎲  RANDOM QUOTE
// ════════════════════════════════════════════════════════════════
const WAKANDA_QUOTES = [
    '"In times of crisis, the wise build bridges, while the foolish build barriers." — T\'Challa',
    '"Wakanda Forever." — Black Panther',
    '"You are a good man with a good heart. And it\'s hard for a good man to be king." — T\'Chaka',
    '"Death is not the end." — Shuri',
    '"A man who has not prepared his children for his own death has failed as a father." — T\'Chaka',
    '"Justice will not be served until those who are unaffected are as outraged as those who are." — Unknown',
    '"The world is changing. Soon there will only be the conquered and the conquerors." — Erik Killmonger',
    '"You have become the enemy." — Black Panther',
    '"From the ashes of Wakanda\'s greatest failure, the strongest vibranium emerges." — GuruTech',
    '"Not all kings wear crowns. Some wear hoodies, some wear chains. But a true king serves." — GuruTech',
];

addCmd({
    name: 'wakandaquote',
    aliases: ['panthquote', 'wquote'],
    desc: 'Get a Wakanda / Black Panther quote',
    category: 'fun',
    handler: async (ctx) => {
        const q = WAKANDA_QUOTES[Math.floor(Math.random() * WAKANDA_QUOTES.length)];
        await ctx.reply(card('🐾 WAKANDA QUOTE', q));
    },
});

// ════════════════════════════════════════════════════════════════
//  🌟  MOTIVATIONAL QUOTE
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'motivation',
    aliases: ['motivate', 'inspire'],
    desc: 'Get a motivational quote',
    category: 'fun',
    handler: async (ctx) => {
        await ctx.react('⏳');
        try {
            const res = await axios.get('https://api.quotable.io/random');
            await ctx.reply(card('💫 MOTIVATIONAL QUOTE',
                `"${res.data.content}"\n\n— *${res.data.author}*`));
            await ctx.react('✅');
        } catch {
            const q = ['Believe you can and you\'re halfway there. — T.Roosevelt',
                       'The only way to do great work is to love what you do. — Steve Jobs',
                       'Success is not final; failure is not fatal. — Winston Churchill'];
            await ctx.reply(card('💫 MOTIVATIONAL QUOTE', q[Math.floor(Math.random()*q.length)]));
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  🌈  ASCII ART TEXT
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'ascii',
    aliases: ['bigtext', 'arttext'],
    desc: 'Convert text to block/emoji letters',
    usage: 'ascii <text>',
    category: 'fun',
    handler: async (ctx) => {
        const text = ctx.text?.toUpperCase().slice(0, 20);
        if (!text) return ctx.reply(`❌ Provide text.\n\nExample: \`${config.BOT_PREFIX}ascii WAKANDA\``);
        const map = {
            A:'🅰',B:'🅱',C:'©',D:'▶',E:'📧',F:'📻',G:'🎮',H:'♓',I:'ℹ',J:'🎷',
            K:'🎋',L:'🎯',M:'📩',N:'♑',O:'⭕',P:'🅿',Q:'🎱',R:'®',S:'💲',T:'✝',
            U:'⛎',V:'✌',W:'〰',X:'❌',Y:'🌿',Z:'💤',
            ' ':'➖','0':'0️⃣','1':'1️⃣','2':'2️⃣','3':'3️⃣','4':'4️⃣',
            '5':'5️⃣','6':'6️⃣','7':'7️⃣','8':'8️⃣','9':'9️⃣',
        };
        const art = text.split('').map(c => map[c] || c).join('');
        await ctx.reply(`*🎨 ASCII ART*\n${config.BOT_NAME}\n\n${art}\n\n◈ ${config.CHANNEL_NAME}`);
    },
});

// ════════════════════════════════════════════════════════════════
//  💬  FAKE CHAT / FAKE REPLY
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'fakereply',
    aliases: ['fr', 'faketext'],
    desc: 'Send a fake reply message',
    usage: 'fakereply <name> | <fake message> | <your message>',
    category: 'fun',
    handler: async (ctx) => {
        const parts = ctx.text?.split('|').map(s => s.trim());
        if (!parts || parts.length < 3) return ctx.reply(
            `❌ *Usage:* \`${config.BOT_PREFIX}fakereply Elon Musk | I'm buying WhatsApp | Congrats!\``);
        const [name, fakeMsg, yourMsg] = parts;
        await ctx.sock.sendMessage(ctx.from, {
            text: yourMsg,
            contextInfo: {
                ...channelCtx(),
                quotedMessage: { conversation: fakeMsg },
                participant: `0@s.whatsapp.net`,
                pushName: name,
            },
        }, { quoted: ctx.m });
    },
});

// ════════════════════════════════════════════════════════════════
//  📸  SET BOT PROFILE PICTURE (owner only)
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'setbotpp',
    aliases: ['botpp', 'setbotpic'],
    desc: 'Change bot profile picture (reply to image)',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const quoted = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasImg = quoted?.imageMessage || ctx.m.message?.imageMessage;
        if (!hasImg) return ctx.reply('❌ Reply to an image to set it as the bot profile picture.');
        await ctx.react('⏳');
        try {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const buf = await downloadMediaMessage(ctx.m, 'buffer', {});
            await ctx.sock.updateProfilePicture(ctx.sock.user.id, buf);
            await ctx.reply('✅ Bot profile picture updated successfully!');
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply('❌ Failed to update profile picture.');
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  📝  SET BOT NAME (owner only)
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'setbotname',
    aliases: ['botname', 'renambot'],
    desc: 'Change bot display name',
    usage: 'setbotname <new name>',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const name = ctx.text;
        if (!name) return ctx.reply(`❌ Provide a new name.\n\nExample: \`${config.BOT_PREFIX}setbotname PANTHER v2\``);
        try {
            await ctx.sock.updateProfileName(name);
            config.BOT_NAME = name;
            await ctx.reply(`✅ Bot name changed to *${name}*`);
        } catch { await ctx.reply('❌ Failed to change bot name.'); }
    },
});

// ════════════════════════════════════════════════════════════════
//  📣  BROADCAST (owner only)
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'broadcast',
    aliases: ['bc', 'bcast'],
    desc: 'Broadcast a message to all chats',
    usage: 'broadcast <message>',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const msg = ctx.text;
        if (!msg) return ctx.reply(`❌ Provide a message to broadcast.`);
        const { chats } = await ctx.sock.groupFetchAllParticipating().catch(() => ({ chats: {} }));
        const ids = Object.keys(chats);
        if (!ids.length) return ctx.reply('❌ No group chats found to broadcast to.');
        await ctx.react('⏳');
        let sent = 0, failed = 0;
        const text = `*📢 BROADCAST*\n${config.BOT_NAME}\n\n${msg}\n\n◈ ${config.CHANNEL_NAME}`;
        for (const id of ids) {
            try {
                await ctx.sock.sendMessage(id, { text, contextInfo: channelCtx() });
                sent++;
                await new Promise(r => setTimeout(r, 500));
            } catch { failed++; }
        }
        await ctx.reply(`✅ *Broadcast Complete*\n\n✔️ Sent: ${sent}\n❌ Failed: ${failed}`);
        await ctx.react('✅');
    },
});

// ════════════════════════════════════════════════════════════════
//  🔒  BLACKLIST / WHITELIST
// ════════════════════════════════════════════════════════════════
const blacklist = new Set();

addCmd({
    name: 'blacklist',
    aliases: ['ban', 'blockuser'],
    desc: 'Blacklist a user from using the bot',
    usage: 'blacklist @user or number',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant
            || (ctx.args[0] ? ctx.args[0].replace(/\D/g,'') + '@s.whatsapp.net' : null);
        if (!target) return ctx.reply('❌ Reply to or mention a user to blacklist them.');
        blacklist.add(target);
        global._pantherblacklist = blacklist;
        await ctx.sock.sendMessage(ctx.from,
            { text: `🚫 @${target.split('@')[0]} has been *blacklisted* from using ${config.BOT_NAME}.`, mentions: [target], contextInfo: channelCtx() },
            { quoted: ctx.m });
    },
});

addCmd({
    name: 'whitelist',
    aliases: ['unban', 'unblockuser'],
    desc: 'Remove a user from the blacklist',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant
            || (ctx.args[0] ? ctx.args[0].replace(/\D/g,'') + '@s.whatsapp.net' : null);
        if (!target) return ctx.reply('❌ Reply to or mention a user to whitelist them.');
        blacklist.delete(target);
        global._pantherblacklist = blacklist;
        await ctx.sock.sendMessage(ctx.from,
            { text: `✅ @${target.split('@')[0]} has been *removed from the blacklist*.`, mentions: [target], contextInfo: channelCtx() },
            { quoted: ctx.m });
    },
});

addCmd({
    name: 'blacklisted',
    aliases: ['showblacklist'],
    desc: 'Show all blacklisted users',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        if (!blacklist.size) return ctx.reply('✅ No users are blacklisted.');
        const list = [...blacklist];
        const text = `*🚫 BLACKLISTED USERS*\n${config.BOT_NAME}\n\n` +
            list.map((j,i) => `${i+1}. @${j.split('@')[0]}`).join('\n') +
            `\n\n_Total: ${list.length}_\n◈ ${config.CHANNEL_NAME}`;
        await ctx.sock.sendMessage(ctx.from, { text, mentions: list, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ════════════════════════════════════════════════════════════════
//  🎭  FUN TOOLS
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'rps',
    aliases: ['rockpaperscissors'],
    desc: 'Play Rock Paper Scissors against the bot',
    usage: 'rps <rock|paper|scissors>',
    category: 'games',
    handler: async (ctx) => {
        const choices = ['rock', 'paper', 'scissors'];
        const emojis  = { rock: '🪨', paper: '📄', scissors: '✂️' };
        const player  = ctx.args[0]?.toLowerCase();
        if (!player || !choices.includes(player)) return ctx.reply(`❌ Choose: rock, paper, or scissors\n\nExample: \`${config.BOT_PREFIX}rps rock\``);
        const bot = choices[Math.floor(Math.random() * 3)];
        let result;
        if (player === bot) result = '🤝 *TIE!*';
        else if ((player === 'rock' && bot === 'scissors') || (player === 'paper' && bot === 'rock') || (player === 'scissors' && bot === 'paper'))
            result = '🎉 *YOU WIN!*';
        else result = '🤖 *BOT WINS!*';
        await ctx.reply(card('🎮 ROCK PAPER SCISSORS',
            `🤜 *You:* ${emojis[player]} ${player}\n🤖 *Bot:* ${emojis[bot]} ${bot}\n\n${result}`));
    },
});

addCmd({
    name: 'truth',
    aliases: ['truthdare'],
    desc: 'Get a truth or dare',
    usage: 'truth  |  dare',
    category: 'fun',
    handler: async (ctx) => {
        const TRUTHS = [
            'What is your biggest fear?', 'Have you ever cheated on a test?',
            'What is the most embarrassing thing you\'ve ever done?',
            'Who is your secret crush?', 'What\'s the worst lie you\'ve ever told?',
            'Have you ever blamed someone else for something you did?',
            'What is something you\'ve never told your parents?',
        ];
        const DARES = [
            'Send a voice note saying "I love you" to the last person you texted!',
            'Change your profile picture to the next photo in your gallery for 1 hour!',
            'Post a selfie with a funny face on your status!',
            'Send a message to your ex saying hello!',
            'Sing your favorite song in a voice note!',
        ];
        const list = ctx.command === 'dare' ? DARES : TRUTHS;
        await ctx.reply(card(ctx.command === 'dare' ? '🔥 DARE!' : '💭 TRUTH!',
            list[Math.floor(Math.random() * list.length)]));
    },
});

addCmd({
    name: 'dare',
    aliases: [],
    desc: 'Get a dare challenge',
    category: 'fun',
    handler: async (ctx) => {
        const DARES = [
            'Send a voice note saying "I love you" to the last person you texted!',
            'Change your profile picture to the next photo in your gallery for 1 hour!',
            'Post a selfie with a funny face on your status!',
            'Send a message to your ex saying hello!',
            'Sing your favorite song in a voice note!',
        ];
        await ctx.reply(card('🔥 DARE!', DARES[Math.floor(Math.random()*DARES.length)]));
    },
});

// ════════════════════════════════════════════════════════════════
//  🤗  RELATIONSHIP COMMANDS (fun)
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'ship',
    aliases: ['shipnames', 'couple'],
    desc: 'Check compatibility between two people',
    usage: 'ship @user1 @user2  or  ship name1 name2',
    category: 'fun',
    handler: async (ctx) => {
        const participants = ctx.m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const n1 = participants[0] ? `@${participants[0].split('@')[0]}` : (ctx.args[0] || 'Person 1');
        const n2 = participants[1] ? `@${participants[1].split('@')[0]}` : (ctx.args[1] || 'Person 2');
        const pct = Math.floor(Math.random() * 101);
        const hearts = '❤️'.repeat(Math.ceil(pct/20)).padEnd(5,'🖤');
        const msg = pct >= 80 ? '💑 Perfect match! 🔥' : pct >= 60 ? '😍 Great chemistry!' : pct >= 40 ? '🤔 Maybe with some effort...' : pct >= 20 ? '😅 Needs work!' : '💔 Not compatible';
        await ctx.sock.sendMessage(ctx.from,
            { text: `*💘 SHIP METER*\n${config.BOT_NAME}\n\n💕 ${n1} + ${n2}\n\n${hearts} *${pct}%*\n\n${msg}\n\n◈ ${config.CHANNEL_NAME}`, mentions: participants, contextInfo: channelCtx() },
            { quoted: ctx.m });
    },
});

addCmd({
    name: 'rate',
    aliases: ['rateuser', 'rating'],
    desc: 'Rate something out of 10',
    usage: 'rate <anything>',
    category: 'fun',
    handler: async (ctx) => {
        const thing = ctx.text;
        if (!thing) return ctx.reply(`❌ What should I rate?\n\nExample: \`${config.BOT_PREFIX}rate my cooking\``);
        const n = Math.floor(Math.random() * 11);
        const stars = '⭐'.repeat(n) + '☆'.repeat(10-n);
        await ctx.reply(card('⭐ RATING',
            `📝 *Judging:* ${thing}\n\n${stars}\n\n🏆 *Score:* *${n}/10*`));
    },
});

// ════════════════════════════════════════════════════════════════
//  🔗  MEDIA → URL  (Catbox / 0x0.st / tmpfiles fallback)
// ════════════════════════════════════════════════════════════════

const FormData  = require('form-data');
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');

// ── Mime → extension map ──────────────────────────────────────
function guessExt(mime = '', msgType = '') {
    if (mime.includes('mp4') || mime.includes('video')) return 'mp4';
    if (mime.includes('webp') || msgType === 'stickerMessage') return 'webp';
    if (mime.includes('ogg') || mime.includes('opus'))  return 'ogg';
    if (mime.includes('mp3') || mime.includes('mpeg'))  return 'mp3';
    if (mime.includes('png'))  return 'png';
    if (mime.includes('gif'))  return 'gif';
    if (mime.includes('pdf'))  return 'pdf';
    if (mime.includes('jpeg') || mime.includes('jpg'))  return 'jpg';
    if (msgType === 'imageMessage')    return 'jpg';
    if (msgType === 'videoMessage')    return 'mp4';
    if (msgType === 'audioMessage')    return 'ogg';
    if (msgType === 'documentMessage') return 'bin';
    return 'bin';
}

// ── Upload to Catbox.moe (permanent, no account needed) ───────
async function uploadCatbox(buf, filename, mime) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buf, { filename, contentType: mime });
    const res = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });
    const url = (typeof res.data === 'string' ? res.data : '').trim();
    if (!url.startsWith('http')) throw new Error(`Catbox bad response: ${url.slice(0,80)}`);
    return url;
}

// ── Upload to 0x0.st (permanent, minimalist) ──────────────────
async function upload0x0(buf, filename, mime) {
    const form = new FormData();
    form.append('file', buf, { filename, contentType: mime });
    const res = await axios.post('https://0x0.st', form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });
    const url = (typeof res.data === 'string' ? res.data : '').trim();
    if (!url.startsWith('http')) throw new Error(`0x0.st bad response: ${url.slice(0,80)}`);
    return url;
}

// ── Upload to tmpfiles.org (24h temporary) ────────────────────
async function uploadTmpfiles(buf, filename, mime) {
    const form = new FormData();
    form.append('file', buf, { filename, contentType: mime });
    const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });
    const url = res.data?.data?.url?.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    if (!url?.startsWith('http')) throw new Error('tmpfiles bad response');
    return url;
}

// ── Try all uploaders, log each failure ───────────────────────
async function tryUpload(buf, filename, mime) {
    const services = [
        { fn: () => uploadCatbox(buf, filename, mime),   name: 'Catbox.moe',  permanent: true  },
        { fn: () => upload0x0(buf, filename, mime),      name: '0x0.st',      permanent: true  },
        { fn: () => uploadTmpfiles(buf, filename, mime), name: 'tmpfiles.org',permanent: false },
    ];
    const errors = [];
    for (const svc of services) {
        try {
            const url = await svc.fn();
            return { url, name: svc.name, permanent: svc.permanent };
        } catch (e) {
            console.error(`[URL] ${svc.name} failed:`, e.message);
            errors.push(`${svc.name}: ${e.message}`);
        }
    }
    throw new Error(errors.join(' | '));
}

addCmd({
    name: 'url',
    aliases: ['tourl', 'catbox', 'upload', 'mediaurl', 'fileurl', 'getlink'],
    desc: 'Upload any media to Catbox and get a shareable URL',
    usage: 'Reply to any media with .url',
    category: 'tools',
    handler: async (ctx) => {
        const MEDIA_TYPES = [
            'imageMessage', 'videoMessage', 'audioMessage',
            'documentMessage', 'stickerMessage',
        ];

        // ── Detect where media lives ───────────────────────────
        const quoted     = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const curType    = getContentType(ctx.m.message);
        const quotedType = quoted ? getContentType(quoted) : null;

        const useQuoted  = MEDIA_TYPES.includes(quotedType);
        const useCurrent = MEDIA_TYPES.includes(curType);
        const targetType = useQuoted ? quotedType : useCurrent ? curType : null;

        if (!targetType) {
            return ctx.sock.sendMessage(ctx.from, {
                text:
                    `❌ *Reply to any media with .url to get a link.*\n\n` +
                    `Supports: 🖼️ Image · 🎥 Video · 🎵 Audio · 📄 Document · 🎨 Sticker\n\n` +
                    `*Example:* Reply to a photo with \`${config.BOT_PREFIX}url\``,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        await ctx.react('⏳');

        // ── Download buffer ────────────────────────────────────
        let buf;
        try {
            if (useQuoted) {
                const ctxInfo = ctx.m.message?.extendedTextMessage?.contextInfo;
                const fakeMsg = {
                    key: {
                        id:          ctxInfo?.stanzaId,
                        remoteJid:   ctx.from,
                        fromMe:      false,
                        participant: ctxInfo?.participant || ctxInfo?.remoteJid,
                    },
                    message: quoted,
                };
                buf = await downloadMediaMessage(fakeMsg, 'buffer', {});
            } else {
                buf = await downloadMediaMessage(ctx.m, 'buffer', {});
            }
        } catch (e) {
            console.error('[URL] Download error:', e.message);
            await ctx.react('❌');
            return ctx.sock.sendMessage(ctx.from, {
                text: `❌ *Could not download the media.*\n\n_${e.message}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        if (!buf || !buf.length) {
            console.error('[URL] Downloaded buffer is empty');
            await ctx.react('❌');
            return ctx.sock.sendMessage(ctx.from, {
                text: '❌ Downloaded media buffer is empty. Please try again.',
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        console.log(`[URL] Downloaded ${buf.length} bytes, type=${targetType}`);

        // ── Resolve mime & filename ────────────────────────────
        const msgObj   = useQuoted ? quoted : ctx.m.message;
        const inner    = msgObj?.[targetType] || {};
        const mime     = inner.mimetype || 'application/octet-stream';
        const ext      = guessExt(mime, targetType);
        const origName = inner.fileName || `panther_${Date.now()}.${ext}`;
        const filename = origName.includes('.') ? origName : `${origName}.${ext}`;
        const sizeMB   = (buf.length / 1024 / 1024).toFixed(2);

        const typeLabel =
            targetType === 'imageMessage'    ? '🖼️ Image'    :
            targetType === 'videoMessage'    ? '🎥 Video'    :
            targetType === 'audioMessage'    ? '🎵 Audio'    :
            targetType === 'stickerMessage'  ? '🎨 Sticker'  :
            targetType === 'documentMessage' ? '📄 Document' : '📁 File';

        // ── Upload ─────────────────────────────────────────────
        let result;
        try {
            result = await tryUpload(buf, filename, mime);
        } catch (e) {
            console.error('[URL] All uploads failed:', e.message);
            await ctx.react('❌');
            return ctx.sock.sendMessage(ctx.from, {
                text:
                    `❌ *Upload failed on all services.*\n\n` +
                    `_${e.message}_\n\n` +
                    `_The file may be too large or services are down. Try again later._`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        console.log(`[URL] Uploaded to ${result.name}: ${result.url}`);
        await ctx.react('✅');

        const replyText =
            `╭─❖ *🔗 MEDIA UPLOAD* ❖─╮\n│\n` +
            `├─❖ ${typeLabel}\n` +
            `├─❖ 📁 *File    :* ${filename}\n` +
            `├─❖ 📏 *Size    :* ${sizeMB} MB\n` +
            `├─❖ 🌐 *Host    :* ${result.name}\n` +
            `├─❖ ♾️ *Expires :* ${result.permanent ? 'Never (Permanent)' : '24 hours'}\n` +
            `│\n` +
            `├─❖ 🔗 *Link:*\n` +
            `│   ${result.url}\n` +
            `│\n╰─❖ _${config.BOT_NAME}_ ❖─╯`;

        await ctx.sock.sendMessage(ctx.from, {
            text: replyText,
            contextInfo: {
                ...channelCtx(),
                externalAdReply: {
                    title: config.BOT_NAME,
                    body: '📋 Copy the uploaded link',
                    mediaType: 1,
                    renderLargerThumbnail: false,
                    showAdAttribution: true,
                    sourceUrl: result.url,
                    thumbnailUrl: 'https://tmpfiles.org/dl/36257265/panther_1777780194457.jpg',
                },
            },
        }, { quoted: ctx.m });
    },
});
