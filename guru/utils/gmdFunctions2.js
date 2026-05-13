'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  gmdFunctions2.js  (Auto Features)
//  👑  Owner : GuruTech  |  📞 +254105521300
//  🛡️  AntiLink · AntiSpam · AntiCall · AutoBio · AutoReact
//  💬  ChatBot · Presence · AntiDelete · AntiEdit · AntiViewOnce
//  📢  Channel button helper attached to every response
// ╚══════════════════════════════════════════════════════════════╝

const axios   = require('axios');
const config  = require('../config/settings');
const logger  = require('./logger');
const { gmdBanner, gmdTable, pickRandom, sleep } = require('./gmdFunctions');
const { getGroupSettings, getSetting }            = require('../db/database');
const {
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    proto,
} = require('@whiskeysockets/baileys');

// ═══════════════════════════════════════════════════════════════
//  📢  CHANNEL CONTEXT INFO
// ═══════════════════════════════════════════════════════════════

function channelCtx() {
    return {
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
                `📋 Reason : Shared a link`,
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

const BAD_WORDS = [
    'fuck','shit','bitch','asshole','bastard',
    'damn','cunt','dick','pussy','faggot',
];

async function PantherAntiBad(sock, msg, getGroupMetadataFn) {
    try {
        const { from, sender, body, isAdmin, isOwner, fromMe, isGroup } = msg;
        if (!isGroup || isAdmin || isOwner || fromMe) return;
        const settings = getGroupSettings(from);
        if (!settings?.antibadword) return;
        const lower = body.toLowerCase();
        if (!BAD_WORDS.some(w => lower.includes(w))) return;

        await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
        const text = gmdBanner('🤬 Bad Word Detected', [
            `👤 User    : @${sender.split('@')[0]}`,
            `🚫 Action  : Message Deleted`,
            `📝 Keep it clean please!`,
        ], config.BOT_NAME);
        await sendWithChannel(sock, from, { text, mentions: [sender] });
    } catch (err) {
        logger.error('ANTIBAD', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  📵  ANTI CALL
// ═══════════════════════════════════════════════════════════════

async function PantherAntiCall(calls, sock) {
    for (const call of calls) {
        if (call.status !== 'offer') continue;
        await sock.rejectCall(call.id, call.from).catch(() => {});
        const text = gmdBanner('📵 Call Rejected', [
            `📞 From    : +${call.from.split('@')[0]}`,
            `🤖 Reason  : Bot does not accept calls`,
            `💬 DM the owner instead`,
        ], config.BOT_NAME);
        await sendWithChannel(sock, call.from, { text }).catch(() => {});
        logger.info('ANTICALL', `Rejected call from ${call.from}`);
    }
}

// ═══════════════════════════════════════════════════════════════
//  🗑️  ANTI DELETE
// ═══════════════════════════════════════════════════════════════

const msgStore = new Map();

function storeMessage(msg) {
    if (!msg?.key?.id || !msg?.message) return;
    msgStore.set(msg.key.id, {
        msg,
        from:      msg.key.remoteJid,
        sender:    msg.key.participant || msg.key.remoteJid,
        timestamp: Date.now(),
    });
    setTimeout(() => msgStore.delete(msg.key.id), 10 * 60 * 1000);
}

function getStoredMessage(msgId) {
    if (!msgId) return undefined;
    return msgStore.get(msgId)?.msg?.message || undefined;
}

// key = individual MessageKey: { remoteJid, id, fromMe, participant? }
async function PantherAntiDelete(sock, key) {
    try {
        const from = key?.remoteJid;
        if (!from) return;

        // Only act in groups that have antidelete ON
        // For DMs we skip (getGroupSettings falls back gracefully)
        const settings = getGroupSettings(from);
        if (!settings?.antidelete) return;

        const stored = msgStore.get(key?.id);
        if (!stored?.msg?.message) return;

        // Skip bot's own messages
        if (key?.fromMe) return;

        const { getContentType } = require('@whiskeysockets/baileys');
        const type   = getContentType(stored.msg.message);
        const sender = stored.sender?.split('@')[0] || 'Unknown';

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
        if (!settings?.antidelete) return;

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
//  👁️  ANTI VIEW-ONCE
// ═══════════════════════════════════════════════════════════════

async function PantherAntiViewOnce(sock, msg) {
    try {
        const from    = msg?.key?.remoteJid;
        const message = msg?.message?.viewOnceMessage?.message ||
                        msg?.message?.viewOnceMessageV2?.message;
        if (!message || !from) return;
        const { getContentType, downloadMediaMessage } = require('@whiskeysockets/baileys');
        const type = getContentType(message);
        const buf  = await downloadMediaMessage({ key: msg.key, message }, 'buffer', {}).catch(() => null);
        if (!buf) return;
        if (type === 'imageMessage') {
            await sock.sendMessage(from, {
                image:   buf,
                caption: `👁️ *View-Once Image Revealed*\n_${config.BOT_NAME}_`,
            });
        } else if (type === 'videoMessage') {
            await sock.sendMessage(from, {
                video:    buf,
                caption:  `👁️ *View-Once Video Revealed*\n_${config.BOT_NAME}_`,
                mimetype: 'video/mp4',
            });
        }
    } catch (err) {
        logger.error('ANTIVIEWONCE', err.message);
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
    () => `🐾 ${config.BOT_NAME} | Online 24/7 🌍`,
    () => `⏰ ${new Date().toLocaleTimeString('en-KE',{ timeZone: config.TIME_ZONE })} | 🤖 ${config.BOT_NAME}`,
    () => `🌟 Powered by GuruTech | ${new Date().toLocaleDateString('en-KE')}`,
    () => `🔥 ${config.BOT_NAME} is live! | +${config.OWNER_NUMBER}`,
    () => `💚 Serving users 24/7 | ${config.BOT_NAME} 🐾`,
    () => `🐾 BLACK PANTHER MD | GuruTech 🚀`,
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
            `You are ${config.BOT_NAME}, a helpful WhatsApp assistant by GuruTech (+${config.OWNER_NUMBER}). ` +
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

// ─── internal relay helper ───────────────────────────────────────────────────
// sock.sendMessage does NOT process interactiveMessage through its content
// pipeline, so we must build the WA message ourselves and relay it.
async function _relayInteractive(sock, jid, interactiveMessage, msgOpts = {}) {
    const msg = generateWAMessageFromContent(
        jid,
        proto.Message.fromObject({ interactiveMessage }),
        {
            userJid:   sock.user?.id,
            quoted:    msgOpts.quoted,
            timestamp: new Date(),
        }
    );
    return sock.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
}

async function sendCopyButton(sock, jid, opts = {}, msgOpts = {}) {
    const {
        body     = '',
        footer   = config.BOT_NAME,
        copyText = '',
        btnLabel = '📋 Copy',
    } = opts;

    return _relayInteractive(sock, jid, {
        header: { hasMediaAttachment: false },
        body:   { text: body },
        footer: { text: footer },
        nativeFlowMessage: {
            buttons: [
                {
                    name:             'copy_code',
                    buttonParamsJson: JSON.stringify({
                        display_text: btnLabel,
                        code:         copyText,
                    }),
                },
            ],
        },
    }, msgOpts);
}

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

    // ── build native-flow buttons ─────────────────────────────────────────────
    // Supports: pre-built { name, buttonParamsJson }, ULTRA-GURU { id, text },
    // and simple { type, label, value }
    const builtButtons = buttons.map((btn) => {
        if (btn.name && btn.buttonParamsJson !== undefined) return btn;

        if (!btn.name && !btn.type && (btn.id !== undefined || btn.text !== undefined)) {
            return {
                name:             'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text  || btn.label || '',
                    id:           btn.id    || btn.text  || '',
                }),
            };
        }
        if (btn.type === 'copy') {
            return {
                name:             'copy_code',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.label || '📋 Copy',
                    code:         btn.value || '',
                }),
            };
        }
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
        return {
            name:             'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: btn.label || btn.value || '',
                id:           btn.value || btn.label || '',
            }),
        };
    });

    // ── build header ──────────────────────────────────────────────────────────
    // For an image header the media must be properly uploaded so WhatsApp can
    // render it — prepareWAMessageMedia handles the upload via waUploadToServer.
    let header;
    if (image?.url) {
        try {
            const { imageMessage } = await prepareWAMessageMedia(
                { image: { url: image.url } },
                { upload: sock.waUploadToServer }
            );
            header = { hasMediaAttachment: true, imageMessage };
        } catch (err) {
            logger.warn({ err }, 'sendButtons: image upload failed, falling back to title header');
            header = title ? { hasMediaAttachment: false, title } : { hasMediaAttachment: false };
        }
    } else if (title) {
        header = { hasMediaAttachment: false, title };
    } else {
        header = { hasMediaAttachment: false };
    }

    return _relayInteractive(sock, jid, {
        header,
        body:   { text: bodyText },
        footer: { text: footer },
        nativeFlowMessage: { buttons: builtButtons },
    }, msgOpts);
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
    PantherAntiViewOnce,
    PantherPresence,
    PantherAutoBio,
    PantherStatusHandler,
    PantherChatBot,
    PantherAntiGroupMention,
    sendCopyButton,
    sendButtons,
};
