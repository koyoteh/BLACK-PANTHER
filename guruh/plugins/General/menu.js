import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const require    = createRequire(import.meta.url);

const { setMenuState }                    = require('../../lib/menuState.cjs');
const { getSortedCategories, CAT_ICONS } = require('../../design');

export default {
    name: 'menu',
    aliases: ['commands', 'list', 'cmds', 'm', 'cmd', 'commandlist', 'allcmds'],
    description: 'Displays the BLACK-PANTHER-MD command menu',
    run: async (context) => {
        const { client, m, mode, botname, prefix, config: cfg } = context;

        await client.sendMessage(m.chat, { react: { text: '🤖', key: m.reactKey } });

        const expiryDate = cfg?.EXPIRY_DATE || '';
        let expiryLine;
        if (!expiryDate) {
            expiryLine = `▢ ⏳ 𝐄𝐱𝐩𝐢𝐫𝐲  : ∞ Never`;
        } else {
            const exp      = new Date(expiryDate);
            const now      = new Date();
            const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
            if (diffDays < 0)      expiryLine = `▢ ⏳ 𝐄𝐱𝐩𝐢𝐫𝐲  : *EXPIRED* ❌`;
            else if (diffDays === 0) expiryLine = `▢ ⏳ 𝐄𝐱𝐩𝐢𝐫𝐲  : *Today* ⚠️`;
            else expiryLine = `▢ ⏳ 𝐄𝐱𝐩𝐢𝐫𝐲  : ${expiryDate} _(${diffDays}d left)_`;
        }

        // ── Header ────────────────────────────────────────────────────────────
        const headerText =
`⚡ ──「 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ 」──
▢ 👤 𝐔𝐬𝐞𝐫    : @${m.sender.split('@')[0].split(':')[0]}
▢ 🤖 𝐁𝐨𝐭     : ${botname || 'BLACK-PANTHER-MD'}
▢ 📌 𝐏𝐫𝐞𝐟𝐢𝐱  : ${prefix}
▢ 🌐 𝐌𝐨𝐝𝐞    : ${mode}
${expiryLine}
└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`;

        // ── Dynamic category list (same order as getSortedCategories / menuReply) ─
        const sorted = getSortedCategories();
        let catLines = '';
        sorted.forEach(({ cat, cmds }, i) => {
            const emoji = CAT_ICONS[cat] || '🔥';
            const label = (cat[0].toUpperCase() + cat.slice(1)).toUpperCase();
            const num   = String(i + 1).padStart(2, ' ');
            catLines += `▢ ${num} 〢 ${emoji} ${label}  _(${cmds.length})_\n`;
        });

        const categoryText =
`⚡ ──「 Sᴇʟᴇᴄᴛ Cᴀᴛᴇɢᴏʀʏ 」──
${catLines.trimEnd()}
└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──

> *Reply with a number to view that category*`;

        const sentMsg = await client.sendMessage(m.chat, {
            text: headerText + '\n\n' + categoryText,
            mentions: [m.sender],
        }).catch(() => null);

        // Store the menu message so the trigger can identify replies to it
        const menuMsgId = sentMsg?.key?.id;
        setMenuState(m.chat, menuMsgId || null);

        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });

        // Play a random menu audio if available — optional, never fails the command
        try {
            const xhClintonPaths = [
                path.join(__dirname, 'Koyoteh'),
                path.join(process.cwd(), 'Koyoteh'),
                path.join(__dirname, '..', 'Koyoteh')
            ];
            let audioFolder = null;
            for (const folderPath of xhClintonPaths) {
                if (fs.existsSync(folderPath)) { audioFolder = folderPath; break; }
            }
            if (audioFolder) {
                const menuFiles    = ['menu1.mp3', 'menu2.mp3', 'menu3.mp3', 'menu4.mp3'];
                const possibleFiles = menuFiles.map(f => path.join(audioFolder, f)).filter(f => fs.existsSync(f));
                if (possibleFiles.length > 0) {
                    const randomFile = possibleFiles[Math.floor(Math.random() * possibleFiles.length)];
                    await new Promise(resolve => setTimeout(resolve, 500));
                    try {
                        const audioBuffer = fs.readFileSync(randomFile);
                        await client.sendMessage(m.chat, { audio: audioBuffer, ptt: true, mimetype: 'audio/mpeg', fileName: 'panther-menu.m4a' });
                    } catch {
                        await client.sendMessage(m.chat, { audio: { url: randomFile }, ptt: true, mimetype: 'audio/mpeg', fileName: 'panther-menu.m4a' }).catch(() => {});
                    }
                }
            }
        } catch { /* audio is optional — ignore all failures */ }
    }
};
