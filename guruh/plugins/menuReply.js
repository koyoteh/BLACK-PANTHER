'use strict';
// ─────────────────────────────────────────────────────────────────
//  MENU REPLY TRIGGER
//  Fires when a user sends a digit within 5min of .menu
//  Uses dynamic categories from getSortedCategories() so it always
//  matches whatever the main menu displays — no hardcoded lists.
// ─────────────────────────────────────────────────────────────────
const { addTrigger }                    = require('../../guru/handlers/loader');
const { getMenuState, clearMenuState }  = require('../lib/menuState.cjs');
const { getSortedCategories, CAT_ICONS } = require('../design');

// Max chars per WhatsApp message (stay well under 65 536 hard limit)
const CHUNK_SIZE = 3500;

/**
 * Build an array of text chunks for a category selected by 1-based number.
 * Returns null if the number is out of range.
 */
function buildChunks(num, prefix) {
    const sorted = getSortedCategories();
    const entry  = sorted[num - 1];
    if (!entry) return null;

    const { cat, cmds } = entry;
    const emoji  = CAT_ICONS[cat] || '🔥';
    const label  = (cat[0].toUpperCase() + cat.slice(1)).toUpperCase();
    const total  = cmds.length;

    const header = `⚡ ──「 ${emoji} *${label}* 」──\n▢ ${total} command${total !== 1 ? 's' : ''} available\n\n`;
    const footer = `\n└──✦ _Powered by GuruTech_ ✦──`;

    if (!total) {
        return [`${header}▢ No commands found in this category yet.\n${footer}`];
    }

    // Build lines for each command
    const lines = cmds.map((c, i) => {
        const idx   = String(i + 1).padStart(2, ' ');
        const desc  = (c.description || c.desc || '')
            .replace(/\. Usage:.*$/i, '')
            .replace(/Usage:.*$/i, '')
            .trim()
            .slice(0, 60);

        let line = `▢ ${idx}. *${prefix}${c.pattern}*${desc ? ` — _${desc}_` : ''}`;

        // Show aliases if present
        const aliases = c.aliases;
        if (Array.isArray(aliases) && aliases.length) {
            const aliasStr = aliases.map(a => `${prefix}${a}`).join(', ');
            line += `\n    ↳ _${aliasStr}_`;
        }

        return line;
    });

    // Split lines into chunks that each fit within CHUNK_SIZE chars
    const chunks = [];
    let current  = header;
    let isFirst  = true;

    for (const line of lines) {
        const candidate = current + line + '\n';
        if (!isFirst && candidate.length + footer.length > CHUNK_SIZE) {
            chunks.push(current + footer);
            current = `⚡ ──「 ${emoji} *${label}* (cont.) 」──\n\n`;
        }
        current += line + '\n';
        isFirst = false;
    }

    chunks.push(current + footer);
    return chunks;
}

addTrigger({
    // Match any number 1–99 (getSortedCategories() handles out-of-range)
    pattern: /^([1-9][0-9]?)$/,
    handler: async (ctx) => {
        try {
            const { m, from, sock, config: cfg } = ctx;
            const body = (m.body || '').trim();
            const num  = parseInt(body, 10);
            if (!num || num < 1) return;

            const state = getMenuState(from);
            if (!state) return;

            const quotedId       = m.quotedKey?.id;
            const isQuotingMenu  = quotedId && state.messageId && quotedId === state.messageId;
            const isWithinWindow = (Date.now() - state.timestamp) < 5 * 60 * 1000;

            if (!isQuotingMenu && !isWithinWindow) return;

            // Validate the number is in range
            const sorted = getSortedCategories();
            if (num > sorted.length) return;

            clearMenuState(from);

            const prefix = cfg?.BOT_PREFIX || '.';
            const chunks = buildChunks(num, prefix);
            if (!chunks) return;

            // Send each chunk sequentially so they arrive in order
            for (const text of chunks) {
                await sock.sendMessage(from, { text });
            }
        } catch (e) {
            // Never crash the message handler
        }
    },
});
