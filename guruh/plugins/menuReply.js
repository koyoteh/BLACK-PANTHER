'use strict';
// ─────────────────────────────────────────────────────────────────
//  MENU REPLY TRIGGER
//  Fires when a user sends a digit (1-10) and either:
//    • is quoting the bot's menu message, OR
//    • sent it within 90 seconds of the menu being displayed
//  Then dispatches to the matching category command.
// ─────────────────────────────────────────────────────────────────
const { addTrigger, findCmd } = require('../handlers/loader');
const { getMenuState, clearMenuState } = require('../lib/menuState.cjs');

const CATEGORIES = [
    null,            // 0  — unused
    'generalmenu',   // 1  — 📜 General
    'settingsmenu',  // 2  — 🛠️ Settings
    'ownermenu',     // 3  — 👑 Owner
    'groupmenu',     // 4  — 👥 Group
    'aimenu',        // 5  — 🧠 AI
    'downloadmenu',  // 6  — 🎬 Downloads
    'editingmenu',   // 7  — ✂️ Editing
    'effectsmenu',   // 8  — 🎨 Effects
    'utilsmenu',     // 9  — 🔧 Utils
    'privacymenu',   // 10 — 🔒 Privacy
];

addTrigger({
    pattern: /^(10|[1-9])$/,
    handler: async (ctx) => {
        try {
            const { m, from } = ctx;
            const body = (m.body || '').trim();
            const num = parseInt(body, 10);
            if (!num || num < 1 || num > 10) return;

            const state = getMenuState(from);
            if (!state) return;

            // Accept if: quoting the exact menu message, OR within 90-second convenience window
            const quotedId = m.quotedKey?.id;
            const isQuotingMenu = quotedId && state.messageId && quotedId === state.messageId;
            const isWithinWindow = (Date.now() - state.timestamp) < 90_000;

            if (!isQuotingMenu && !isWithinWindow) return;

            const cmdName = CATEGORIES[num];
            if (!cmdName) return;

            const cmd = findCmd(cmdName);
            if (!cmd) return;

            // Clear state so a second bare-number message doesn't re-trigger
            clearMenuState(from);

            await cmd.handler(ctx);
        } catch { /* never let the trigger crash */ }
    }
});
