'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  ⚡  BLACK PANTHER MD  —  gmdFunctions2.js  (Auto Features)
//  👑  Owner : Koyoteh  |  📞 +254105521300
//  🛡️  AntiLink · AntiSpam · AntiCall · AutoBio · AutoReact
//  💬  ChatBot · Presence · AntiDelete · AntiEdit · AntiViewOnce
//  📢  Channel forwardedNewsletterMessageInfo tag on every response
// ╚══════════════════════════════════════════════════════════════╝

const axios   = require('axios');
const config  = require('../config/settings');
const logger  = require('./logger');
const { gmdBanner, gmdTable, pickRandom, sleep } = require('./gmdFunctions');
const { getGroupSettings, getSetting }            = require('../db/database');
const {
    sendButtons:           giftedSendButtons,
    sendInteractiveMessage: giftedSendInteractive,
} = require('gifted-btns');

// ═══════════════════════════════════════════════════════════════
//  📢  CHANNEL CONTEXT INFO
//  Uses forwardedNewsletterMessageInfo so every response carries
//  a "Forwarded from <channel>" chip — works in groups & DMs.
//  Also includes externalAdReply for a richer card in DMs.
// ═══════════════════════════════════════════════════════════════

function channelCtx() {
    return {
        // Newsletter forwarding chip — shows "Forwarded from <channel>" tag
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid:     config.CHANNEL_JID,
            newsletterName:    config.CHANNEL_NEWSLETTER_NAME,
            serverMessageId:   Math.floor(Math.random() * 9000) + 1000,
        },
        // External ad card — rich preview in DMs
        externalAdReply: {
            title:                 config.BOT_NAME,
            body:                  '🐾 Follow our WhatsApp Channel',
            mediaType:             1,
            renderLargerThumbnail: false,
            showAdAttribution:     true,
            sourceUrl:             config.CHANNEL_URL,
            thumbnailUrl:          'https://i.ibb.co/PZjVDnBM/upload-1778637749645-4b17ed31-jpg.jpg',
        },
    };
}

async function sendWithChannel(sock, jid, content, opts = {}) {
    const ctx = channelCtx();
    if (content.sticker !== undefined) {
        return sock.sendMessage(jid, content, opts);
    }
    return sock.sendMessage(jid, { ...content, contextInfo: ctx }, opts);
}

// ═══════════════════════════════════════════════════════════════
//  ✨  EMOJIS
// ═══════════════════════════════════════════════════════════════

const REACT_EMOJIS = [
    '❤️','💛','💚','💙','💜','🧡','🤎','🖤','🤍',
    '🔥','⭐','🌟','✨','🎉','🎊','💯','🥰','😍',
    '👏','🙌','💪','🫡','🤩','😎','🐾',
];

const LINK_REGEX = /https?:\/\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+/gi;

// ═══════════════════════════════════════════════════════════════
//  💬  AUTO REACT
// ═══════════════════════════════════════════════════════════════

