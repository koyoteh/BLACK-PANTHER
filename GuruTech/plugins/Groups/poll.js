import { sendInteractive } from '../../lib/sendInteractive.js';
const polls = new Map();

export default {
    name: 'poll',
    alias: ['createpoll', 'vote'],
    description: 'Create a group poll',
    run: async (context) => {
        const { client, m } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
        if (!m.isGroup) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return m.reply(`╭─❏ 「 POLL 」
│ Group only command, dumbass.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
        }

        const input = (context.text || context.q || '').trim();
        if (!input.includes('|')) return m.reply(`╭─❏ 「 POLL 」
│ Format: .poll Question | Option1 | Option2 | ...\n│ Example: .poll Best bot? | BLACK PANTHER | Other bots\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);

        const parts = input.split('|').map(s => s.trim()).filter(Boolean);
        if (parts.length < 3) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return m.reply(`╭─❏ 「 POLL 」
│ Need at least a question + 2 options.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
        }

        const question = parts[0];
        const options = parts.slice(1).slice(0, 12);

        try {
            await client.sendMessage(m.chat, {
                poll: {
                    name: question,
                    values: options,
                    selectableCount: 1
                }
            });
        } catch {
            const nums = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','⓫','⓬'];
            const optText = options.map((o,i) => `╭─❏ 「 POLL 」
│ ${nums[i]||'•'} ${o}`).join('\n');
            await sendInteractive(client, m, `╭─❏ 「 POLL」
│ ❓ ${question}\n${optText}\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
        }
    }
};
