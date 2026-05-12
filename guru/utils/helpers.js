'use strict';
const moment = require('moment-timezone');
const config = require('../config/settings');

// ── Time ───────────────────────────────────────────────────────
function getTime(format = 'HH:mm:ss') {
    return moment().tz(config.TIME_ZONE).format(format);
}
function getDate(format = 'DD/MM/YYYY') {
    return moment().tz(config.TIME_ZONE).format(format);
}
function runtime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h ${m % 60}m ${s % 60}s`;
}

// ── String helpers ─────────────────────────────────────────────
function capitalise(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}
function formatNumber(n) {
    return Number(n).toLocaleString();
}
function bytesToSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (!bytes) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${Math.round(bytes / Math.pow(1024, i), 2)} ${sizes[i]}`;
}
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
function isUrl(str) {
    try { return Boolean(new URL(str)); } catch { return false; }
}
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── JID helpers ────────────────────────────────────────────────
function cleanJid(jid = '') {
    return jid.replace(/:[0-9]+/, '').trim();
}
function jidToNumber(jid = '') {
    return jid.split('@')[0].split(':')[0];
}
function numberToJid(number = '') {
    const clean = number.replace(/\D/g, '');
    return clean.includes('@') ? clean : `${clean}@s.whatsapp.net`;
}

// ── Message body extractor ─────────────────────────────────────
// Handles plain text, captions, interactive button responses,
// list responses, and template replies.
// Also unwraps ephemeral / view-once / document-with-caption wrappers
// which are common in group chats.
function getBody(msg) {
    const m = msg.message;
    if (!m) return '';

    // Unwrap common group message wrappers
    const inner =
        m.ephemeralMessage?.message ||
        m.documentWithCaptionMessage?.message ||
        m.viewOnceMessage?.message ||
        m.viewOnceMessageV2?.message ||
        m.viewOnceMessageV2Extension?.message ||
        m;

    // Interactive native-flow response (newer WhatsApp button type)
    if (inner.interactiveResponseMessage) {
        try {
            const paramsJson = inner.interactiveResponseMessage
                .nativeFlowResponseMessage?.paramsJson;
            if (paramsJson) {
                const id = JSON.parse(paramsJson)?.id;
                if (id) return id;
            }
        } catch {}
        return (
            inner.interactiveResponseMessage.buttonId ||
            inner.interactiveResponseMessage?.body?.text ||
            ''
        );
    }

    return (
        inner.conversation ||
        inner.extendedTextMessage?.text ||
        inner.imageMessage?.caption ||
        inner.videoMessage?.caption ||
        inner.documentMessage?.caption ||
        inner.documentWithCaptionMessage?.message?.documentMessage?.caption ||
        inner.buttonsResponseMessage?.selectedButtonId ||
        inner.listResponseMessage?.singleSelectReply?.selectedRowId ||
        inner.templateButtonReplyMessage?.selectedId ||
        ''
    );
}

// ── Mention builder ────────────────────────────────────────────
function mentionText(jids = []) {
    return jids.map(j => `@${jidToNumber(j)}`).join(' ');
}

// ── Emojis list ───────────────────────────────────────────────
const EMOJIS = ['❤️','💛','💚','💙','💜','🧡','🤎','🖤','🤍','💯','🔥','⭐','🌟','✨','🎉','🎊','🎶','🎵','🎸','🎹'];

module.exports = {
    getTime, getDate, runtime,
    capitalise, formatNumber, bytesToSize,
    sleep, isUrl, pickRandom,
    cleanJid, jidToNumber, numberToJid,
    getBody, mentionText,
    EMOJIS,
};
