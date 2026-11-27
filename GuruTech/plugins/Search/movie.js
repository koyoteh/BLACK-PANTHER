import { sendInteractive } from '../../lib/sendInteractive.js';
  import axios from 'axios';
import { OMDB_API_KEY } from '../../keys.js';
export default async (context) => {
  const { client, m, text } = context;
  await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

  if (!text) {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      return sendInteractive(client, m, "🚫 Please provide a movie name or TV show");
  }
  if (!OMDB_API_KEY) return sendInteractive(client, m, 'Set OMDB_API_KEY in the host environment to use movie lookup.');

  try {
    const params = new URLSearchParams({ apikey: OMDB_API_KEY, t: text, plot: 'full' });
    let fids = await axios.get(`https://www.omdbapi.com/?${params}`);
    let imdbt = "";

    imdbt += `╭─❏ 「 MOVIE SEARCH 」
`;
    imdbt += "│ 🎬 Title       : " + fids.data.Title + "\n";
    imdbt += "│ 📅 Year        : " + fids.data.Year + "\n";
    imdbt += "│ ⭐ Rated       : " + fids.data.Rated + "\n";
    imdbt += "│ 📆 Released    : " + fids.data.Released + "\n";
    imdbt += "│ ⏳ Runtime     : " + fids.data.Runtime + "\n";
    imdbt += "│ 🌀 Genre       : " + fids.data.Genre + "\n";
    imdbt += "│ 👨‍💼 Director   : " + fids.data.Director + "\n";
    imdbt += "│ ✍️ Writer      : " + fids.data.Writer + "\n";
    imdbt += "│ 👥 Actors      : " + fids.data.Actors + "\n";
    imdbt += "│ 📜 Plot        : " + fids.data.Plot + "\n";
    imdbt += "│ 🌐 Language    : " + fids.data.Language + "\n";
    imdbt += "│ 🌍 Country     : " + fids.data.Country + "\n";
    imdbt += "│ 🏆 Awards      : " + fids.data.Awards + "\n";
    imdbt += "│ 💰 BoxOffice   : " + fids.data.BoxOffice + "\n";
    imdbt += "│ 🏭 Production  : " + fids.data.Production + "\n";
    imdbt += "│ 🌟 imdbRating  : " + fids.data.imdbRating + "\n";
    imdbt += "│ 🗳️ imdbVotes   : " + fids.data.imdbVotes + "\n";
    imdbt += "╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER";

    await client.sendMessage(
      m.chat,
      {
        image: {
          url: fids.data.Poster },
        caption: imdbt }
    );
  } catch (e) {
    sendInteractive(client, m, "❌ I cannot find that movie\n\n" + e);
  }
};
