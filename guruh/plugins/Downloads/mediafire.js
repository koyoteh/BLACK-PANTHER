import axios from 'axios';
import * as cheerio from 'cheerio';
import { sendInteractive } from '../../lib/sendInteractive.js';
export default async (context) => {

const { client, m, text, botname  } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });


async function MediaFire(url, options) {
  try {
    let mime;
    options = options ? options : {};
    const res = await axios.get(url, options);
    const $ = cheerio.load(res.data);
    const hasil = [];
    const link = $('a#downloadButton').attr('href');
    const size = $('a#downloadButton').text().replace('Download', '').replace('(', '').replace(')', '').replace('\n', '').replace('\n', '').replace('                         ', '');
    const seplit = link.split('/');
    const nama = seplit[5];
    mime = nama.split('.');
    mime = mime[1];
    hasil.push({ nama, mime, size, link });
    return hasil;
  } catch (err) {
    return err;
  }
}

if (!text) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, "⚡ ──「 MEDIAFIRE 」──\n▢ Provide a MediaFire link, you lazy bum!\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──");
}

if (!text.includes('mediafire.com')) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, "⚡ ──「 MEDIAFIRE 」──\n▢ That doesn't look like a MediaFire link, genius.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──");
    }


await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

try {

        const fileInfo = await MediaFire(text);



if (!fileInfo || !fileInfo.length) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, "▢ File no longer exists on MediaFire. Too slow!\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──");
}






        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });

        await client.sendMessage(
            m.chat,
            {
                document: {
                    url: fileInfo[0].link },
                fileName: fileInfo[0].nama,
                mimetype: fileInfo[0].mime,
                caption: `⚡ ──「 MEDIAFIRE DL 」──
▢ File: ${fileInfo[0].nama}\n▢ Downloaded by ${botname}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──` }


   );

} catch (error) {

        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
        sendInteractive(client, m, `⚡ ──「 MEDIAFIRE ERROR 」──
▢ Download failed, not my fault.\n▢ ${error}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    }

}
