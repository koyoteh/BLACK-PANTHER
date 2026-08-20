import { getAnime } from '../../lib/api.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
    name: 'animehug',
    aliases: ['glomp'],
    description: 'Send a hug anime gif',
    run: async (context) => {
        const { client, m } = context;
        try {
            await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
            const url = await getAnime('hug');
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
            await client.sendMessage(m.chat, {
                image: { url },
                caption: `⚡ ──「 Hᴜɢ 」──
└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`
            });
        } catch (error) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
            await sendInteractive(client, m, `⚡ ──「 Eʀʀᴏʀ 」──
▢ No hugs available!\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }
    }
};
