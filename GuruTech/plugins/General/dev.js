import { generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
  name: 'dev',
  aliases: ['developer', 'contact', 'owner', 'creator', 'devcontact'],
  description: 'Shows developer info with interactive contact card',
  run: async (context) => {
    const { client, m } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    const devPhone = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');
    const devName = 'BLACK PANTHER';
    const devOrg = 'BLACK PANTHER Bot';
    const githubUrl = 'https://github.com/cleanplata/BLACK-PANTHER';
    const waUrl = `https://wa.me/${devPhone}`;

    try {
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });

      await client.relayMessage(m.chat, {
        interactiveMessage: {
          header: {
            title: "𝗢 𝗪 𝗡 𝗘 𝗥   ◦   𝗗 𝗘 𝗧 𝗔 𝗜 𝗟 𝗦",
            hasMediaAttachment: false
          },
          body: {
            text: `*乂  𝗢 𝗪 𝗡 𝗘 𝗥     ◦     𝗜 𝗡 𝗙 𝗢*\n✧ Tag : \n      ◦ @${devPhone}\n\n✧ Rules : \n      ◦ _Don't call owner's number_\n      ◦ _Don't spam_`
          },
          footer: {
            text: "BLACK PANTHER"
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: "booking_confirmation",
                buttonParamsJson: JSON.stringify({
                  icon: "default",
                  start_datetime: "2026-06-10T10:37:10.967Z",
                  end_datetime: "2026-06-10T10:47:10.967Z",
                  location: "BLACK PANTHER",
                  booking_url: waUrl,
                  phone_number: `+${devPhone}`,
                  booking_management_url: "https://whatsapp.com/channel/0029VbDh88NCMY0Fartkxm1g",
                  description: `*◦ 👤 Name  :*  BLACK PANTHER\n*◦ 📞 Number  :*  +${devPhone}\n*◦ ⚡ Status  :*  _Owner_\n`,
                  display_text: "𝐌𝐨𝐫𝐞 𝐎𝐰𝐧𝐞𝐫𝐈𝐧𝐟𝐨",
                  display_content: {
                    display_language: "en",
                    display_meeting_type: "𝐈𝐧𝐟𝐨",
                    display_bottom_sheet_header: "々   P R O F I L E     ◦     I N F O   々",
                    display_add_to_calendar_cta_text: "CALENDAR",
                    display_view_on_maps_cta_text: "O W N E R     ◦     C O U N T R Y",
                    display_manage_booking_cta_text: "🔥 𝐅𝐨𝐥𝐥𝐨𝐰",
                    display_manage_booking_not_supported_text: "OWNER NOT REGISTERED",
                    display_read_more: "READ MORE"
                  }
                })
              },
              {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                  display_text: "🟩 𝐎𝐰𝐧𝐞𝐫 𝐍𝐮𝐦𝐛𝐞𝐫",
                  url: waUrl
                })
              }
            ],
            messageParamsJson: ""
          },
          contextInfo: {
            mentionedJid: devPhone ? [`${devPhone}@s.whatsapp.net`] : []
          }
        }
      }, {});

      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${devName}\nORG:${devOrg};\nTEL;type=CELL;type=VOICE;waid=${devPhone}:+${devPhone}\nEND:VCARD`;
      await client.sendMessage(m.chat, {
        contacts: {
          displayName: devName,
          contacts: [{ vcard }]
        }
      });

    } catch (error) {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${devName}\nORG:${devOrg};\nTEL;type=CELL;type=VOICE;waid=${devPhone}:+${devPhone}\nEND:VCARD`;
      const fallbackText = `╭─❏ 「 DEVELOPER INFO」\n│ 👤 Name: ${devName}\n│ 🏢 Project: ${devOrg}\n│ 📞 Contact: +${devPhone}\n│ \n│ Don't spam the dev or you'll regret your existence.\n│ Serious bugs only — no "how do I use this" questions.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`;
      await sendInteractive(client, m, fallbackText);
      await client.sendMessage(m.chat, { contacts: { displayName: devName, contacts: [{ vcard }] } });
    }
  }
};
