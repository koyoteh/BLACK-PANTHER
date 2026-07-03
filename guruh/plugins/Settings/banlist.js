import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { getBannedUsers } from '../../database/config.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { m } = context;

        const bannedUsers = await getBannedUsers();

        if (!bannedUsers || bannedUsers.length === 0) {
            await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, 
                `` +
                `⚡ ──「 BAN LIST 」──
` +
                `▢ \n` +
                `▢ There are no banned users at the moment.\n` +
                `└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──\n` +
                ``
            );
        }

        const list = bannedUsers.map((num, index) => `▢ ${index + 1}. ${num}`).join('\n');
        await sendInteractive(client, m, 
            `` +
            `⚡ ──「 BAN LIST 」──
` +
            `▢ \n` +
            `${list}\n` +
            `└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──\n` +
            ``
        );
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
    });
};
