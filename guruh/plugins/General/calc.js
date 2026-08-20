import { sendInteractive } from '../../lib/sendInteractive.js';

const ALLOWED = /^[0-9+\-*/.()%^ ]+$/;

export default {
    name: 'calc',
    aliases: ['calculate', 'math', 'solve'],
    description: 'Evaluate a mathematical expression',
    run: async (context) => {
        const { client, m, text } = context;
        const expr = (text || '').trim();
        if (!expr) {
            await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
            return sendInteractive(client, m, `⚡ ──「 Cᴀʟᴄᴜʟᴀᴛᴏʀ 」──
│
▢ Give me an expression. Usage: .calc 2+2\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }
        if (!ALLOWED.test(expr)) {
            return sendInteractive(client, m, `⚡ ──「 Cᴀʟᴄᴜʟᴀᴛᴏʀ 」──
│
▢ Only numbers and operators please. No tricks.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }
        try {
            const result = Function('"use strict"; return (' + expr + ')')();
            if (result === undefined || result === null || !isFinite(result)) throw new Error('invalid result');
            return sendInteractive(client, m, `⚡ ──「 Cᴀʟᴄᴜʟᴀᴛᴏʀ 」──
│
▢ 🔢 ${expr}\n▢ = ${result}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        } catch (e) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `⚡ ──「 Cᴀʟᴄᴜʟᴀᴛᴏʀ 」──
│
▢ That expression is broken. Fix your math.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }
    }
};
