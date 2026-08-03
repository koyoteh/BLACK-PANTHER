import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js'; 
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { client, m, Owner, isBotAdmin } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

                 if (!m.isGroup) {
                     await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                     return sendInteractive(client, m, `▢ \n▢ This command is meant for groups.\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`);
                 }
         if (!isBotAdmin) {
             await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
             return sendInteractive(client, m, `▢ \n▢ I need admin privileges.\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`); 
         }

                 await client.groupParticipantsUpdate(m.chat,  [m.sender], 'promote'); 
 sendInteractive(client, m, `⚡ ──「 PROMOTED 」──
▢ Promoted. Now you have power.\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`); 
          })

}
