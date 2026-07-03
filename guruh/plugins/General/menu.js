import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const { setMenuState } = require('../../lib/menuState.cjs');
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
    name: 'menu',
    aliases: ['commands', 'list', 'cmds', 'm', 'cmd', 'commandlist', 'allcmds'],
    description: 'Displays the BLACK-PANTHER-MD command menu',
    run: async (context) => {
        const { client, m, mode, pict, botname, prefix, config: cfg } = context;

        await client.sendMessage(m.chat, { react: { text: '🤖', key: m.reactKey } });

        const expiryDate = cfg?.EXPIRY_DATE || '';
        let expiryLine = '';
        if (expiryDate) {
            const exp = new Date(expiryDate);
            const now = new Date();
            const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
                expiryLine = `\n▢ ⏳ 𝐄𝐱𝐩𝐢𝐫𝐲   : *EXPIRED* ❌`;
            } else if (diffDays === 0) {
                expiryLine = `\n▢ ⏳ 𝐄𝐱𝐩𝐢𝐫𝐲   : *Today* ⚠️`;
            } else {
                expiryLine = `\n▢ ⏳ 𝐄𝐱𝐩𝐢𝐫𝐲   : ${expiryDate} (${diffDays}d left)`;
            }
        }

        const menuText =
`✦ ──『 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ᴹᴰ 』── ⚝
▢ 👤 𝐔𝐬𝐞𝐫    : @${m.sender.split('@')[0].split(':')[0]}
▢ 🤖 𝐁𝐨𝐭     : ${botname || 'BLACK-PANTHER-MD'}
▢ 📌 𝐏𝐫𝐞𝐟𝐢𝐱  : ${prefix}
▢ 🌐 𝐌𝐨𝐝𝐞    : ${mode}${expiryLine}
└──✪ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✪──

✦ ──『 Sᴇʟᴇᴄᴛ Cᴀᴛᴇɢᴏʀʏ 』── ⚝
▢ 1  〢 📜 General
▢ 2  〢 🛠️ Settings
▢ 3  〢 👑 Owner
▢ 4  〢 👥 Group
▢ 5  〢 🧠 AI
▢ 6  〢 🎬 Downloads
▢ 7  〢 ✂️ Editing
▢ 8  〢 🎨 Effects
▢ 9  〢 🔧 Utils
▢ 10 〢 🔒 Privacy
└──✪ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✪──

> *Reply with a number to view that category*`;

        let sentMsg;
        if (pict && Buffer.isBuffer(pict)) {
            sentMsg = await client.sendMessage(m.chat, {
                image: pict,
                caption: menuText,
                mentions: [m.sender],
                contextInfo: {
                    externalAdReply: {
                        title: `${botname || 'BLACK PANTHER MD'}`,
                        body: `Yo, ${m.pushName}! Pick a category.`,
                        mediaType: 1,
                        thumbnail: pict,
                        mediaUrl: '',
                        sourceUrl: 'https://github.com/koyoteh/BLACK-PANTHER',
                        showAdAttribution: false,
                        renderLargerThumbnail: true
                    }
                }
            }).catch(() => null);
        }

        if (!sentMsg) {
            sentMsg = await client.sendMessage(m.chat, {
                text: menuText,
                mentions: [m.sender],
                contextInfo: {
                    externalAdReply: {
                        title: `${botname || 'BLACK PANTHER MD'}`,
                        body: `Yo, ${m.pushName}! Pick a category.`,
                        mediaType: 1,
                        thumbnail: null,
                        mediaUrl: '',
                        sourceUrl: 'https://github.com/koyoteh/BLACK-PANTHER',
                        showAdAttribution: false,
                        renderLargerThumbnail: false
                    }
                }
            }).catch(() => sendInteractive(client, m, menuText));
        }

        // Store the menu message so the trigger can identify replies to it
        const menuMsgId = sentMsg?.key?.id;
        setMenuState(m.chat, menuMsgId || null);

        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });

        // Play a random menu audio if available — optional, never fails the command
        try {
            const xhClintonPaths = [
                path.join(__dirname, 'GuruTech'),
                path.join(process.cwd(), 'GuruTech'),
                path.join(__dirname, '..', 'GuruTech')
            ];
            let audioFolder = null;
            for (const folderPath of xhClintonPaths) {
                if (fs.existsSync(folderPath)) { audioFolder = folderPath; break; }
            }
            if (audioFolder) {
                const menuFiles = ['menu1.mp3', 'menu2.mp3', 'menu3.mp3', 'menu4.mp3'];
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
