import { generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { getSettings, getGroupSettings, updateGroupSetting } from '../../database/config.js';
import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { getDeviceMode } from '../../lib/deviceMode.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
  await ownerMiddleware(context, async () => {
    const { client, m, args } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
    const value = args[0]?.toLowerCase();
    const jid = m.chat;

    const formatStylishReply = (title, message) => {
      return `╭━⬣ 「 ${title}」
┃ ${message}\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`;
    };

    if (!jid.endsWith('@g.us')) {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      return await client.sendMessage(m.chat, { text: formatStylishReply("ANTIPROMOTE", "Nice try, idiot!\n┃ This command is for groups only, you moron!") });
    }

    const settings = await getSettings();
    const prefix = settings.prefix;

    let groupSettings = await getGroupSettings(jid);
    let isEnabled = groupSettings?.antipromote === true;

    if (value === 'on' || value === 'off') {
      const action = value === 'on';

      if (isEnabled === action) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return await client.sendMessage(m.chat, { text: formatStylishReply("ANTIPROMOTE", `Antipromote is already ${value.toUpperCase()}, you clueless moron!\n┃ Stop spamming my commands!\n┃ \n┃ 📌 Usage: ${prefix}antipromote on | ${prefix}antipromote off`) });
      }

      await updateGroupSetting(jid, 'antipromote', action);
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
      return await client.sendMessage(m.chat, { text: formatStylishReply("ANTIPROMOTE", `Antipromote ${value.toUpperCase()}!\n┃ Promotions are under my control, king!\n┃ \n┃ 📌 Usage: ${prefix}antipromote on | ${prefix}antipromote off`) });
    }

        const _devMode = await getDeviceMode();
    if (_devMode === 'ios') {
          await client.sendMessage(m.chat, { react: { text: '📋', key: m.reactKey } });
          await sendInteractive(client, m, `╭━⬣ 「 ANTIPROMOTE」
┃ Status: ${settings.antipromote ? 'ON ✅' : 'OFF ❌'}\n┃ \n┃ Options:\n┃ ${prefix}antipromote on\n┃ ${prefix}antipromote off\n╰━━━━━━━━━━━━━━━\n> 🌐 hosting.wa.me/254105521300`);
      } else {
    const _msg = generateWAMessageFromContent(
            m.chat,
            {
                interactiveMessage: {
                    body: { text: formatStylishReply("ANTIPROMOTE", `Antipromote's ${isEnabled ? 'ON' : 'OFF'} right now. Pick one, fool!\n┃ \n┃ 📌 Usage: ${prefix}antipromote on | ${prefix}antipromote off`) },
                    footer: { text: '' },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: 'Choose an option',
                                    sections: [{
                                        rows: [
                                                                                                    { title: 'ON ✅', id: `${prefix}antipromote on` },
                                                            { title: 'OFF ❌', id: `${prefix}antipromote off` }
                                        ]
                                    }]
                                })
                            }
                        ]
                    }
                }
            }
          );
          await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });

          await client.relayMessage(m.chat, _msg.message, { messageId: _msg.key.id });
    }
  });
};
