import middleware from '../../utils/botUtil/middleware.js';
import { resolveTargetJid } from '../../lib/lidResolver.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

const DEV_NUMBER = '254116284050';

export default {
  name: 'remove',
  aliases: ['kick', 'yeet', 'boot', 'removemember'],
  description: 'Removes a user from a group',
  run: async (context) => {
    await middleware(context, async () => {
      const { client, m, prefix } = context;
      await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

      let rawJid = null;
      if (m.mentionedJid && m.mentionedJid.length > 0) rawJid = m.mentionedJid[0];
      if (!rawJid && m.quoted?.sender) rawJid = m.quoted.sender;

      if (!rawJid) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, `▢ Mention or quote a user. ${prefix}kick @user\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
      }

      const groupMetadata = await client.groupMetadata(m.chat);
      const participants = groupMetadata.participants;
      const targetJid = resolveTargetJid(rawJid, participants);
      const botJid = (client.user.id.split(':')[0].split('@')[0].replace(/\D/g, '')) + '@s.whatsapp.net';

      if (!targetJid) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, `▢ Couldn't find that person in this group.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
      }

      const _targetNum = targetJid.split('@')[0].replace(/\D/g, '');
      const _botNum = botJid.split('@')[0].replace(/\D/g, '');
      if (_targetNum === DEV_NUMBER || _targetNum === _botNum) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, `▢ That command cannot be used on the dev or the bot.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
      }

      try {
        await client.groupParticipantsUpdate(m.chat, [targetJid], 'remove');
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
        await client.sendMessage(m.chat, {
          text: `⚡ ──「 KICKED 」──
▢ @${targetJid.split('@')[0]} got yeeted out.\n▢ Good riddance, trash.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`,
          mentions: [targetJid]
        });
      } catch (error) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        await sendInteractive(client, m, `▢ Couldn't kick that user.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
      }
    });
  }
};
