import { sendInteractive } from '../../lib/sendInteractive.js';
import axios from 'axios';
import { GOOGLE_CSE_API_KEY, GOOGLE_CSE_ID } from '../../keys.js';
export default async (context) => {
  const { client, m, text } = context;
  await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

  if (!text) {
    sendInteractive(client, m,
      "╭─❏ 「 USAGE 」\n│ 🚫 Please provide a search term!\n│ Example: .google What is treason\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER"
    );
    return;
  }

  if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_ID) {
    return sendInteractive(client, m,
      '╭─❏ 「 GOOGLE SEARCH 」\n│ Google Search is not configured on this host.\n│ Configure the optional Google Custom Search credentials in host settings.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER'
    );
  }

  try {
    const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: { q: text, key: GOOGLE_CSE_API_KEY, cx: GOOGLE_CSE_ID }
    });

    if (!Array.isArray(data.items) || data.items.length === 0) {
      sendInteractive(client, m,
        "╭─❏ 「 ERROR 」\n│ ❌ Unable to find any results\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER"
      );
      return;
    }

    let tex = "";
    tex += "╭─❏ 「 GOOGLE SEARCH 」\n";
    tex += "│ 🔍 Search Term: " + text + "\n";
    tex += "";

    for (let i = 0; i < data.items.length; i++) {
      tex += "│ Result " + (i + 1) + "\n";
      tex += "│ 🪧 Title: " + data.items[i].title + "\n";
      tex += "│ 📝 Description: " + data.items[i].snippet + "\n";
      tex += "│ 🌐 Link: " + data.items[i].link + "\n";
      tex += "";
    }

    sendInteractive(client, m, tex);
  } catch (e) {
    sendInteractive(client, m,
      "╭─❏ 「 ERROR 」\n│ ❌ An error occurred: " + e.message + "\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER"
    );
  }
};
