import { botname } from '../../config/settings.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
  name: 'dev',
  aliases: ['developer', 'contact', 'owner', 'creator', 'devcontact'],
  description: 'Sends the developer contact as a vCard',
  run: async (context) => {
    const { client, m } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
    const bName = botname || 'BLACK-PANTHER-MD';

    try {
      const devContact = {
        phoneNumber: '254114885159',
        fullName: 'Koyoteh | Koyoteh',
        org: 'BLACK-PANTHER-MD Bot'
      };

      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${devContact.fullName}\nORG:${devContact.org};\nTEL;type=CELL;type=VOICE;waid=${devContact.phoneNumber}:+${devContact.phoneNumber}\nEND:VCARD`;

      await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
      await sendInteractive(client, m, `⚡ ──「 Cᴏɴᴛᴀᴄᴛ Cᴀʀᴅ 」──
▢ Developer: ${devContact.fullName}\n▢ Don't spam the dev or you'll\n▢ regret your existence.\n▢ Contact card sent below.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);

      await client.sendMessage(m.chat, {
        contacts: {
          displayName: devContact.fullName,
          contacts: [{ vcard }]
        }
      });

    } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      await sendInteractive(client, m, `⚡ ──「 Fᴀɪʟᴇᴅ 」──
▢ Couldn't send contact card.\n▢ Error: ${error.message}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    }
  }
};
