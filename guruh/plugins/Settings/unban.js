import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { getBannedUsers, unbanUser } from '../../database/config.js';
import { resolvePhoneNumber } from '../../lib/lidResolver.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { client, m, args, participants } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        let numberToUnban;

        if (m.quoted) {
            numberToUnban = resolvePhoneNumber(m.quoted.sender, participants);
        } else if (m.mentionedJid && m.mentionedJid.length > 0) {
            numberToUnban = resolvePhoneNumber(m.mentionedJid[0], participants);
        } else {
            numberToUnban = (args[0] || '').replace(/[^0-9]/g, '');
        }

        if (!numberToUnban) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, `▢ Provide a valid number or quote a user, genius.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }

        const bannedUsers = await getBannedUsers();

        if (!bannedUsers.includes(numberToUnban)) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, `▢ This user wasn't even banned. What are you doing?\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }

        await unbanUser(numberToUnban);
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
        await sendInteractive(client, m, `⚡ ──「 UNBAN 」──
▢ ${numberToUnban} has been unbanned.\n▢ They better not mess up again.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    });
};
