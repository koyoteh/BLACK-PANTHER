'use strict';

const db             = require('../../guru/db/database');
const { getBotName } = require('../botname');
const { addCmd }     = require('../../guru/handlers/loader');
const config         = require('../../guru/config/settings');

const CONFIG_DB_KEY = 'autoreact_config';
const DEFAULT_REACT_CONFIG = {
    enabled: true,
    onlyOnOwnerReply: false,
    viewMode: 'view+react',
    mode: 'fixed',
    fixedEmoji: '🐺',
    reactions: ["🐺", "❤️", "👍", "🔥", "🎉", "😂", "😮", "👏", "🎯", "💯", "🌟", "✨", "⚡", "💥", "🫶"],
    cycleIndex: 0,
    excludedContacts: [],
    logs: [],
    totalReacted: 0,
    lastReacted: null,
    consecutiveReactions: 0,
    lastSender: null,
    lastReactionTime: 0,
    reactedStatuses: [],
    settings: { rateLimitDelay: 2000, reactToAll: true, ignoreConsecutiveLimit: true, noHourlyLimit: true }
};

class AutoReactManager {
    constructor() {
        this.config = this.loadConfig();
        this.lastReactionTime = this.config.lastReactionTime || 0;
        this.reactedStatuses = new Set(this.config.reactedStatuses || []);
        this._queue = [];
        this._draining = false;
        this._saveTimer = null;
        this.cleanupOldReactedStatuses();
    }

    loadConfig() {
        try {
            const c = db.getConfigSync(CONFIG_DB_KEY, DEFAULT_REACT_CONFIG);
            c.reactedStatuses  = c.reactedStatuses || [];
            c.lastReactionTime = c.lastReactionTime || 0;
            c.viewMode         = c.viewMode || 'view+react';
            c.cycleIndex       = c.cycleIndex || 0;
            c.onlyOnOwnerReply = false;
            if (!Array.isArray(c.excludedContacts)) c.excludedContacts = [];
            return { ...DEFAULT_REACT_CONFIG, ...c };
        } catch { return { ...DEFAULT_REACT_CONFIG }; }
    }

