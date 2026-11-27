import { sendInteractive } from '../../lib/sendInteractive.js';
import { playSearchDownload, searchPlayTrack } from '../../lib/ryuuYt.js';
import { sendPlayAudio, downloadSongThumbnail } from '../../lib/playAudio.js';

export default {
  name: 'play',
  aliases: ['ply', 'playy', 'pl'],
  description: 'Search for a song and send its audio',
  run: async (context) => {
    const { client, m, text } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});
    const fmt = (msg) => `╭•─⛓ *BLACK PANTHER · 𝗽𝗹𝗮𝘆* ⛓─•╮\n⛓ ▣ ${msg}\n╰•─⛓━━━━━━━━━━⛓─•╯`;
    const input = String(text || '').trim();

    if (!input) {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      return sendInteractive(client, m, fmt('Send a song name or YouTube link. Example: .play Gamble'));
    }

    const legacySelection = input.match(/^(mp3|mp4)\s+(.+)$/i);
    if (legacySelection?.[1].toLowerCase() === 'mp4') {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      return sendInteractive(client, m, fmt('The video option was removed. Send .play <song> to receive audio directly.'));
    }
    const query = legacySelection?.[1].toLowerCase() === 'mp3' ? legacySelection[2].trim() : input;

    try {
      const song = await searchPlayTrack(query);
      const thumbnailPromise = downloadSongThumbnail(song.thumbnail).catch(() => null);
      const media = await playSearchDownload(song.videoUrl, song);
      await sendPlayAudio(client, m, song, media, { thumbnailBuffer: await thumbnailPromise });
      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
    } catch (error) {
      console.error('play error:', error);
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      await sendInteractive(client, m, fmt('Could not prepare that audio from the available sources. Try another song or try again later.'));
    }
  }
};
