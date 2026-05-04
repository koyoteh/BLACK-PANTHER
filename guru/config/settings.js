'use strict';
require('dotenv').config();

// ── Helper: env bool with explicit default ─────────────────────
const bool = (key, def = true) => {
    const v = process.env[key];
    if (v === undefined || v === '') return def;   // use default when not set
    return v.toLowerCase() === 'true';
};

const config = {
    // ── Bot Identity ──────────────────────────────────
    BOT_NAME:       process.env.BOT_NAME     || 'BLACK PANTHER MD',
    OWNER_NAME:     process.env.OWNER_NAME   || 'GuruTech',
    OWNER_NUMBER:   process.env.OWNER_NUMBER || '254105521300',
    BOT_PREFIX:     process.env.BOT_PREFIX   || '.',
    BOT_VERSION:    '1.0.0',
    PACK_NAME:      process.env.BOT_NAME     || 'BLACK PANTHER MD',
    PACK_AUTHOR:    process.env.OWNER_NAME   || 'GuruTech',

    // ── Channel (GuruTech WhatsApp Channel) ───────────
    // https://whatsapp.com/channel/0029VbCl2UX3rZZilMSvxN1e
    CHANNEL_URL:        process.env.CHANNEL_URL  || 'https://whatsapp.com/channel/0029VbCl2UX3rZZilMSvxN1e',
    CHANNEL_NAME:       process.env.CHANNEL_NAME || 'BLACK PANTHER MD Channel',
    // Newsletter JID for the green "Forwarded from <channel>" chip on every reply.
    // Format: <id>@newsletter   (e.g. 120363401548261516@newsletter)
    CHANNEL_JID:        process.env.CHANNEL_JID  || '120363427012090993@newsletter',
    CHANNEL_NEWSLETTER_NAME: process.env.CHANNEL_NEWSLETTER_NAME || '🐾『 BLACK PANTHER MD 』🐾',

    // ── Connection ────────────────────────────────────
    SESSION_ID:     process.env.SESSION_ID   || '',

    // ── Mode & Behaviour ──────────────────────────────
    MODE:       process.env.MODE      || 'public',
    TIME_ZONE:  process.env.TIME_ZONE || 'Africa/Nairobi',

    // ── Auto Features (all ON by default) ────────────
    AUTO_READ_STATUS:  bool('AUTO_READ_STATUS',  true),
    AUTO_LIKE_STATUS:  bool('AUTO_LIKE_STATUS',  true),
    AUTO_REACT:        bool('AUTO_REACT',        false),
    AUTO_BIO:          bool('AUTO_BIO',          true),   // ← ON by default
    AUTO_TYPING:       bool('AUTO_TYPING',       false),
    AUTO_RECORDING:    bool('AUTO_RECORDING',    false),
    GHOST_MODE:        bool('GHOST_MODE',        false),
    FREEZE_LAST_SEEN:  bool('FREEZE_LAST_SEEN',  false),
    STATUS_REPLY:      bool('STATUS_REPLY',      false),
    AUTO_STICKER:      bool('AUTO_STICKER',      false),

    // ── Status Manager (statusManager.js) ────────────
    // Mirror of AUTO_READ_STATUS / AUTO_LIKE_STATUS but
    // used by statusManager for its LID-fix react path.
    AUTO_STATUS_SEEN:   process.env.AUTO_STATUS_SEEN  || String(bool('AUTO_READ_STATUS', true)),
    AUTO_STATUS_REACT:  process.env.AUTO_STATUS_REACT || String(bool('AUTO_LIKE_STATUS', true)),
    AUTO_STATUS_MSG:    process.env.AUTO_STATUS_MSG   || '',

    // Status Saver — set Status_Saver=true to enable
    Status_Saver:               process.env.Status_Saver               || 'false',
    Status_Saver_Owner_Notify:  process.env.Status_Saver_Owner_Notify  || 'false',
    STATUS_REPLY:               process.env.STATUS_REPLY               || 'false',
    STATUS_MSG:                 process.env.STATUS_MSG                 || '',

    // Custom react emojis (comma-separated)
    CUSTOM_REACT_EMOJIS: process.env.CUSTOM_REACT_EMOJIS || '🪾,🌴,🪻,🌿,🌲,🌵,🍂,☄️,🪽,🪶,🚀,🍖',

    // ── Database ──────────────────────────────────────
    DATABASE_URL:   process.env.DATABASE_URL || null,

    // ── Server ────────────────────────────────────────
    PORT:   parseInt(process.env.PORT) || 5000,

    // ── Licence Expiry ────────────────────────────────
    // Set EXPIRY_DATE in your Heroku config vars as: YYYY-MM-DD
    // Leave empty or unset for no expiry.
    EXPIRY_DATE: process.env.EXPIRY_DATE || '',
};

module.exports = config;
