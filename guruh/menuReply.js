'use strict';
// ─────────────────────────────────────────────────────────────────
//  MENU REPLY — fires when a user sends a bare number within 5min
//  of .menu (or quotes the menu message), and shows that category's
//  command list. Uses getSortedCategories() so it always matches
//  whatever the main menu displays — no hardcoded lists.
// ─────────────────────────────────────────────────────────────────
const { gmd } = require("../guru");
const { getMenuState, clearMenuState } = require("./lib/menuState.cjs");
const { getSortedCategories } = require("./design");

// Max chars per WhatsApp message (stay well under 65 536 hard limit)
const CHUNK_SIZE = 3500;

/**
 * Build an array of text chunks for a category selected by 1-based number.
 * Returns null if the number is out of range.
 */
function buildChunks(num, prefix) {
    const sorted = getSortedCategories();
    const entry = sorted[num - 1];
    if (!entry) return null;

    const { cat, cmds } = entry;
    const label = (cat[0].toUpperCase() + cat.slice(1)).toUpperCase();
    const total = cmds.length;

    const header = `⚡ ──「 *${label}* 」──\n▢ ${total} command${total !== 1 ? "s" : ""} available\n\n`;
    const footer = `\n└──✦ _Powered by GuruTech_ ✦──`;

    if (!total) {
        return [`${header}▢ No commands found in this category yet.\n${footer}`];
    }

    const lines = cmds.map((c, i) => {
        const idx = String(i + 1).padStart(2, " ");
        const desc = (c.description || c.desc || "")
            .replace(/\. Usage:.*$/i, "")
            .replace(/Usage:.*$/i, "")
            .trim()
            .slice(0, 60);

        let line = `▢ ${idx}. *${prefix}${c.pattern}*${desc ? ` — _${desc}_` : ""}`;

        const aliases = c.aliases;
        if (Array.isArray(aliases) && aliases.length) {
            const aliasStr = aliases.map((a) => `${prefix}${a}`).join(", ");
            line += `\n    ↳ _${aliasStr}_`;
        }

        return line;
    });

    const chunks = [];
    let current = header;
    let isFirst = true;

    for (const line of lines) {
        const candidate = current + line + "\n";
        if (!isFirst && candidate.length + footer.length > CHUNK_SIZE) {
            chunks.push(current + footer);
            current = `⚡ ──「 *${label}* (cont.) 」──\n\n`;
        }
        current += line + "\n";
        isFirst = false;
    }

    chunks.push(current + footer);
    return chunks;
}

gmd(
    {
        pattern: /^([1-9][0-9]?)$/,
        on: "body",
        react: "📂",
        category: "general",
        dontAddCommandList: true,
        description: "Reply with a number after .menu to view that category",
    },
    async (from, Guru, conText) => {
        try {
            const { body, mek, quotedKey, config: cfg } = conText;
            const num = parseInt((body || "").trim(), 10);
            if (!num || num < 1) return;

            const state = getMenuState(from);
            if (!state) return;

            const quotedId = quotedKey?.id || mek?.quotedKey?.id;
            const isQuotingMenu = quotedId && state.messageId && quotedId === state.messageId;
            const isWithinWindow = Date.now() - state.timestamp < 5 * 60 * 1000;

            if (!isQuotingMenu && !isWithinWindow) return;

            const sorted = getSortedCategories();
            if (num > sorted.length) return;

            clearMenuState(from);

            const prefix = cfg?.BOT_PREFIX || ".";
            const chunks = buildChunks(num, prefix);
            if (!chunks) return;

            for (const text of chunks) {
                await Guru.sendMessage(from, { text });
            }
        } catch (e) {
            // Never crash the message handler
        }
    }
);
