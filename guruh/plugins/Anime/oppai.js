import { getAnime } from '../../lib/api.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
    name: 'oppai',
    aliases: ['animedance', 'animefan'],
    description: 'Get a random oppai anime image',
    run: async (context) => {
        const { client, m } = context;
        try {
            await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
            const url = await getAnime('oppai');
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
            await client.sendMessage(m.chat, {
                image: { url },
                caption: `⚡ ──「 Aɴɪᴍᴇ 」──
└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`
            });
        } catch (error) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
            await sendInteractive(client, m, `⚡ ──「 Eʀʀᴏʀ 」──
▢ Try again later!\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──\n> ©𝐏𝐨𝐰𝐞𝐫𝐞ᴅ 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
        }
    }
};
