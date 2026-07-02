'use strict';
/**
 * guru/handlers/plugins/autoviewstatus.js
 * Thin bridge — delegates to the full AutoViewManager in the guruh plugin.
 * This is the version called by guru/handlers/statusManager.js.
 */

let _manager = null;

function getManager() {
    if (_manager) return _manager;
    try {
        const mod = require('../../../guruh/plugins/autoviewstatus');
        _manager = mod.autoViewManager;
    } catch (e) {
        console.warn('[autoviewstatus] Could not load AutoViewManager:', e.message);
        _manager = null;
    }
    return _manager;
}

async function handleAutoView(sock, key, message) {
    const mgr = getManager();
    if (!mgr) {
        // Fallback: simple read if manager unavailable
        const config = require('../../config/settings');
        const enabled = config.AUTO_READ_STATUS === true || config.AUTO_READ_STATUS === 'true';
        if (!enabled) return;
        try { await sock.readMessages([key]); } catch {}
        return;
    }
    await mgr.viewStatus(sock, key, message);
}

module.exports = { handleAutoView };
