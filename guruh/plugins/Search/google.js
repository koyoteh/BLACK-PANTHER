import { sendInteractive } from '../../lib/sendInteractive.js';
  import axios from 'axios';
export default async (context) => {
  const { client, m, text } = context;
  await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

  if (!text) {
    sendInteractive(client, m, 
      "" +
      "▢ ERROR\n" +
      "" +
      "▢ 🚫 Please provide a search term!\n" +
      "▢ Example: .google What is treason\n" +
      "└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──"
    );
    return;
  }

  try {
    let { data } = await axios.get(
      `https://www.googleapis.com/customsearch/v1?q=${text}&key=AIzaSyDMbI3nvmQUrfjoCJYLS69Lej1hSXQjnWI&cx=baf9bdb0c631236e5`
    );

    if (data.items.length == 0) {
      sendInteractive(client, m, 
        "" +
        "▢ ERROR\n" +
        "" +
        "▢ ❌ Unable to find any results\n" +
        "└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──"
      );
      return;
    }

    let tex = "";
    tex += "";
    tex += "▢ GOOGLE SEARCH\n";
    tex += "";
    tex += "▢ 🔍 Search Term: " + text + "\n";
    tex += "";

    for (let i = 0; i < data.items.length; i++) {
      tex += "▢ Result " + (i + 1) + "\n";
      tex += "▢ 🪧 Title: " + data.items[i].title + "\n";
      tex += "▢ 📝 Description: " + data.items[i].snippet + "\n";
      tex += "▢ 🌐 Link: " + data.items[i].link + "\n";
      tex += "";
    }

    sendInteractive(client, m, tex);
  } catch (e) {
    sendInteractive(client, m, 
      "" +
      "▢ ERROR\n" +
      "" +
      "▢ ❌ An error occurred: " + e.message + "\n" +
      "└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──"
    );
  }
};