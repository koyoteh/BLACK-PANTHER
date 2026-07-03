import wiki from 'wikipedia';
import { sendInteractive } from '../../lib/sendInteractive.js';
export default async (context) => {

const { client, m, text } = context;
await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });




        try {
            if (!text) {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, "▢ Provide a term to search, you lazy fool.\n▢ E.g: What is JavaScript!\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──")
            }
            const con = await wiki.summary(text);
            const texa = `⚡ ──「 WIKIPEDIA 」──
▢ Title: ${con.title}\n▢ Desc: ${con.description}\n▢ \n▢ Summary: ${con.extract}\n▢ \n▢ URL: ${con.content_urls.mobile.page}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`
            sendInteractive(client, m, texa)
        } catch (err) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            console.log(err)
            return sendInteractive(client, m, "▢ Got 404. Couldn't find anything, try harder.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──")
        }
    }
