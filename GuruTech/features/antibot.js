import { getGroupSettings, getKnownBots } from '../database/config.js';
import { resolveTargetJid } from '../lib/lidResolver.js';
import { canEnforceBotCommand, extractCommandText, isPrefixedBotCommand } from '../lib/botSignature.js';
import { aliases, commands, commandsReady } from '../handlers/commandHandler.js';

const _num = (jid) => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const _pNum = (p) => {
    const phone = p.phoneNumber || p.phone_number || '';
    if (phone) return _num(phone);
    const base = p.id || p.jid || '';
    if (base && !base.endsWith('@lid')) return _num(base);
    return _num(p.lid || base);
};

const fmt = (msg) => `╭─❏ 「 ANTIBOT 」\n│ ${msg}\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`;
const MAX_WARNS = 2;
const KICK_IMMUNITY_MS = 30000;

const _warnCount = new Map();
const _recentlyKicked = new Map();
const _processed = new Set();
const _gsCache = new Map();
const _GS_TTL = 30_000;

async function _cachedGS(jid) {
    const now = Date.now();
    const hit = _gsCache.get(jid);
    if (hit && (now - hit.ts) < _GS_TTL) return hit.val;
    const val = await getGroupSettings(jid);
    _gsCache.set(jid, { val, ts: now });
    if (_gsCache.size > 500) { const first = _gsCache.keys().next().value; _gsCache.delete(first); }
    return val;
}

let _botCommandNames = null;
async function getBotCommandNames() {
    await commandsReady;
    if (!_botCommandNames) {
        _botCommandNames = new Set([...Object.keys(commands), ...Object.keys(aliases)].map(name => String(name).toLowerCase()));
    }
    return _botCommandNames;
}

function _isRecentlyKicked(trackKey) {
    if (!_recentlyKicked.has(trackKey)) return false;
    const ts = _recentlyKicked.get(trackKey);
    if (Date.now() - ts < KICK_IMMUNITY_MS) return true;
    _recentlyKicked.delete(trackKey);
    return false;
}

function _markKicked(trackKey) {
    _recentlyKicked.set(trackKey, Date.now());
    if (_recentlyKicked.size > 2000) { const first = _recentlyKicked.keys().next().value; _recentlyKicked.delete(first); }
}

async function punish(client, m, senderNum, trackKey, forceKick) {
    if (_isRecentlyKicked(trackKey)) return;

    const meta = await client.groupMetadata(m.chat);
    const sender = resolveTargetJid(m.sender, meta.participants) || m.sender;
    if (!sender) return;

    const sNum = _num(sender);
    const botRaw = client.decodeJid ? client.decodeJid(client.user.id) : (client.user?.id || '');
    const botNum = _num(botRaw);

    const isAdmin = meta.participants.some(p => _pNum(p) === sNum && (p.admin === 'admin' || p.admin === 'superadmin'));
    const isBotAdmin = meta.participants.some(p => _pNum(p) === botNum && (p.admin === 'admin' || p.admin === 'superadmin'));

    if (!canEnforceBotCommand(isBotAdmin, isAdmin)) return;

    if (m.key?.id) {
        try {
            await client.sendMessage(m.chat, {
                delete: {
                    remoteJid: m.chat,
                    fromMe: false,
                    id: m.key.id,
                    participant: m.key.participant || m.sender
                }
            });
        } catch {}
    }

    if (forceKick) {
        _warnCount.delete(trackKey);
        _markKicked(trackKey);
        try { await client.groupParticipantsUpdate(m.chat, [sender], 'remove'); } catch {}
        return client.sendMessage(m.chat, {
            text: fmt(`🚫 @${sNum} was kicked for using a registered bot command.\n│ Only group admins may use bot commands here.`),
            mentions: [sender]
        });
    }

    const count = (_warnCount.get(trackKey) || 0) + 1;
    _warnCount.set(trackKey, count);
    if (_warnCount.size > 5000) { const first = _warnCount.keys().next().value; _warnCount.delete(first); }

    if (count < MAX_WARNS) {
        return client.sendMessage(m.chat, {
            text: fmt(`⚠️ @${sNum}, bot commands are for group admins only.\n│ Warning ${count}/${MAX_WARNS}. Another command attempt gets you kicked.`),
            mentions: [sender]
        });
    }

    _warnCount.delete(trackKey);
    _markKicked(trackKey);
    try { await client.groupParticipantsUpdate(m.chat, [sender], 'remove'); } catch {}
    return client.sendMessage(m.chat, {
        text: fmt(`🚫 @${sNum} was kicked after repeated registered bot commands.`),
        mentions: [sender]
    });
}

function _withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('[ANTIBOT TIMEOUT] ' + label + ' took longer than ' + ms + 'ms')), ms))
    ]);
}

export default async (client, m) => {
    try {
        if (!m || !m.chat || !m.chat.endsWith('@g.us')) return;
        if (m.key?.fromMe || m.fromMe) return;

        // Never infer a command from a sender ID, message ID, sticker, audio, or other metadata.
        const messageText = extractCommandText(m.message);
        if (!messageText || !isPrefixedBotCommand(messageText, await getBotCommandNames())) return;

        const msgId = m.id || m.key?.id || '';
        if (msgId && _processed.has(msgId)) return;
        if (msgId) {
            _processed.add(msgId);
            if (_processed.size > 500) { const first = _processed.values().next().value; _processed.delete(first); }
        }

        const gs = await _withTimeout(_cachedGS(m.chat), 8000, 'getGroupSettings(' + m.chat + ')');
        const mode = gs?.antibot;
        if (!mode || mode === 'off' || mode === 0 || mode === false || mode === '0') return;

        const senderNum = _num(m.sender);
        if (!senderNum) return;
        const trackKey = m.chat + ':' + senderNum;
        if (_isRecentlyKicked(trackKey)) return;

        const knownBots = await _withTimeout(getKnownBots(), 8000, 'getKnownBots()').catch(() => []);
        if (knownBots.includes(senderNum)) return punish(client, m, senderNum, trackKey, true);

        const forceKick = mode === 'kick' || mode === 'remove';
        return punish(client, m, senderNum, trackKey, forceKick);
    } catch (e) {
        console.log('❌ [ANTIBOT INTERNAL]:', e?.message || e);
    }
};
