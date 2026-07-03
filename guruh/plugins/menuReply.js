'use strict';
// ─────────────────────────────────────────────────────────────────
//  MENU REPLY TRIGGER
//  Fires when a user sends a digit (1-10) within 90s of .menu
//  Builds the category listing inline from getAllCmds().
//  Sends multiple messages if a category has many commands.
// ─────────────────────────────────────────────────────────────────
const { addTrigger, getAllCmds } = require('../../guru/handlers/loader');
const { getMenuState, clearMenuState } = require('../lib/menuState.cjs');

const CATEGORIES = {
    1:  { label: 'General',   emoji: '📜', category: 'general'   },
    2:  { label: 'Settings',  emoji: '🛠️',  category: 'settings'  },
    3:  { label: 'Owner',     emoji: '👑', category: 'owner'     },
    4:  { label: 'Group',     emoji: '👥', category: 'groups'    },
    5:  { label: 'AI',        emoji: '🧠', category: 'ai'        },
    6:  { label: 'Downloads', emoji: '🎬', category: 'downloads' },
    7:  { label: 'Editing',   emoji: '✂️',  category: 'editing'   },
    8:  { label: 'Effects',   emoji: '🎨', category: 'effects'   },
    9:  { label: 'Utils',     emoji: '🔧', category: 'utils'     },
    10: { label: 'Privacy',   emoji: '🔒', category: 'privacy'   },
};

// Max chars per WhatsApp message (stay well under 65 536 hard limit)
const CHUNK_SIZE = 3500;

/**
 * Build an array of text chunks for a category.
 * Each chunk is a self-contained message that fits within CHUNK_SIZE chars.
 */
function buildChunks(num, prefix) {
    const { label, emoji, category } = CATEGORIES[num];

    // Deduplicate: getAllCmds() already returns one entry per unique name,
    // but filter to this category only.
    const cmds = getAllCmds().filter(c => c.category === category);

    const header = `⚡ ──「 ${emoji} ${label} Menu 」──\n▢ Total: ${cmds.length} commands\n`;
    const footer = `└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`;

    if (!cmds.length) {
        return [`${header}▢ No commands found in this category yet.\n${footer}`];
    }

    // Build one line per command
    const lines = cmds.map((c, i) => {
        const aliasStr = c.aliases && c.aliases.length
            ? ` _(${c.aliases.map(a => prefix + a).join(', ')})_`
            : '';
        const descStr = c.desc ? `\n   └ ${c.desc}` : '';
        return `▢ *${prefix}${c.name}*${aliasStr}${descStr}`;
    });

    // Split lines into chunks that each fit within CHUNK_SIZE chars
    const chunks = [];
    let current = header;
    let isFirst = true;

    for (const line of lines) {
        const candidate = current + line + '\n';
        if (!isFirst && candidate.length + footer.length > CHUNK_SIZE) {
            // Close current chunk and start a new one
            chunks.push(current + footer);
            current = `⚡ ──「 ${emoji} ${label} (cont.) 」──\n`;
        }
        current += line + '\n';
        isFirst = false;
    }

    // Push the last chunk
    chunks.push(current + footer);

    return chunks;
}

addTrigger({
    pattern: /^(10|[1-9])$/,
    handler: async (ctx) => {
        try {
            const { m, from, sock, config: cfg } = ctx;
            const body = (m.body || '').trim();
            const num  = parseInt(body, 10);
            if (!num || num < 1 || num > 10) return;

            const state = getMenuState(from);
            if (!state) return;

            const quotedId      = m.quotedKey?.id;
            const isQuotingMenu = quotedId && state.messageId && quotedId === state.messageId;
            const isWithinWindow = (Date.now() - state.timestamp) < 90_000;

            if (!isQuotingMenu && !isWithinWindow) return;

            clearMenuState(from);

            const prefix = cfg?.BOT_PREFIX || '.';
            const chunks = buildChunks(num, prefix);

            // Send each chunk sequentially so they arrive in order
            for (const text of chunks) {
                await sock.sendMessage(from, { text });
            }
        } catch (e) {
            // Never crash the message handler
        }
    },
});
