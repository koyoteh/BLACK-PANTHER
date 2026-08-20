import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { getSettings, banUser, getBannedUsers, getSudoUsers } from '../../database/config.js';
import { resolveTargetJid } from '../../lib/lidResolver.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { client, m, args } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        let settings = await getSettings();
        if (!settings) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, `⚡ ──「 BAN 」──
▢ Settings not found, you broke something.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }

        const sudoUsers = await getSudoUsers();

        let freshParticipants = [];
        if (m.chat && m.chat.endsWith('@g.us')) {
            try {
                const freshMeta = await client.groupMetadata(m.chat);
                freshParticipants = freshMeta.participants || [];
            } catch {}
        }
        if (!freshParticipants.length) freshParticipants = context.participants || [];

        let numberToBan;
        let resolvedJid;

        if (m.quoted) {
            resolvedJid = resolveTargetJid(m.quoted.sender, freshParticipants);
            numberToBan = resolvedJid ? resolvedJid.split('@')[0].replace(/\D/g, '') : null;
        } else if (m.mentionedJid && m.mentionedJid.length > 0) {
            resolvedJid = resolveTargetJid(m.mentionedJid[0], freshParticipants);
            numberToBan = resolvedJid ? resolvedJid.split('@')[0].replace(/\D/g, '') : null;
        } else {
            numberToBan = (args[0] || '').replace(/[^0-9]/g, '');
        }

        if (!numberToBan) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, `⚡ ──「 BAN 」──
▢ Please provide a valid number or quote a user, moron.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }

        if (numberToBan.length > 15) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, `⚡ ──「 BAN 」──
▢ Couldn't resolve that user's phone number (LID address).\n▢ Ask them to send a message first so the bot can map them.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }

        const _devNum = '254116284050';
        const _botNum = (context.client?.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
        if (numberToBan === _devNum || (_botNum && numberToBan === _botNum)) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, `⚡ ──「 BAN 」──
▢ That command cannot be used on the dev or the bot.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }

        if (sudoUsers.includes(numberToBan)) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, `⚡ ──「 BAN 」──
▢ You cannot ban a Sudo User, you absolute fool!\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }

        const bannedUsers = await getBannedUsers();

        if (bannedUsers.includes(numberToBan)) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, `⚡ ──「 BAN 」──
▢ This user is already banned, genius.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }

        await banUser(numberToBan);
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
        await sendInteractive(client, m, `⚡ ──「 BAN 」──
▢ ${numberToBan} has been banned. Get wrecked!\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    });
};
