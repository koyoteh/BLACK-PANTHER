'use strict';
// Shared state for the interactive menu reply flow.
// CJS so both ESM (menu.js via createRequire) and CJS (menuReply.js) can use the same instance.

const MENU_STATE = new Map(); // chatJid → { messageId, timestamp }
const TTL_MS = 5 * 60 * 1000; // 5-minute window

function setMenuState(chatJid, messageId) {
    MENU_STATE.set(chatJid, { messageId, timestamp: Date.now() });
    // Auto-clean after TTL so the map never grows unbounded
    setTimeout(() => {
        const entry = MENU_STATE.get(chatJid);
        if (entry && entry.messageId === messageId) MENU_STATE.delete(chatJid);
    }, TTL_MS);
}

function getMenuState(chatJid) {
    const entry = MENU_STATE.get(chatJid);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > TTL_MS) {
        MENU_STATE.delete(chatJid);
        return null;
    }
    return entry;
}

function clearMenuState(chatJid) {
    MENU_STATE.delete(chatJid);
}

module.exports = { setMenuState, getMenuState, clearMenuState };
