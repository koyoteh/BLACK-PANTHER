'use strict';
const config = require('../../config/settings');

const DEFAULT_EMOJIS = ['❤️','🔥','🥰','👏','🎉','💯','😍','🌟','✨','💪'];

async function handleAutoReact(sock, key) {
    if (config.AUTO_LIKE_STATUS !== 'true' && config.AUTO_LIKE_STATUS !== true) return;
    try {
        const raw    = config.CUSTOM_REACT_EMOJIS || '';
        const emojis = raw.split(',').map(e => e.trim()).filter(Boolean);
        const pool   = emojis.length ? emojis : DEFAULT_EMOJIS;
        const emoji  = pool[Math.floor(Math.random() * pool.length)];
        await sock.sendMessage(key.remoteJid, {
            react: { text: emoji, key },
        });
    } catch {}
}

module.exports = { handleAutoReact };
