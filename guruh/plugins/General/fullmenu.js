import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const PLUGINS_ROOT = path.join(__dirname, '..');

const CATEGORIES = [
    { name: 'General',   label: 'GENERAL',   emoji: '💬' },
    { name: 'Settings',  label: 'SETTINGS',  emoji: '🛠️' },
    { name: 'Owner',     label: 'OWNER',     emoji: '👑' },
    { name: 'Heroku',    label: 'HEROKU',    emoji: '☁️' },
    { name: 'Privacy',   label: 'PRIVACY',   emoji: '🔒' },
    { name: 'Groups',    label: 'GROUP',     emoji: '👥' },
    { name: 'AI',        label: 'AI',        emoji: '🧠' },
    { name: 'Downloads', label: 'DOWNLOADS', emoji: '⬇️' },
    { name: 'Editing',   label: 'EDITING',   emoji: '✂️' },
    { name: 'Effects',   label: 'EFFECTS',   emoji: '🎨' },
    { name: 'Anime',     label: 'ANIME',     emoji: '🎌' },
    { name: 'NSFW',      label: '+18 / NSFW',emoji: '🔞' },
    { name: 'Utils',     label: 'UTILS',     emoji: '🔧' },
    { name: 'Reactions', label: 'REACTIONS', emoji: '🎭' },
    { name: 'Search',    label: 'SEARCH',    emoji: '🔎' },
    { name: 'Coding',    label: 'CODING',    emoji: '💻' },
];

const CHUNK_SIZE = 3500;

export default {
    name: 'fullmenu',
    aliases: ['allmenu', 'commandslist', 'allcommands', 'fullcmds', 'fcmds', 'fm'],
    description: 'Displays the full bot command menu by category',
    run: async (context) => {
        const { client, m, prefix, totalCommands, botname, mode } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        const p      = prefix || '.';
        const sender = m.sender?.split('@')[0]?.split(':')[0] || 'User';

        // ── Header block ────────────────────────────────────────────────────────
        const headerMsg =
`⚡ ──「 *${botname || 'BLACK PANTHER'} ┃ ᴹᴰ* 」──
▢ 👤 𝐔𝐬𝐞𝐫    : @${sender}
▢ 🤖 𝐁𝐨𝐭     : ${botname || 'BLACK PANTHER MD'}
▢ 📌 𝐏𝐫𝐞𝐟𝐢𝐱  : ${p}
▢ 🌐 𝐌𝐨𝐝𝐞    : ${mode || 'public'}
▢ 📚 𝐂𝐦𝐝𝐬    : ${totalCommands || '?'}
└──✦ _Powered by GuruTech_ ✦──`;

        await client.sendMessage(m.chat, {
            text: headerMsg,
            mentions: [m.sender],
        });

        // ── Per-category blocks ──────────────────────────────────────────────────
        for (const cat of CATEGORIES) {
            let commandFiles = [];
            try {
                commandFiles = fs.readdirSync(path.join(PLUGINS_ROOT, cat.name))
                    .filter(f => f.endsWith('.js') && f !== 'links.js');
            } catch { continue; }

            if (!commandFiles.length) continue;

            const header = `⚡ ──「 ${cat.emoji} *${cat.label}* 」──\n▢ ${commandFiles.length} commands available\n\n`;
            const footer = `\n└──✦ _Powered by GuruTech_ ✦──`;

            const lines = commandFiles.map((file, i) =>
                `▢ ${String(i + 1).padStart(2, ' ')}. *${p}${file.replace('.js', '')}*`
            );

            // Chunk if needed
            const chunks = [];
            let current  = header;
            let isFirst  = true;
            for (const line of lines) {
                const candidate = current + line + '\n';
                if (!isFirst && candidate.length + footer.length > CHUNK_SIZE) {
                    chunks.push(current + footer);
                    current = `⚡ ──「 ${cat.emoji} *${cat.label}* (cont.) 」──\n\n`;
                }
                current += line + '\n';
                isFirst = false;
            }
            chunks.push(current + footer);

            for (const chunk of chunks) {
                await client.sendMessage(m.chat, { text: chunk });
            }
        }

        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
    }
};
