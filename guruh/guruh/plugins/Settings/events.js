import { generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { getSettings, getGroupSettings, updateGroupSetting } from '../../database/config.js';
import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { getDeviceMode } from '../../lib/deviceMode.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
  await ownerMiddleware(context, async () => {
    const { client, m, args, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
    const jid = m.chat;

    const formatStylishReply = (message) => {
      return `┃ ${message}\n╰━━━━━━━━━━━━━━━
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`;
    };

    try {
      if (!jid.endsWith('@g.us')) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
        return await client.sendMessage(
          m.chat,
          { text: formatStylishReply("Yo, dumbass! 😈 This command only works in groups, not your sad DMs. 🖕") },
          { ad: true }
        );
      }

      const settings = await getSettings();
      if (!settings || Object.keys(settings).length === 0) {
        return await client.sendMessage(
          m.chat,
          { text: formatStylishReply("Database is fucked, no settings found. Fix it, loser. 💀") },
          { ad: true }
        );
      }

      const value = args[0]?.toLowerCase();
      let groupSettings = await getGroupSettings(jid);
      console.log('BLACK-PANTHER-MD: Group settings for', jid, ':', groupSettings);
      let isEnabled = groupSettings?.events === true || groupSettings?.events === 1;

      if (value === 'on' || value === 'off') {
        const action = value === 'on';
        if (isEnabled === action) {
          await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});

          return await client.sendMessage(
            m.chat,
            {
              text: formatStylishReply(
                `Yo, genius! 😈 Events are already ${value.toUpperCase()} in this group! Stop wasting my time, moron. 🖕`
              ) },
            { ad: true }
          );
        }

        await updateGroupSetting(jid, 'events', action);
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
        return await client.sendMessage(
          m.chat,
          {
            text: formatStylishReply(
              `Events ${value.toUpperCase()}! 🔥 ${action ? 'Group events are live, let’s make some chaos! 💥' : 'Events off, you boring loser. 😴'}`
            ) },
          { ad: true }
        );
      }

            const _devMode = await getDeviceMode();
      if (_devMode === 'ios') {
          await client.sendMessage(m.chat, { react: { text: '📋', key: m.reactKey } });
          await sendInteractive(client, m, `╭━⬣ 「 EVENTS」
┃ Status: ${settings.events ? 'ON ✅' : 'OFF ❌'}\n┃ \n┃ Options:\n┃ ${prefix}events on\n┃ ${prefix}events off\n╰━━━━━━━━━━━━━━━\n> 🌐 hosting.wa.me/254105521300`);
      } else {
    const _msg = generateWAMessageFromContent(
            m.chat,
            {
                interactiveMessage: {
                    body: { text: formatStylishReply(
                `Events Status: ${isEnabled ? 'ON 🥶' : 'OFF 😴'}. Pick a vibe, noob! 😈`
              ) },
                    footer: { text: '' },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: 'single_select',
                                buttonParamsJson: JSON.stringify({
                                    title: 'Choose an option',
                                    sections: [{
                                        rows: [
                                                                                                    { title: 'ON ✅', id: `${prefix}events on` },
                                                            { title: 'OFF ❌', id: `${prefix}events off` }
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
    } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      console.error('BLACK-PANTHER-MD: Error in events.js:', error.stack);
      await client.sendMessage(
        m.chat,
        {
          text: formatStylishReply(
            `Shit broke, couldn’t update events. Database error: ${error.message}. Try later, moron. 💀`
          ) },
        { ad: true }
      );
    }
  });
};