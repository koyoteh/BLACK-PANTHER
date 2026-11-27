import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { client, m, Owner, isBotAdmin } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

                 if (!m.isGroup) {
                     await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                     return sendInteractive(client, m, `╭─❏ 「 OADMIN 」
│ \n│ This command is meant for groups.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
                 }
         if (!isBotAdmin) {
             await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
             return sendInteractive(client, m, `╭─❏ 「 OADMIN 」
│ \n│ I need admin privileges.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
         }

                 await client.groupParticipantsUpdate(m.chat,  [m.sender], 'promote');
 sendInteractive(client, m, `╭─❏ 「 PROMOTED」
│ Promoted. Now you have power.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
          })

}
