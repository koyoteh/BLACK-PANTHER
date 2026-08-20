import { sendInteractive } from '../../lib/sendInteractive.js';
  import yts from 'yt-search';
export default async (context) => {
  const { client, m, text } = context;
  await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

  const formatStylishReply = (message) => {
    return `▢ ${message}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`;
  };

  if (!text) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, formatStylishReply("Yo, dumbass, give me a song name! 🎵 Don’t waste my time."));
  }

  if (text.length > 100) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, formatStylishReply("What’s this essay, loser? Keep the song name short, max 100 chars."));
  }

  const { videos } = await yts(text);
  if (!videos || videos.length === 0) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, formatStylishReply("No songs found, you got shit taste. 😕 Try something else."));
  }

  const song = videos[0];
  const title = song.title;
  const artist = song.author?.name || "Unknown Artist";
  const views = song.views?.toLocaleString() || "Unknown";
  const duration = song.duration?.toString() || "Unknown";
  const uploaded = song.ago || "Unknown";
  const thumbnail = song.thumbnail || "";
  const videoUrl = song.url;

  const response = `` +
                  `▢ *${title}* found for @${m.sender.split('@')[0].split(':')[0]}! 🎶\n` +
                  `│🎤 *Artist*: ${artist}\n` +
                  `│👀 *Views*: ${views}\n` +
                  `│⏱ *Duration*: ${duration}\n` +
                  `│📅 *Uploaded*: ${uploaded}\n` +
                  (thumbnail ? `│🖼 *Thumbnail*: ${thumbnail}\n` : '') +
                  `│🔗 *Video*: ${videoUrl}\n` +
                  `└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──\n` +
                  `Powered by BLACK-PANTHER-MD`;

  await sendInteractive(client, m, formatStylishReply(response));
};