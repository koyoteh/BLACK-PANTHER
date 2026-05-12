'use strict';
const { getContentType } = require('@whiskeysockets/baileys');
const { getBody, cleanJid } = require('./helpers');
const { getGroupMeta }      = require('./groupCache');
const config = require('../config/settings');

/**
 * Enriches a raw Baileys message with convenient derived fields.
 * Group metadata is pulled from an in-memory TTL cache so we avoid
 * a live WhatsApp round-trip on every message.
 */
async function serialize(msg, sock) {
    if (!msg || !msg.message) return msg;

    const m         = msg;
    const botId     = cleanJid(sock.user?.id || '');
    const rawFrom   = m.key.remoteJid || '';
    const isGroup   = rawFrom.endsWith('@g.us');
    const isStatus  = rawFrom === 'status@broadcast';
    const fromMe    = m.key.fromMe;

    // ── LID → phone-number JID remap ─────────────────────
    // WhatsApp now uses @lid JIDs for many 1-on-1 chats, but Baileys
    // can't establish a Signal session against a @lid alone (sends hang
    // with "No sessions"). Baileys exposes the phone-number alternative
    // as key.senderPn / key.participantPn — prefer those for routing.
    let from = rawFrom;
    if (!isGroup && !isStatus && rawFrom.endsWith('@lid')) {
        const pn = m.key.senderPn || m.key.participantPn;
        if (pn) from = cleanJid(pn);
    }

    // ── Sender ───────────────────────────────────────────
    const sender    = isGroup
        ? cleanJid(m.key.participantPn || m.key.participant || m.participant || '')
        : cleanJid(from);

    // ── Message type & body ──────────────────────────────
    const type      = getContentType(m.message);
    const body      = getBody(m);

    // ── Command parsing ───────────────────────────────────
    const prefix    = config.BOT_PREFIX;
    const isCmd     = body.startsWith(prefix);
    const command   = isCmd ? body.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase() : '';
    const args      = isCmd ? body.slice(prefix.length + command.length).trim().split(/\s+/).filter(Boolean) : [];
    const text      = args.join(' ');

    // ── Quoted message ────────────────────────────────────
    // Unwrap ephemeral/documentWithCaption before scanning for contextInfo
    const _inner =
        m.message?.ephemeralMessage?.message ||
        m.message?.documentWithCaptionMessage?.message ||
        m.message?.viewOnceMessage?.message ||
        m.message?.viewOnceMessageV2?.message ||
        m.message || {};

    // contextInfo lives inside whichever message type was sent
    const _ctx =
        _inner.extendedTextMessage?.contextInfo ||
        _inner.imageMessage?.contextInfo ||
        _inner.videoMessage?.contextInfo ||
        _inner.audioMessage?.contextInfo ||
        _inner.documentMessage?.contextInfo ||
        _inner.stickerMessage?.contextInfo ||
        _inner.buttonsResponseMessage?.contextInfo ||
        _inner.listResponseMessage?.contextInfo ||
        null;

    const quoted    = _ctx?.quotedMessage || null;
    const quotedKey = _ctx
        ? {
            id:          _ctx.stanzaId,
            remoteJid:   from,
            participant: _ctx.participant,
          }
        : null;

    // ── Group info (cached — no network call if fresh) ────
    let groupMeta = null, groupName = '', participants = [], admins = [], isBotAdmin = false, isAdmin = false;
    if (isGroup) {
        try {
            groupMeta    = await getGroupMeta(sock, from);
            groupName    = groupMeta.subject || '';
            participants = groupMeta.participants || [];
            admins       = participants.filter(p => p.admin).map(p => cleanJid(p.id));
            isBotAdmin   = admins.includes(botId);
            isAdmin      = admins.includes(sender);
        } catch {
            // Cache miss or network error — do a direct fetch as fallback
            try {
                groupMeta    = await sock.groupMetadata(from);
                groupName    = groupMeta.subject || '';
                participants = groupMeta.participants || [];
                admins       = participants.filter(p => p.admin).map(p => cleanJid(p.id));
                isBotAdmin   = admins.includes(botId);
                isAdmin      = admins.includes(sender);
            } catch {}
        }
    }

    // ── Push name ─────────────────────────────────────────
    const pushName  = m.pushName || 'User';

    // ── Ownership checks ──────────────────────────────────
    const ownerJid  = config.OWNER_NUMBER + '@s.whatsapp.net';
    const isOwner   = sender === cleanJid(ownerJid) || fromMe;

    Object.assign(m, {
        from, isGroup, isStatus, fromMe,
        sender, botId,
        type, body,
        isCmd, command, args, text, prefix,
        quoted, quotedKey,
        groupMeta, groupName, participants, admins, isBotAdmin, isAdmin,
        pushName,
        isOwner,
    });

    return m;
}

module.exports = { serialize };
