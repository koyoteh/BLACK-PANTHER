'use strict';
const { addCmd, addTrigger } = require('../../guru/handlers/loader');
const axios   = require('axios');
const config  = require('../../guru/config/settings');
const { getSetting } = require('../../guru/db/database');

// ── Simple conversation memory (per sender, max 10 turns) ──────
const memory = new Map();

function getHistory(jid) {
    if (!memory.has(jid)) memory.set(jid, []);
    return memory.get(jid);
}
function addToHistory(jid, role, content) {
    const hist = getHistory(jid);
    hist.push({ role, content });
    if (hist.length > 20) hist.splice(0, 2); // keep last 10 pairs
    memory.set(jid, hist);
}
function clearHistory(jid) {
    memory.delete(jid);
}

// ── System prompt ──────────────────────────────────────────────
const SYSTEM = `You are ${config.BOT_NAME}, a helpful and friendly WhatsApp assistant bot created by GuruTech (owner: +254105521300). 
You reply concisely, helpfully and in the same language the user writes in. 
You can help with general questions, coding, writing, maths, and everyday tasks.
Never reveal you are ChatGPT or any other AI — you are ${config.BOT_NAME}.`;

// ── Core AI query function ─────────────────────────────────────
async function askAI(userMessage, senderJid) {
    addToHistory(senderJid, 'user', userMessage);

    // Try free APIs in order
    const providers = [
        () => callPollinations(userMessage),
        () => callJokeAPI(userMessage),          // fallback for trivial questions
    ];

    for (const provider of providers) {
        try {
            const reply = await provider();
            if (reply) {
                addToHistory(senderJid, 'assistant', reply);
                return reply;
            }
        } catch {}
    }
    return '🤖 I\'m having trouble connecting right now. Please try again shortly.';
}

async function callPollinations(prompt) {
    const res = await axios.get(
        `https://text.pollinations.ai/${encodeURIComponent(prompt)}`,
        { timeout: 20000, headers: { 'User-Agent': 'BlackPantherMD/1.0' } }
    );
    return typeof res.data === 'string' ? res.data.trim() : null;
}

async function callJokeAPI(prompt) {
    // Very lightweight fallback — only for very short messages
    if (prompt.length > 50) return null;
    return null;
}

// ── .ai command ────────────────────────────────────────────────
addCmd({
    name: 'ai',
    aliases: ['ask', 'gpt', 'chat'],
    desc: 'Chat with the AI assistant',
    usage: 'ai <your question>',
    category: 'ai',
    handler: async (ctx) => {
        const query = ctx.text ||
            ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
        if (!query) return ctx.reply(`❌ Ask me anything!\n\nExample: \`${config.BOT_PREFIX}ai What is the capital of Kenya?\``);

        await ctx.react('🤖');
        const reply = await askAI(query, ctx.sender);
        await ctx.sock.sendMessage(ctx.from, { text: `🤖 *${config.BOT_NAME} AI*\n\n${reply}`, contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('✅');
    },
});

// ── Clear AI memory ────────────────────────────────────────────
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

// ── Auto-chatbot trigger (when chatbot mode is on) ─────────────
addTrigger({
    pattern: /^(?!\.)/,   // any message not starting with prefix
    handler: async (ctx) => {
        const chatbotEnabled = getSetting('CHATBOT') === 'true';
        if (!chatbotEnabled) return;
        if (!ctx.m.body || ctx.m.body.length < 2) return;
        if (ctx.m.fromMe) return;

        // Only respond in DMs, or if bot is tagged in groups
        const botNumber = ctx.m.botId?.split('@')[0] || '';
        const taggedBot = ctx.m.body.includes(botNumber) || ctx.m.body.includes(config.BOT_NAME);
        if (ctx.isGroup && !taggedBot) return;

        const reply = await askAI(ctx.m.body, ctx.sender);
        await ctx.reply(reply);
    },
});

// ── Toggle chatbot ─────────────────────────────────────────────
addCmd({
    name: 'chatbot',
    desc: 'Toggle auto-chatbot on/off',
    category: 'ai',
    ownerOnly: true,
    handler: async (ctx) => {
        const { setSetting } = require('../../guru/db/database');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
        const current = getSetting('CHATBOT') === 'true';
        setSetting('CHATBOT', String(!current));
        await ctx.sock.sendMessage(ctx.from, { text: `🤖 Chatbot is now *${!current ? 'ON' : 'OFF'}*.`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});
