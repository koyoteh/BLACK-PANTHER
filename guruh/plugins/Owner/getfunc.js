import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { sendInteractive } from '../../lib/sendInteractive.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const normalizeNumber = (jid) => {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0].replace(/\D/g, '') + '@s.whatsapp.net';
};

const DEVELOPER = normalizeNumber('254116284050');
const FEATURES_DIR = path.join(__dirname, '..', '..', 'features');

export default async (context) => {
    const { client, m, text, prefix } = context;
    await client.sendMessage(m.chat, { react: { text: '🔍', key: m.reactKey } });

    if (normalizeNumber(m.sender) !== DEVELOPER) {
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
        return await sendInteractive(client, m, `⚡ ──「 ACCESS DENIED 」──
▢ This command is restricted to the bot owner.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    }

    if (!text) {
        let files = [];
        try { const entries = await fs.readdir(FEATURES_DIR); files = entries.filter(f => f.endsWith('.js')); } catch {}
        const fileList = files.map(f => `▢ • ${f.replace('.js', '')}`).join('\n');
        return await sendInteractive(client, m, `⚡ ──「 GETFUNC 」──
▢ Usage: ${prefix}getfunc <name>\n▢ \n▢ Available features:\n${fileList || '▢ (none found)'}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    }

    const funcName = text.trim().endsWith('.js') ? text.trim().slice(0, -3) : text.trim();
    const filePath = path.join(FEATURES_DIR, `${funcName}.js`);

    try {
        const data = await fs.readFile(filePath, 'utf8');
        const fileBuffer = Buffer.from(data, 'utf8');

        await sendInteractive(client, m, `⚡ ──「 FEATURE FILE 」──
▢ File: ${funcName}.js\n▢ Size: ${data.length} chars\n▢ \n\`\`\`javascript\n${data}\n\`\`\`\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);

        await client.sendMessage(m.chat, {
            document: fileBuffer,
            fileName: `${funcName}.js`,
            mimetype: 'application/javascript',
            caption: `▢ 📄 ${funcName}.js\n▢ Folder: features/\n▢ Size: ${data.length} chars\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`
        });

    } catch (err) {
        if (err.code === 'ENOENT') {
            let files = [];
            try { const entries = await fs.readdir(FEATURES_DIR); files = entries.filter(f => f.endsWith('.js')); } catch {}
            const fileList = files.map(f => `▢ • ${f.replace('.js', '')}`).join('\n');
            return await sendInteractive(client, m, `⚡ ──「 NOT FOUND 」──
▢ "${funcName}" not found in features/.\n▢ \n▢ Available:\n${fileList || '▢ (none found)'}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }
        return await sendInteractive(client, m, `⚡ ──「 ERROR 」──
▢ Error reading file: ${err.message}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    }
};