async function PantherAutoReact(emoji, msg, sock) {
    const em = emoji || pickRandom(REACT_EMOJIS);
    await sock.sendMessage(msg.key.remoteJid, {
        react: { text: em, key: msg.key },
    }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
//  🔗  ANTI-LINK
// ═══════════════════════════════════════════════════════════════

async function PantherAntiLink(sock, msg, getGroupMetadataFn) {
    try {
        const { from, sender, body, isAdmin, isOwner, fromMe, isGroup } = msg;
        if (!isGroup || isAdmin || isOwner || fromMe) return;
        const settings = getGroupSettings(from);
        if (!settings?.antilink) return;
        if (!LINK_REGEX.test(body)) return;

        const groupMeta = await getGroupMetadataFn(sock, from).catch(() => null);
        const botJid    = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
        const isBotAdm  = groupMeta?.participants?.find(p => p.id === botJid)?.admin;
        const senderNum = sender.split('@')[0];

        await sock.sendMessage(from, { delete: msg.key }).catch(() => {});

        const text = gmdBanner('🔗 AntiLink Triggered', [
            `👤 User   : @${senderNum}`,
            `🚫 Action : Message Deleted`,
            `⚠️  Links are not allowed here!`,
        ], config.BOT_NAME);

        await sendWithChannel(sock, from, { text, mentions: [sender] });

        if (isBotAdm) {
            await sleep(1000);
            await sock.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
            const kickText = gmdBanner('🚫 User Removed', [
                `👤 User   : @${senderNum}`,
                `📋 Reason : Sent a link`,
            ], config.BOT_NAME);
            await sendWithChannel(sock, from, { text: kickText, mentions: [sender] });
        }
    } catch (err) {
        logger.error('ANTILINK', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  🤬  ANTI BAD WORD
// ═══════════════════════════════════════════════════════════════

async function PantherAntiBad(sock, msg, badWords = []) {
    try {
        const { from, sender, body, isAdmin, isOwner, fromMe, isGroup } = msg;
        if (!isGroup || isAdmin || isOwner || fromMe) return;
        const settings = getGroupSettings(from);
        if (!settings?.antibadword) return;
        const lower = (body || '').toLowerCase();
        const found = badWords.find(w => lower.includes(w.toLowerCase()));
        if (!found) return;
        await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
        const senderNum = sender.split('@')[0];
        const text = gmdBanner('🤬 Bad Word Detected', [
            `👤 User   : @${senderNum}`,
            `🚫 Action : Message Deleted`,
        ], config.BOT_NAME);
        await sendWithChannel(sock, from, { text, mentions: [sender] });
    } catch (err) {
        logger.error('ANTIBAD', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  📞  ANTI CALL
// ═══════════════════════════════════════════════════════════════

async function PantherAntiCall(calls, sock) {
    try {
        if (!getSetting('ANTI_CALL') || getSetting('ANTI_CALL') !== 'true') return;
        for (const call of (calls || [])) {
            if (call.isGroup) continue;
            await sock.rejectCall(call.id, call.from).catch(() => {});
            await sendWithChannel(sock, call.from, {
                text: `❌ *Calls are not allowed!*\n\n_${config.BOT_NAME} does not accept calls._`,
            }).catch(() => {});
        }
    } catch (err) {
        logger.error('ANTICALL', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  🗄️  MESSAGE STORE (for anti-delete & viewonce)
// ═══════════════════════════════════════════════════════════════

const msgStore = new Map();

function storeMessage(msg) {
    try {
        if (!msg?.key?.id) return;
        const from   = msg.key.remoteJid || '';
        const sender = msg.key.participant || from;
        msgStore.set(msg.key.id, {
            key:    msg.key,
            msg,
            from,
            sender,
            ts:     Date.now(),
        });
        // Keep store bounded — drop oldest entries after 500
        if (msgStore.size > 500) {
            const oldest = msgStore.keys().next().value;
            msgStore.delete(oldest);
        }
        // Auto-expire after 15 minutes
        setTimeout(() => msgStore.delete(msg.key.id), 15 * 60 * 1000);
    } catch {}
}

function getStoredMessage(id) {
    return msgStore.get(id)?.msg?.message || undefined;
}

// ═══════════════════════════════════════════════════════════════
//  🗑️  ANTI-DELETE
// ═══════════════════════════════════════════════════════════════

async function PantherAntiDelete(sock, key) {
    try {
        const from     = key?.remoteJid;
        const settings = getGroupSettings(from);
        if (!settings?.antidelete) return;

        const stored = msgStore.get(key?.id);
        if (!stored?.msg?.message) return;

        const sender = (stored.sender || from).split('@')[0];
        const type   = Object.keys(stored.msg.message || {})[0];

        const header = gmdBanner('🗑️ Deleted Message Recovered', [
            `👤 Sender : @${sender}`,
            `📂 Type   : ${type?.replace('Message', '') || 'text'}`,
            `🔄 Restored by ${config.BOT_NAME}`,
        ], config.BOT_NAME);

        await sendWithChannel(sock, from, { text: header, mentions: [stored.sender] });
        await sock.sendMessage(from, stored.msg.message).catch(() => {});
    } catch (err) {
        logger.error('ANTIDELETE', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  ✏️  ANTI EDIT
// ═══════════════════════════════════════════════════════════════

// update = { key: MessageKey, update: Partial<WAMessage> }
// The edited content lives in update.update.message.protocolMessage
async function PantherAntiEdit(sock, update) {
    try {
        const proto  = update?.update?.message?.protocolMessage;
        const edited = proto?.editedMessage;
        const from   = update?.key?.remoteJid;
        if (!edited || !from) return;

        const settings = getGroupSettings(from);
        if (!settings?.antiedit) return;

        // proto.key points to the original message that was edited
        const original = msgStore.get(proto?.key?.id);
        if (!original) return;

        const sender  = (update?.key?.participant || from).split('@')[0];
        const oldText = original.msg?.message?.conversation ||
                        original.msg?.message?.extendedTextMessage?.text || '(media)';
        const newText = edited?.conversation || edited?.extendedTextMessage?.text || '(media)';

        const text = gmdTable('✏️ Message Edited', [
            ['👤 User',   `@${sender}`],
            ['📝 Before', oldText.slice(0, 300)],
            ['✏️  After',  newText.slice(0, 300)],
        ], config.BOT_NAME);

        await sendWithChannel(sock, from, {
            text,
            mentions: [update?.key?.participant || from],
        });
    } catch (err) {
        logger.error('ANTIEDIT', err.message);
    }
}


// ═══════════════════════════════════════════════════════════════
//  🟢  PRESENCE
// ═══════════════════════════════════════════════════════════════

async function PantherPresence(sock, from, type = 'composing') {
    try {
        await sock.sendPresenceUpdate(type, from);
        await sleep(1500);
        await sock.sendPresenceUpdate('paused', from);
    } catch {}
}

// ═══════════════════════════════════════════════════════════════
//  🌿  AUTO BIO
// ═══════════════════════════════════════════════════════════════

const BIO_TEMPLATES = [
    () => `⚡ ${config.BOT_NAME} | Online 24/7 🌍`,
    () => `⏰ ${new Date().toLocaleTimeString('en-KE',{ timeZone: config.TIME_ZONE })} | 🤖 ${config.BOT_NAME}`,
    () => `🌐 Powered by GuruTech | ${new Date().toLocaleDateString('en-KE')}`,
    () => `🔥 ${config.BOT_NAME} is live! | +${config.OWNER_NUMBER}`,
    () => `⚡ Serving users 24/7`,
    () => `⚡ ${config.BOT_NAME} | Koyoteh 🚀`,
];

async function PantherAutoBio(sock) {
    try {
        const bio = pickRandom(BIO_TEMPLATES)();
        await sock.updateProfileStatus(bio);
        logger.debug('AUTOBIO', `Bio updated: ${bio}`);
    } catch (err) {
        logger.debug('AUTOBIO', `Bio update skipped: ${err.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════
//  📊  AUTO STATUS (view + like)
// ═══════════════════════════════════════════════════════════════

async function PantherStatusHandler(sock, messages) {
    for (const msg of messages) {
        if (msg.key.remoteJid !== 'status@broadcast') continue;
        try {
            if (config.AUTO_READ_STATUS) {
                await sock.readMessages([msg.key]).catch(() => {});
                logger.debug('STATUS', `Read status from ${msg.key.participant || msg.pushName}`);
            }
            if (config.AUTO_LIKE_STATUS) {
                const emojis = ['❤️','🔥','💛','💚','💙','🥰','😍','👏','🌟'];
                await sock.sendMessage(msg.key.remoteJid, {
                    react: { text: pickRandom(emojis), key: msg.key },
                }).catch(() => {});
            }
        } catch {}
    }
}

// ═══════════════════════════════════════════════════════════════
//  🤖  CHATBOT
// ═══════════════════════════════════════════════════════════════

const chatHistory = new Map();

async function PantherChatBot(sock, msg, settings) {
    try {
        const from   = msg?.from;
        const sender = msg?.sender;
        const body   = msg?.body;
        if (!body || body.startsWith(config.BOT_PREFIX)) return;
        if (getSetting('CHATBOT') !== 'true') return;
        const botNum = sock.user?.id?.split('@')[0].split(':')[0];
        if (msg.isGroup &&
            !body.includes(botNum) &&
            !body.toLowerCase().includes(config.BOT_NAME.toLowerCase())) return;

        await PantherPresence(sock, from, 'composing');

        const systemPrompt =
            `You are ${config.BOT_NAME}, a helpful WhatsApp assistant by Koyoteh (+${config.OWNER_NUMBER}). ` +
            `Be friendly, concise and use relevant emojis. Never say you are ChatGPT or any other AI.`;

        const response = await axios.get(
            `https://text.pollinations.ai/${encodeURIComponent(body)}?system=${encodeURIComponent(systemPrompt)}`,
            { timeout: 20000 }
        ).then(r => r.data).catch(() => null);

        if (!response) return;
        const reply = typeof response === 'string' ? response.trim() : JSON.stringify(response);

        const hist = chatHistory.get(sender) || [];
        hist.push({ role: 'user', content: body });
        hist.push({ role: 'assistant', content: reply });
        if (hist.length > 20) hist.splice(0, 2);
        chatHistory.set(sender, hist);

        await sendWithChannel(sock, from, { text: `🤖 ${reply}` }, { quoted: msg.m });
    } catch (err) {
        logger.error('CHATBOT', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  🤖  ANTI BOT — kick non-admins who send bot commands
// ═══════════════════════════════════════════════════════════════

// Returns true if enforcement was triggered (violator kicked), false otherwise.
// Callers should return early when this returns true so the command does not execute.
async function PantherAntiBot(sock, msg) {
    try {
        const { from, sender, isGroup, isAdmin, isOwner, fromMe, isCmd } = msg;
        // Only run in groups, only on command messages, never on bot's own messages
        if (!isGroup || !isCmd || isAdmin || isOwner || fromMe) return false;

        const settings = getGroupSettings(from);
        // SQLite stores integers — truthy check covers 1 / true / 'on'
        if (!settings?.antibot) return false;

        // Fetch fresh group metadata (needed for admin check + LID resolution)
        const groupMetadata = await sock.groupMetadata(from).catch(() => null);
        if (!groupMetadata) return false;

        const _pNum = (p) => {
            const phone = p.phoneNumber || p.phone_number || '';
            if (phone) return String(phone).split('@')[0].split(':')[0].replace(/\D/g, '');
            const base = p.id || p.jid || '';
            if (base && !base.endsWith('@lid')) return base.split('@')[0].split(':')[0].replace(/\D/g, '');
            return '';
        };

        const botId = sock.decodeJid ? sock.decodeJid(sock.user.id) : (sock.user?.id || '');
        const botNum = botId.split('@')[0].split(':')[0].replace(/\D/g, '');

        const isBotAdmin = groupMetadata.participants.some(
            p => _pNum(p) === botNum && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        if (!isBotAdmin) return false; // Can't act without admin rights — stay silent

        // Resolve the actual participant JID (handles @lid JIDs correctly)
        const senderNum = sender.split('@')[0].split(':')[0].replace(/\D/g, '');
        const resolvedParticipant = groupMetadata.participants.find(p => _pNum(p) === senderNum);
        const targetJid = resolvedParticipant
            ? (resolvedParticipant.id || resolvedParticipant.jid || sender)
            : sender;

        // Delete the offending command message first
        try {
            await sock.sendMessage(from, {
                delete: {
                    remoteJid: from,
                    fromMe: false,
                    id: msg.m?.key?.id || msg.key?.id,
                    participant: msg.m?.key?.participant || sender,
                },
            });
        } catch (_) {}

        const kickText = gmdBanner('🤖 ANTIBOT — Bot Command Detected', [
            `👤 User   : @${senderNum}`,
            `📋 Reason : Used a bot command (non-admin)`,
            `🔨 Action : KICKED`,
        ], config.BOT_NAME);

        await sock.groupParticipantsUpdate(from, [targetJid], 'remove').catch(() => {});
        await sendWithChannel(sock, from, { text: kickText, mentions: [targetJid] });

        return true; // Enforcement triggered — caller should skip command execution
    } catch (err) {
        logger.error('ANTI_BOT', err.message);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
//  👥  ANTI GROUP MENTION
// ═══════════════════════════════════════════════════════════════

async function PantherAntiGroupMention(sock, msg) {
    try {
        const { from, sender, isGroup, isAdmin, isOwner, fromMe } = msg;
        if (!isGroup || isAdmin || isOwner || fromMe) return;
        const settings = getGroupSettings(from);
        if (!settings?.antispam) return;
        const mentions = msg.m?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentions.length < 5) return;
        await sock.sendMessage(from, { delete: msg.m.key }).catch(() => {});
        const text = gmdBanner('🚫 Mass Mention Blocked', [
            `👤 User    : @${sender.split('@')[0]}`,
            `🔢 Mentions: ${mentions.length} users`,
            `📋 Reason  : Spam / Mass mention`,
        ], config.BOT_NAME);
        await sendWithChannel(sock, from, { text, mentions: [sender] });
    } catch (err) {
        logger.error('ANTI_MENTION', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  📋  COPY BUTTON HELPER
// ═══════════════════════════════════════════════════════════════

async function sendCopyButton(sock, jid, opts = {}, msgOpts = {}) {
    const {
        body     = '',
        footer   = config.BOT_NAME,
        copyText = '',
        btnLabel = '📋 Copy',
    } = opts;

    try {
        return await giftedSendButtons(sock, jid, {
            text:    body,
            footer,
            buttons: [
                {
                    name:             'cta_copy',
                    buttonParamsJson: JSON.stringify({
                        display_text: btnLabel,
                        copy_code:    copyText,
                    }),
                },
            ],
        }, msgOpts);
    } catch (err) {
        logger.error('SEND_COPY_BTN', `gifted-btns error: ${err.message} — falling back to plain text`);
        return sock.sendMessage(jid, {
            text:        [body, footer].filter(Boolean).join('\n\n'),
            contextInfo: channelCtx(),
        }, msgOpts).catch(() => {});
    }
}

// ─── sendButtons ─────────────────────────────────────────────────────────────
async function sendButtons(sock, jid, opts = {}, msgOpts = {}) {
    const {
        body    = '',
        text    = '',
        title   = '',
        footer  = config.BOT_NAME,
        image   = null,
        buttons = [],
    } = opts;

    const bodyText = text || body;

    const normalised = buttons.map((btn) => {
        if (btn.name !== undefined || btn.id !== undefined) return btn;
        if (btn.type === 'url') {
            return {
                name:             'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.label || '🔗 Open',
                    url:          btn.value || '',
                    merchant_url: btn.value || '',
                }),
            };
        }
        if (btn.type === 'call') {
            return {
                name:             'cta_call',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.label || '📞 Call',
                    phone_number: btn.value || '',
                }),
            };
        }
        if (btn.type === 'copy') {
            return {
                name:             'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.label || '📋 Copy',
                    copy_code:    btn.value || '',
                }),
            };
        }
        return btn;
    });

    let giftedResult = null;
    try {
        giftedResult = await Promise.race([
            giftedSendButtons(sock, jid, {
                title,
                text:    bodyText,
                footer,
                image,
                buttons: normalised,
            }, msgOpts),
            new Promise(resolve => setTimeout(() => resolve(null), 5000)),
        ]);
    } catch (err) {
        logger.warn('SEND_BUTTONS', `gifted-btns threw: ${err.message} — using fallback`);
    }

    if (giftedResult?.key?.id) return giftedResult;

    logger.warn('SEND_BUTTONS', 'gifted-btns did not confirm delivery — sending plain fallback');
    const lines = [title && `*${title}*`, bodyText, footer].filter(Boolean);
    const plainText = lines.join('\n\n');

    if (image) {
        return sock.sendMessage(jid, {
            image,
            caption:     plainText,
            contextInfo: channelCtx(),
        }, msgOpts).catch(() =>
            sock.sendMessage(jid, {
                text:        plainText,
                contextInfo: channelCtx(),
            }, msgOpts).catch(() => {})
        );
    }

    return sock.sendMessage(jid, {
        text:        plainText,
        contextInfo: channelCtx(),
    }, msgOpts).catch(() => {});
}

module.exports = {
    channelCtx,
    sendWithChannel,
    REACT_EMOJIS,
    LINK_REGEX,
    PantherAutoReact,
    PantherAntiLink,
    PantherAntiBad,
    PantherAntiCall,
    storeMessage,
    getStoredMessage,
    PantherAntiDelete,
    PantherAntiEdit,
    PantherPresence,
    PantherAutoBio,
    PantherStatusHandler,
    PantherChatBot,
    PantherAntiGroupMention,
    PantherAntiBot,
    sendCopyButton,
    sendButtons,
};
