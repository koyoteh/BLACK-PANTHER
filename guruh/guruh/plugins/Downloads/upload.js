import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';
import { sendInteractive } from '../../lib/sendInteractive.js';
import { uploadToUrl } from '../../lib/toUrl.js';

export default {
    name: 'upload',
    aliases: ['upl', 'url', 'tourl', 'fileupload'],
    run: async (context) => {
        const { client, m } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        try {
            const q = m.quoted ? m.quoted : m;
            const mime = (q.msg || q).mimetype || '';

            if (!mime) {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, `╭━⬣ 「 Eʀʀᴏʀ」\n┃ Quote or send a media file to upload.\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
            }

            const mediaBuffer = await q.download();

            if (mediaBuffer.length > 256 * 1024 * 1024) {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, `╭━⬣ 「 Eʀʀᴏʀ」\n┃ File too large! Max 256MB.\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
            }

            await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

            const ext = mime.split('/')[1] || 'bin';
            const link = await uploadToUrl(mediaBuffer, ext);
            const fileSizeMB = (mediaBuffer.length / (1024 * 1024)).toFixed(2);

            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });

            const resultText = `╭━⬣ 「 Uᴘʟᴏᴀᴅ Dᴏɴᴇ」\n┃ \n┃ 🔗 *Link:* ${link}\n┃ 📁 *Size:* ${fileSizeMB} MB\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`;

            try {
                const msg = await generateWAMessageFromContent(m.chat, proto.Message.fromObject({
                    interactiveMessage: {
                        body: { text: resultText },
                        footer: { text: '' },
                        nativeFlowMessage: {
                            messageVersion: 1,
                            buttons: [{
                                name: 'cta_copy',
                                buttonParamsJson: JSON.stringify({ display_text: 'Copy Link', copy_code: link })
                            }],
                            messageParamsJson: ''
                        }
                    }
                }), { userJid: client.user?.id });
                await client.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
            } catch {
                await sendInteractive(client, m, resultText);
            }

        } catch (err) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            sendInteractive(client, m, `╭━⬣ 「 Uᴘʟᴏᴀᴅ Eʀʀᴏʀ」\n┃ Upload failed, try again.\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
        }
    }
};
