import { setAfk, removeAfk, isAfk } from '../../features/afk.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
    name: 'afk',
    alias: ['away', 'brb'],
    description: 'Set yourself as AFK',
    run: async (context) => {
        const { client, m } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
        const senderNum = m.sender.split('@')[0].split(':')[0];
        const reason = context.text || context.q || 'no reason';

        if (isAfk(senderNum)) {
            removeAfk(senderNum);
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 AFK 」
│ AFK removed. Welcome back, ghost. 👁️\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
        }

        setAfk(senderNum, reason);
        return client.sendMessage(m.chat, {
            text: `╭─❏ 「 AFK SET」
│ @${senderNum} went AFK.\n│ Reason: ${reason}\n│ Don't bother them. 🚫\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`,
            mentions: [m.sender]
        });
    }
};