    saveConfig() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            try {
                this.config.reactedStatuses = Array.from(this.reactedStatuses);
                this.config.lastReactionTime = this.lastReactionTime;
                db.setConfig(CONFIG_DB_KEY, this.config).catch(() => {});
            } catch {}
            this._saveTimer = null;
        }, 3000);
    }

    saveConfigImmediate() {
        if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
        try {
            this.config.reactedStatuses = Array.from(this.reactedStatuses);
            this.config.lastReactionTime = this.lastReactionTime;
            db.setConfig(CONFIG_DB_KEY, this.config).catch(() => {});
        } catch {}
    }

    cleanupOldReactedStatuses() {
        const now = Date.now();
        let cleaned = false;
        for (const key of Array.from(this.reactedStatuses)) {
            try {
                const parts = key.split('|');
                if (parts.length >= 3 && now - parseInt(parts[2]) > 24 * 60 * 60 * 1000) {
                    this.reactedStatuses.delete(key); cleaned = true;
                }
            } catch { this.reactedStatuses.delete(key); cleaned = true; }
        }
        if (cleaned) this.saveConfig();
    }

    get enabled()      { return this.config.enabled; }
    get viewMode()     { return this.config.viewMode; }
    get mode()         { return this.config.mode; }
    get fixedEmoji()   { return this.config.fixedEmoji; }
    get reactions()    { return this.config.reactions; }
    get logs()         { return this.config.logs; }
    get totalReacted() { return this.config.totalReacted; }

    _normalizeNum(input) {
        return String(input).replace(/[^0-9]/g, '');
    }

    isExcluded(statusKey) {
        const list = this.config.excludedContacts;
        if (!list || list.length === 0) return false;
        const pNum   = (statusKey.participant || statusKey.remoteJid || '').split('@')[0].split(':')[0];
        const altNum = statusKey.remoteJidAlt ? statusKey.remoteJidAlt.split('@')[0] : null;
        return list.some(n => n === pNum || (altNum && n === altNum));
    }

    excludeContact(input) {
        const num = this._normalizeNum(input);
        if (!num) return false;
        if (!this.config.excludedContacts.includes(num)) {
            this.config.excludedContacts.push(num);
            this.saveConfigImmediate();
            return true;
        }
        return false;
    }

    includeContact(input) {
        const num = this._normalizeNum(input);
        const idx = this.config.excludedContacts.indexOf(num);
        if (idx !== -1) {
            this.config.excludedContacts.splice(idx, 1);
            this.saveConfigImmediate();
            return true;
        }
        return false;
    }

    hasReacted(statusKey) {
        const base = `${statusKey.participant || statusKey.remoteJid}|${statusKey.id}`;
        for (const k of this.reactedStatuses) { if (k.startsWith(base)) return true; }
        return false;
    }

    markReacted(statusKey) {
        const key = `${statusKey.participant || statusKey.remoteJid}|${statusKey.id}|${Date.now()}`;
        this.reactedStatuses.add(key);
        if (this.reactedStatuses.size > 500) {
            const arr = Array.from(this.reactedStatuses);
            this.reactedStatuses = new Set(arr.slice(-250));
        }
        this.saveConfig();
    }

    toggle(forceOff = false) {
        this.config.enabled = !forceOff;
        this.saveConfigImmediate(); return this.config.enabled;
    }

    setOnlyOnOwnerReply(value) {
        this.config.onlyOnOwnerReply = !!value;
        this.saveConfigImmediate();
    }

    setViewMode(mode) {
        if (mode === 'view+react' || mode === 'react-only') {
            this.config.viewMode = mode; this.saveConfigImmediate(); return true;
        }
        return false;
    }

    setMode(mode) {
        if (mode === 'random' || mode === 'fixed' || mode === 'cycle') {
            this.config.mode = mode; this.saveConfigImmediate(); return true;
        }
        return false;
    }

    resetCycleIndex() {
        this.config.cycleIndex = 0;
        this.saveConfigImmediate();
    }

    setFixedEmoji(emoji) {
        if ([...emoji].length <= 2) { this.config.fixedEmoji = emoji; this.saveConfigImmediate(); return true; }
        return false;
    }

    addReaction(emoji) {
        if (!this.config.reactions.includes(emoji) && [...emoji].length <= 2) {
            this.config.reactions.push(emoji); this.saveConfigImmediate(); return true;
        }
        return false;
    }

    removeReaction(emoji) {
        const i = this.config.reactions.indexOf(emoji);
        if (i !== -1) { this.config.reactions.splice(i, 1); this.saveConfigImmediate(); return true; }
        return false;
    }

    resetReactions() {
        this.config.reactions = ["🐺", "❤️", "👍", "🔥", "🎉", "😂", "😮", "👏", "🎯", "💯", "🌟", "✨", "⚡", "💥", "🫶"];
        this.saveConfigImmediate();
    }

    addLog(sender, reaction, statusId) {
        const entry = { sender, reaction, statusId, timestamp: Date.now() };
        this.config.logs.push(entry);
        this.config.totalReacted++;
        this.config.lastReacted = entry;
        this.config.consecutiveReactions = this.config.lastSender === sender
            ? this.config.consecutiveReactions + 1 : 1;
        this.config.lastSender = sender;
        if (this.config.logs.length > 100) this.config.logs.shift();
        this.saveConfig();
    }

    clearLogs() {
        Object.assign(this.config, { logs: [], totalReacted: 0, lastReacted: null,
            consecutiveReactions: 0, lastSender: null });
        this.reactedStatuses.clear();
        this.saveConfigImmediate();
    }

    getStats() {
        return {
            enabled: this.config.enabled, onlyOnOwnerReply: this.config.onlyOnOwnerReply,
            viewMode: this.config.viewMode,
            mode: this.config.mode, fixedEmoji: this.config.fixedEmoji,
            reactions: [...this.config.reactions], totalReacted: this.config.totalReacted,
            lastReacted: this.config.lastReacted, consecutiveReactions: this.config.consecutiveReactions,
            reactedStatusesCount: this.reactedStatuses.size,
            excludedCount: this.config.excludedContacts.length,
            settings: { ...this.config.settings }
        };
    }

    getReaction() {
        if (this.config.mode === 'fixed') return this.config.fixedEmoji;
        if (!this.config.reactions.length) return '🐺';
        if (this.config.mode === 'cycle') {
            const emoji = this.config.reactions[this.config.cycleIndex % this.config.reactions.length];
            this.config.cycleIndex = (this.config.cycleIndex + 1) % this.config.reactions.length;
            this.saveConfig();
            return emoji;
        }
        return this.config.reactions[Math.floor(Math.random() * this.config.reactions.length)];
    }

    enqueue(sock, statusKey) {
        if (!this.config.enabled) return;
        if (this.hasReacted(statusKey)) return;
        if (this.isExcluded(statusKey)) return;

        this.markReacted(statusKey);

        const resolvedSender = statusKey.participantPn || statusKey.participant || statusKey.remoteJid;
        const displayId = '+' + resolvedSender.split('@')[0].split(':')[0];

        this._queue.push({ sock, statusKey, displayId });
        this._drain();
    }

    _drain() {
        if (this._draining) return;
        this._draining = true;
        this._processNext().catch(() => { this._draining = false; });
    }

    async _processNext() {
        while (this._queue.length > 0) {
            const { sock, statusKey, displayId } = this._queue.shift();
            const wait = this.config.settings.rateLimitDelay - (Date.now() - this.lastReactionTime);
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            await this._sendReaction(sock, statusKey, displayId);
        }
        this._draining = false;
    }

    async _sendReaction(sock, statusKey, displayId) {
        try {
            const resolvedJid = statusKey.participantPn
                || statusKey.remoteJidAlt
                || (statusKey.participant && !statusKey.participant.includes('@lid') ? statusKey.participant : null)
                || statusKey.participant
                || statusKey.remoteJid;

            if (this.config.viewMode === 'view+react') {
                try {
                    await sock.readMessages([{
                        remoteJid:   'status@broadcast',
                        id:          statusKey.id,
                        fromMe:      false,
                        participant: resolvedJid
                    }]);
                } catch (_) {}
            }

            const emoji = this.getReaction();

            const rawBotId  = sock.user?.id || sock.user?.jid || '';
            const botJid    = rawBotId ? rawBotId.split(':')[0].split('@')[0] + '@s.whatsapp.net' : '';

            await sock.sendMessage(
                'status@broadcast',
                {
                    react: {
                        text: emoji,
                        key: {
                            remoteJid:   'status@broadcast',
                            id:          statusKey.id,
                            participant: resolvedJid,
                            fromMe:      false
                        }
                    }
                },
                { statusJidList: [...new Set([resolvedJid, ...(botJid ? [botJid] : [])])] }
            );

            this.lastReactionTime = Date.now();
            this.addLog(displayId, emoji, statusKey.id);
            console.log(`\x1b[32m✅ [AUTOREACT] Reacted ${emoji} to status from ${displayId}\x1b[0m`);

        } catch (error) {
            if (error.message?.includes('rate-overlimit') || error.message?.includes('rate limit')) {
                this.config.settings.rateLimitDelay = Math.min(this.config.settings.rateLimitDelay * 2, 10000);
                this.saveConfig();
                console.log(`\x1b[33m⚠️ [AUTOREACT] Rate limit hit — delay bumped to ${this.config.settings.rateLimitDelay}ms\x1b[0m`);
            }
            console.log(`\x1b[31m❌ [AUTOREACT] REACT FAILED for ${displayId}: ${error.message}\x1b[0m`);
        }
    }
}

