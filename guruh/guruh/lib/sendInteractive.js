import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { channelCtx } = require('../../guru/utils/gmdFunctions2.js');

export async function sendInteractive(client, m, text) {
    const chat = m.chat || m.from || m.key?.remoteJid;
    if (!chat || !client) return;
    try {
        return await client.sendMessage(
            chat,
            { text, contextInfo: channelCtx() },
            { quoted: m }
        );
    } catch {
        return client.sendMessage(chat, { text }).catch(() => {});
    }
}
