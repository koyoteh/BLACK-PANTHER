'use strict';
/**
 * guru/handlers/plugins/autoreactstatus.js
 * Thin bridge — delegates to the full AutoReactManager in the guruh plugin.
 * This is the version called by guru/handlers/statusManager.js.
 */

let _manager = null;

function getManager() {
    if (_manager) return _manager;
    try {
        const mod = require('../../../guruh/plugins/autoreactstatus');
        _manager = mod.autoReactManager;
    } catch (e) {
        console.warn('[autoreactstatus] Could not load AutoReactManager:', e.message);
        _manager = null;
    }
    return _manager;
}

async function handleAutoReact(sock, key) {
    const mgr = getManager();
    if (!mgr) {
        // Fallback: simple react if manager unavailable
        const config = require('../../config/settings');
        const enabled = config.AUTO_LIKE_STATUS === true || config.AUTO_LIKE_STATUS === 'true';
        if (!enabled) return;
        try {
            const DEFAULT_EMOJIS = ['❤️','🔥','🥰','👏','🎉','💯','😍','🌟','✨','💪'];
            const raw    = config.CUSTOM_REACT_EMOJIS || '';
            const emojis = raw.split(',').map(e => e.trim()).filter(Boolean);
            const pool   = emojis.length ? emojis : DEFAULT_EMOJIS;
            const emoji  = pool[Math.floor(Math.random() * pool.length)];
            // React must be sent to status@broadcast with the original key
            await sock.sendMessage('status@broadcast', { react: { text: emoji, key } });
        } catch {}
        return;
    }
    mgr.enqueue(sock, key);
}

module.exports = { handleAutoReact };