const autoReactManager = new AutoReactManager();
globalThis._autoReactManager = autoReactManager;
globalThis._autoReactReload = () => { try { autoReactManager.config = autoReactManager.loadConfig(); } catch {} };

async function handleAutoReact(sock, statusKey) {
    if (autoReactManager.config.onlyOnOwnerReply) return;
    autoReactManager.enqueue(sock, statusKey);
}

async function triggerReactFromOwnerReply(sock, statusKey) {
    autoReactManager.enqueue(sock, statusKey);
}

function wasAutoReacted(msgId) {
    if (!msgId) return false;
    for (const k of autoReactManager.reactedStatuses) {
        if (k.split('|')[1] === msgId) return true;
    }
    return false;
}

addCmd({
    name: 'autoreactstatus',
    aliases: ['reactstatus', 'statusreact', 'sr', 'reacts', 'autoreact', 'autolike'],
    desc: 'Automatically react to WhatsApp statuses 🐺',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        try {
            const { args, reply, isOwner } = ctx;
            const prefix = config.BOT_PREFIX;

            if (args.length === 0) {
                const s = autoReactManager.getStats();
                let text = `╭─⌈ 🐺 *AUTOREACTSTATUS* ⌋\n│\n`;
                text += `├─⊷ *${prefix}sr on / off*\n│  └⊷ Enable or disable\n`;
                text += `├─⊷ *${prefix}sr exclude <number>*\n│  └⊷ Skip a contact\n`;
                text += `├─⊷ *${prefix}sr include <number>*\n│  └⊷ Remove from skip list\n`;
                text += `├─⊷ *${prefix}sr excluded*\n│  └⊷ Show skip list\n`;
                text += `├─⊷ *${prefix}sr ownerreply*\n│  └⊷ Toggle: react only when you reply (current: ${autoReactManager.config.onlyOnOwnerReply ? 'ON ✅' : 'OFF ❌'})\n`;
                text += `├─⊷ *${prefix}sr view+react*\n│  └⊷ View then react\n`;
                text += `├─⊷ *${prefix}sr react-only*\n│  └⊷ React without viewing\n`;
                text += `├─⊷ *${prefix}sr random*\n│  └⊷ Random emoji mode\n`;
                text += `├─⊷ *${prefix}sr cycle*\n│  └⊷ Sequential emoji mode (1→2→3→loop)\n`;
                text += `├─⊷ *${prefix}sr setrandom 😂,🫡,🔥*\n│  └⊷ Set cycle pool (comma-separated)\n`;
                text += `├─⊷ *${prefix}sr emoji <emoji>*\n│  └⊷ Set fixed emoji\n`;
                text += `├─⊷ *${prefix}sr stats*\n│  └⊷ Statistics\n`;
                text += `╰⊷ *Powered by ${getBotName().toUpperCase()}*`;
                await reply(text);
                return;
            }

            const action = args[0].toLowerCase();

            switch (action) {
                case 'on': case 'enable': case 'start': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    autoReactManager.toggle(false);
                    await reply(`✅ *AUTOREACTSTATUS ENABLED*\n\n🐺 Will now ${autoReactManager.viewMode === 'view+react' ? 'view then react to' : 'react to'} ALL statuses!\n\nView Mode: ${autoReactManager.viewMode}\nEmoji: ${autoReactManager.fixedEmoji}\nMode: ${autoReactManager.mode}`);
                    break;
                }
                case 'off': case 'disable': case 'stop': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    autoReactManager.toggle(true);
                    await reply(`❌ *AUTOREACTSTATUS DISABLED*`);
                    break;
                }
                case 'exclude': case 'skip': case 'block': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    const num = args[1];
                    if (!num) { await reply(`Usage: *${prefix}sr exclude <number>*\nExample: ${prefix}sr exclude 254703123456`); return; }
                    if (autoReactManager.excludeContact(num)) {
                        const clean = num.replace(/[^0-9]/g, '');
                        await reply(`✅ *Excluded from auto-react*\n\n🚫 ${clean}\n\nTheir statuses will be silently skipped.`);
                    } else {
                        await reply(`⚠️ ${num.replace(/[^0-9]/g, '')} is already on the skip list.`);
                    }
                    break;
                }
                case 'include': case 'unexclude': case 'unblock': case 'unskip': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    const num = args[1];
                    if (!num) { await reply(`Usage: *${prefix}sr include <number>*`); return; }
                    if (autoReactManager.includeContact(num)) {
                        const clean = num.replace(/[^0-9]/g, '');
                        await reply(`✅ *Removed from skip list*\n\n🐺 ${clean} will now be auto-reacted again.`);
                    } else {
                        await reply(`⚠️ ${num.replace(/[^0-9]/g, '')} was not on the skip list.`);
                    }
                    break;
                }
                case 'excluded': case 'skiplist': case 'blocklist': case 'exclusions': {
                    const list = autoReactManager.config.excludedContacts;
                    if (!list.length) {
                        await reply(`📭 *No contacts excluded from auto-react.*\n\nUse *${prefix}sr exclude <number>* to skip someone.`);
                        return;
                    }
                    let text = `🚫 *AUTOREACT SKIP LIST (${list.length})*\n\n`;
                    list.forEach((n, i) => { text += `${i + 1}. +${n}\n`; });
                    text += `\nUse *${prefix}sr include <number>* to remove.`;
                    await reply(text);
                    break;
                }
                case 'view+react': case 'viewreact': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    autoReactManager.setViewMode('view+react');
                    await reply(`👁️ + 🐺 *VIEW+REACT MODE*\n\nWill view the status first, then react.\nSender sees you in their viewers list.`);
                    break;
                }
                case 'react-only': case 'reactonly': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    autoReactManager.setViewMode('react-only');
                    await reply(`🐺 *REACT-ONLY MODE*\n\nWill react without marking as viewed.\nSender will NOT see you in their viewers list.`);
                    break;
                }
                case 'setrandom': case 'setemojis': case 'setpool': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    const inputEmojis = args.slice(1).join(' ').split(',').map(e => e.trim()).filter(Boolean);
                    if (!inputEmojis.length) {
                        await reply(
                            `╭─⌈ 🎲 *SETRANDOM* ⌋\n│\n` +
                            `├─⊷ Sets the full random emoji pool\n│\n` +
                            `├─⊷ *Usage:*\n│  └⊷ ${prefix}sr setrandom 🐺,❤️,🔥,💯,🎉\n│\n` +
                            `├─⊷ *Current pool (${autoReactManager.reactions.length}):*\n` +
                            `│  └⊷ ${autoReactManager.reactions.join(' ')}\n│\n` +
                            `╰⊷ Separate each emoji with a comma`
                        );
                        return;
                    }
                    const valid = [];
                    const invalid = [];
                    for (const e of inputEmojis) {
                        const chars = [...e];
                        if (chars.length >= 1 && chars.length <= 4 && /\p{Emoji}/u.test(e)) {
                            if (!valid.includes(e)) valid.push(e);
                        } else {
                            invalid.push(e);
                        }
                    }
                    if (!valid.length) {
                        await reply(`❌ No valid emojis found.\n\nUsage: *${prefix}sr setrandom 🐺,❤️,🔥,💯*\nSeparate each emoji with a comma.`);
                        return;
                    }
                    autoReactManager.config.reactions = valid;
                    autoReactManager.config.cycleIndex = 0;
                    autoReactManager.setMode('cycle');
                    autoReactManager.saveConfigImmediate();
                    let text = `✅ *CYCLE EMOJI POOL SET*\n\n`;
                    text += `🔄 Mode: CYCLE (in order, looping)\n`;
                    text += `📦 Pool (${valid.length}):\n`;
                    valid.forEach((e, i) => { text += `  ${i + 1}. ${e}\n`; });
                    if (invalid.length) text += `\n⚠️ Skipped (not emoji): ${invalid.join(' ')}`;
                    text += `\nStatus 1→${valid[0]}, Status 2→${valid[1] || valid[0]}, ...`;
                    await reply(text);
                    break;
                }
                case 'cycle': case 'sequential': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    autoReactManager.setMode('cycle');
                    autoReactManager.resetCycleIndex();
                    const pool = autoReactManager.reactions;
                    await reply(`🔄 *CYCLE MODE*\n\nEmojis used in order, looping.\n\n${pool.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\nCounter reset to start.`);
                    break;
                }
                case 'random': {
                    autoReactManager.setMode('random');
                    await reply(`🎲 *RANDOM MODE*\n\nOne random emoji per status!\n\n${autoReactManager.reactions.join(' ')}`);
                    break;
                }
                case 'fixed': {
                    autoReactManager.setMode('fixed');
                    await reply(`📌 *FIXED MODE*\n\nWill always react with: ${autoReactManager.fixedEmoji}`);
                    break;
                }
                case 'emoji': {
                    if (!args[1]) { await reply(`Current emoji: ${autoReactManager.fixedEmoji}\n\nUsage: *${prefix}sr emoji 🐺*`); return; }
                    const emoji = args[1];
                    if (autoReactManager.setFixedEmoji(emoji)) {
                        autoReactManager.setMode('fixed');
                        await reply(`✅ Emoji set to: ${emoji}`);
                    } else {
                        await reply('❌ Invalid emoji.');
                    }
                    break;
                }
                case 'ownerreply': case 'onlyownerreply': case 'replymode': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    const cur = autoReactManager.config.onlyOnOwnerReply;
                    autoReactManager.setOnlyOnOwnerReply(!cur);
                    const now = autoReactManager.config.onlyOnOwnerReply;
                    await reply(now
                        ? `✅ *OWNER-REPLY MODE ON*\n\nBot will only react to a status when you reply to it.`
                        : `🔄 *AUTO-REACT ALL MODE ON*\n\nBot will now automatically react to every status it receives.`
                    );
                    break;
                }
                case 'stats': case 'statistics': case 'info': {
                    const s = autoReactManager.getStats();
                    const vmLabel = s.viewMode === 'view+react' ? '👁️ + 🐺 View then React' : '🐺 React only';
                    let text = `📊 *AUTOREACTSTATUS STATS*\n\n`;
                    text += `🟢 Status      : ${s.enabled ? 'ACTIVE ✅' : 'INACTIVE ❌'}\n`;
                    text += `💬 Trigger     : ${s.onlyOnOwnerReply ? 'Owner-reply only 📩' : 'Auto-react all 🔄'}\n`;
                    text += `👁️ View Mode   : ${vmLabel}\n`;
                    const modeLabel = s.mode === 'fixed' ? `FIXED (${s.fixedEmoji})` : s.mode === 'cycle' ? `CYCLE (pos ${autoReactManager.config.cycleIndex + 1}/${autoReactManager.reactions.length})` : 'RANDOM';
                    text += `🎭 Emoji Mode  : ${modeLabel}\n`;
                    text += `🐺 Total       : *${s.totalReacted}*\n`;
                    text += `📝 Tracked     : ${s.reactedStatusesCount}\n`;
                    text += `🔄 Consecutive : ${s.consecutiveReactions}\n`;
                    text += `🚫 Excluded    : ${s.excludedCount}\n`;
                    text += `⏱️ Queue       : ${autoReactManager._queue.length} pending\n`;
                    if (s.lastReacted) {
                        const ago = Math.floor((Date.now() - s.lastReacted.timestamp) / 60000);
                        text += `\n🕒 Last: ${s.lastReacted.sender} ${s.lastReacted.reaction} (${ago < 1 ? 'just now' : ago + ' min ago'})`;
                    }
                    await reply(text);
                    break;
                }
                case 'list': case 'emojis': {
                    await reply(`😄 *Emoji List (${autoReactManager.reactions.length}):*\n\n${autoReactManager.reactions.join(' ')}\n\nMode: ${autoReactManager.mode} | Fixed: ${autoReactManager.fixedEmoji}`);
                    break;
                }
                case 'add': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    if (!args[1]) { await reply(`Usage: \`${prefix}sr add ❤️\``); return; }
                    if (autoReactManager.addReaction(args[1])) {
                        await reply(`✅ ${args[1]} added.\n\n${autoReactManager.reactions.join(' ')}`);
                    } else {
                        await reply(`⚠️ Already in list or invalid.`);
                    }
                    break;
                }
                case 'remove': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    if (!args[1]) { await reply(`Usage: \`${prefix}sr remove 🔥\``); return; }
                    if (autoReactManager.removeReaction(args[1])) {
                        await reply(`✅ ${args[1]} removed.\n\n${autoReactManager.reactions.join(' ')}`);
                    } else {
                        await reply(`❌ Not found.`);
                    }
                    break;
                }
                case 'reset': case 'clear': {
                    if (!isOwner) { await reply("❌ Owner only!"); return; }
                    autoReactManager.clearLogs();
                    autoReactManager.resetReactions();
                    await reply(`🔄 *Reset complete.*\n\nLogs cleared, reactions reset to defaults.`);
                    break;
                }
                default:
                    await reply(`❓ Unknown option. Use *${prefix}sr* to see available commands.`);
            }
        } catch (err) {
            console.error('[AUTOREACTSTATUS] Error:', err.message);
        }
    }
});

module.exports = { handleAutoReact, autoReactManager, triggerReactFromOwnerReply, wasAutoReacted };
