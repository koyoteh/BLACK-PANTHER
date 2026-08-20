import { makePDF } from '../../lib/api.js';
    import { getSettings } from '../../database/config.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

  export default {
      name: 'pdf',
      aliases: ['topdf', 'createpdf', 'makepdf'],
      description: 'Create a PDF from text',
      category: 'General',
      run: async (context) => {
          const { client, m } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
          const settings = await getSettings();
          const prefix = settings.prefix || '.';

          const query = (m.text || '').replace(/^\S+\s*/, '').trim();

          if (!query) {
              return sendInteractive(client, m, `⚡ ──「 Eʀʀᴏʀ 」──
▢ Give me some text to convert.\n▢ Example: ${prefix}pdf Hello world this is my document\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──\n> ©𝐏𝐨𝐰𝐞᠊ʀᴇᴅ 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
          }

          await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

          try {
              const pdfBuf = await makePDF(query);

              await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
              await client.sendMessage(m.chat, {
                  document: pdfBuf,
                  mimetype: 'application/pdf',
                  fileName: `document_${Date.now()}.pdf`,
                  caption: `⚡ ──「 PDF Cʀᴇᴀᴛᴇᴅ 」──
▢ Here's your document.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──\n> ©𝐏𝐨𝐰𝐞᠊ʀᴇᴅ 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`
              });
          } catch {
              await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
              await sendInteractive(client, m, `⚡ ──「 Eʀʀᴏʀ 」──
▢ PDF creation failed. Try again.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──\n> ©𝐏𝐨𝐰𝐞᠊ʀᴇᴅ 𝐁𝐲 𝐱𝐡_𝐜𝐥𝐢𝐧𝐭𝐨𝐧`);
          }
      }
  };
  