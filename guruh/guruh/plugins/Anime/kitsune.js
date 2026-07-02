import { getAnime } from '../../lib/api.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
    name: 'kitsune',
    aliases: ['foxgirl', 'kitsuneani'],
    description: 'Get a random kitsune (fox girl) anime image',
    run: async (context) => {
        const { client, m } = context;
        try {
            await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
            const url = await getAnime('kitsune');
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
            await client.sendMessage(m.chat, {
                image: { url },
                caption: `╭━⬣ 「 Kɪᴛsᴜɴᴇ」
╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`
            });
        } catch (error) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
            await sendInteractive(client, m, `╭━⬣ 「 Eʀʀᴏʀ」
┃ Kitsune escaped!\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
        }
    }
};
