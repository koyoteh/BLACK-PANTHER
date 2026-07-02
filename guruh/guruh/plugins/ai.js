'use strict';
const { addCmd, addTrigger } = require('../../guru/handlers/loader');
const config  = require('../../guru/config/settings');
const { getSetting } = require('../../guru/db/database');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
const { guruApi }    = require('../../guru/utils/guruApi');

const memory = new Map();
function getHistory(jid)  { if (!memory.has(jid)) memory.set(jid, []); return memory.get(jid); }
function addToHistory(jid, role, content) {
    const hist = getHistory(jid);
    hist.push({ role, content });
    if (hist.length > 20) hist.splice(0, 2);
    memory.set(jid, hist);
}
function clearHistory(jid) { memory.delete(jid); }

// ━━ Core AI via GuruTech ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function askAI(userMessage, senderJid, model = 'chat') {
    addToHistory(senderJid, 'user', userMessage);
    try {
        const data  = await guruApi(model, { message: userMessage, q: userMessage });
        const reply = data?.reply || data?.response || data?.text || data?.answer || data?.result;
        if (reply) { addToHistory(senderJid, 'assistant', reply); return String(reply); }
    } catch {}
    return '🤖 I\'m having trouble connecting right now. Please try again shortly.';
}

// ━━ .ai command ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'ai',
    aliases: ['ask', 'gpt', 'chat'],
    desc: 'Chat with the AI assistant (GuruTech)',
    usage: 'ai <your question>',
    category: 'ai',
    handler: async (ctx) => {
        const query = ctx.text ||
            ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
        if (!query) return ctx.reply(`❌ Ask me anything!\n\nExample: \`${config.BOT_PREFIX}ai What is the capital of Kenya?\``);
        await ctx.react('🤖');
        const reply = await askAI(query, ctx.sender, 'chat');
        await ctx.sock.sendMessage(ctx.from, { text: `🤖 *${config.BOT_NAME} AI*\n\n${reply}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('✅');
    },
});

// ━━ GPT-5 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'gpt5',
    aliases: ['gpt'],
    desc: 'Chat with GPT-5 via GuruTech',
    usage: 'gpt5 <question>',
    category: 'ai',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply(`❌ Example: \`${config.BOT_PREFIX}gpt5 Explain black holes\``);
        await ctx.react('✨');
        const reply = await askAI(ctx.text, ctx.sender, 'gpt5');
        await ctx.sock.sendMessage(ctx.from, { text: `✨ *GPT-5*\n\n${reply}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('✅');
    },
});

// ━━ Gemini ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'gemini',
    aliases: ['gem'],
    desc: 'Chat with Gemini 2.5 Pro via GuruTech',
    usage: 'gemini <question>',
    category: 'ai',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply(`❌ Example: \`${config.BOT_PREFIX}gemini Explain relativity\``);
        await ctx.react('💎');
        const reply = await askAI(ctx.text, ctx.sender, 'gemini-pro');
        await ctx.sock.sendMessage(ctx.from, { text: `💎 *Gemini 2.5 Pro*\n\n${reply}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('✅');
    },
});

// ━━ DeepSeek ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'deepseek',
    aliases: ['ds'],
    desc: 'Chat with DeepSeek V3 via GuruTech',
    usage: 'deepseek <question>',
    category: 'ai',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply(`❌ Example: \`${config.BOT_PREFIX}deepseek Solve: integral of sin(x)\``);
        await ctx.react('🔮');
        const reply = await askAI(ctx.text, ctx.sender, 'deepseek');
        await ctx.sock.sendMessage(ctx.from, { text: `🔮 *DeepSeek V3*\n\n${reply}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('✅');
    },
});

// ━━ Code Generator ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'codegen',
    aliases: ['code', 'gencode'],
    desc: 'Generate code with AI',
    usage: 'codegen <what to build>',
    category: 'ai',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply(`❌ Example: \`${config.BOT_PREFIX}codegen Write a Python web scraper\``);
        await ctx.react('💻');
        try {
            const data  = await guruApi('codegen', { prompt: ctx.text });
            const reply = data?.code || data?.reply || data?.response || data?.result || data?.text;
            await ctx.sock.sendMessage(ctx.from, { text: `💻 *Code Generator*\n\n${reply || 'No code generated.'}`, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[codegen]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Code generation failed. Try again.');
        }
    },
});

// ━━ Translate ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'translate',
    aliases: ['tr', 'trans'],
    desc: 'Translate text to any language via GuruTech',
    usage: 'translate <language> | <text>',
    category: 'ai',
    handler: async (ctx) => {
        const parts = ctx.text?.split('|');
        if (!parts || parts.length < 2)
            return ctx.reply(`❌ Usage: \`${config.BOT_PREFIX}translate Spanish | Hello, how are you?\``);
        const to   = parts[0].trim();
        const text = parts.slice(1).join('|').trim();
        await ctx.react('🌐');
        try {
            const data   = await guruApi('translate', { text, to });
            const result = data?.translated || data?.result || data?.text || data?.output;
            await ctx.sock.sendMessage(ctx.from, { text: `🌐 *Translation → ${to}*\n\n📥 *Original:* ${text}\n📤 *Translated:* ${result || 'Translation failed'}`, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[translate]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Translation failed. Try again.');
        }
    },
});

// ━━ Summarize ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'summarize',
    aliases: ['tldr', 'summary'],
    desc: 'Summarize long text with AI',
    usage: 'summarize <text>',
    category: 'ai',
    handler: async (ctx) => {
        const text = ctx.text ||
            ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
        if (!text) return ctx.reply(`❌ Provide text or reply to a message.\n\nExample: \`${config.BOT_PREFIX}summarize <long text here>\``);
        await ctx.react('📝');
        try {
            const data   = await guruApi('summarize', { text, style: 'bullet points' });
            const result = data?.summary || data?.result || data?.text || data?.output;
            await ctx.sock.sendMessage(ctx.from, { text: `📝 *Summary*\n\n${result || 'Could not summarize.'}`, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[summarize]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Summarize failed. Try again.');
        }
    },
});

// ━━ Grammar Fix ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'grammar',
    aliases: ['fix', 'grammarcheck'],
    desc: 'Fix grammar and spelling with AI',
    usage: 'grammar <text>',
    category: 'ai',
    handler: async (ctx) => {
        const text = ctx.text ||
            ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
        if (!text) return ctx.reply(`❌ Provide text to fix.\n\nExample: \`${config.BOT_PREFIX}grammar she dont know nothing\``);
        await ctx.react('✏️');
        try {
            const data   = await guruApi('grammar', { text });
            const result = data?.corrected || data?.result || data?.text || data?.fixed;
            await ctx.sock.sendMessage(ctx.from, { text: `✏️ *Grammar Fix*\n\n📥 *Original:* ${text}\n\n📤 *Corrected:* ${result || text}`, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[grammar]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Grammar check failed. Try again.');
        }
    },
});

// ━━ Paraphrase ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'paraphrase',
    aliases: ['rephrase', 'rewrite'],
    desc: 'Paraphrase/rewrite text with AI',
    usage: 'paraphrase <text>',
    category: 'ai',
    handler: async (ctx) => {
        const text = ctx.text ||
            ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
        if (!text) return ctx.reply(`❌ Provide text to paraphrase.\n\nExample: \`${config.BOT_PREFIX}paraphrase Climate change is serious.\``);
        await ctx.react('🔄');
        try {
            const data   = await guruApi('paraphrase', { text, tone: 'casual' });
            const result = data?.paraphrased || data?.result || data?.text || data?.output;
            await ctx.sock.sendMessage(ctx.from, { text: `🔄 *Paraphrase*\n\n📥 *Original:* ${text}\n\n📤 *Rephrased:* ${result || text}`, contextInfo: channelCtx() }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[paraphrase]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Paraphrase failed. Try again.');
        }
    },
});

// ━━ Image Generator ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'imagine',
    aliases: ['txt2img', 'text2img', 'aiimage', 'genimage'],
    desc: 'Generate an AI image from text (GuruTech)',
    usage: 'imagine <description>',
    category: 'ai',
    handler: async (ctx) => {
        if (!ctx.text) return ctx.reply(`❌ Describe the image you want!\n\nExample: \`${config.BOT_PREFIX}imagine a futuristic city at sunset, neon\``);
        await ctx.react('🎨');
        try {
            const data   = await guruApi('text2img', { q: ctx.text });
            const imgUrl = data?.url || data?.image || data?.result || data?.imageUrl;
            if (!imgUrl) return ctx.reply('❌ Image generation failed. Try a different prompt.');
            await ctx.sock.sendMessage(ctx.from, {
                image:   { url: imgUrl },
                caption: `🎨 *AI Image*\n\n📝 _${ctx.text}_\n\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[imagine]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Image generation failed. Try again.');
        }
    },
});

// ━━ Sentiment ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'sentiment',
    aliases: ['emotion', 'feeling'],
    desc: 'Analyse the sentiment/emotion of text',
    usage: 'sentiment <text>',
    category: 'ai',
    handler: async (ctx) => {
        const text = ctx.text ||
            ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
        if (!text) return ctx.reply(`❌ Provide text.\n\nExample: \`${config.BOT_PREFIX}sentiment I absolutely love this!\``);
        await ctx.react('😊');
        try {
            const data    = await guruApi('sentiment', { text });
            const label   = data?.label || data?.sentiment || data?.result || 'Unknown';
            const score   = data?.score !== undefined ? ` (${Math.round(data.score * 100)}%)` : '';
            const emoji   = /positive/i.test(label) ? '😊' : /negative/i.test(label) ? '😢' : '😐';
            await ctx.sock.sendMessage(ctx.from, {
                text: `${emoji} *Sentiment Analysis*\n\n📝 *Text:* ${text}\n📊 *Result:* ${label}${score}`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (err) {
            console.error('[sentiment]', err.message);
            await ctx.react('❌');
            await ctx.reply('❌ Sentiment analysis failed. Try again.');
        }
    },
});

// ━━ Clear AI memory ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'clearchat',
    aliases: ['clearai', 'resetai'],
    desc: 'Clear your AI conversation history',
    category: 'ai',
    handler: async (ctx) => {
        clearHistory(ctx.sender);
        await ctx.sock.sendMessage(ctx.from, { text: '🗑️ Your AI conversation history has been cleared.', contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ━━ Auto-chatbot trigger (when chatbot mode is on) ━━━━━━━━━━━━━
addTrigger({
    pattern: /^(?!\.)/,
    handler: async (ctx) => {
        const chatbotEnabled = getSetting('CHATBOT') === 'true';
        if (!chatbotEnabled) return;
        if (!ctx.m.body || ctx.m.body.length < 2) return;
        if (ctx.m.fromMe) return;
        const botNumber = ctx.m.botId?.split('@')[0] || '';
        const taggedBot = ctx.m.body.includes(botNumber) || ctx.m.body.includes(config.BOT_NAME);
        if (ctx.isGroup && !taggedBot) return;
        const reply = await askAI(ctx.m.body, ctx.sender, 'chat');
        await ctx.reply(reply);
    },
});

// ━━ Toggle chatbot ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name: 'chatbot',
    desc: 'Toggle auto-chatbot on/off',
    category: 'ai',
    ownerOnly: true,
    handler: async (ctx) => {
        const { setSetting } = require('../../guru/db/database');
        const current = getSetting('CHATBOT') === 'true';
        setSetting('CHATBOT', String(!current));
        await ctx.sock.sendMessage(ctx.from, { text: `🤖 Chatbot is now *${!current ? 'ON' : 'OFF'}*.`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});
