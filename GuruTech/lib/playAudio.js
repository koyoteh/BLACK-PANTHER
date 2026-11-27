import { downloadBuffer } from './ryuuYt.js';
import { sendAudioSafe } from './sendAudioSafe.js';
import { addWebsiteRibbon, getUserOrBotThumbnail } from './avatarThumbnail.js';
import { audioMimeType, extractYouTubeVideoId, youtubeWatchUrl } from './daveTechMusic.js';

function cleanLine(value, limit = 80) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function formatDuration(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const totalSeconds = Math.floor(Number(raw));
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
  }
  return raw;
}

export function buildPlayAudioCaption(song = {}) {
  const title = cleanLine(song.title || 'YouTube audio', 80);
  const artist = cleanLine(song.artist || song.channel || '', 48);
  const duration = formatDuration(song.duration);
  const details = [artist, duration].filter(Boolean).join(' · ');
  return [
    '> ╭┈┈┈⟡ *BLACK PANTHER* ⟡┈┈┈╮',
    '> ┊ 𝙈𝙀𝘿𝙄𝘼 𝙍𝙀𝘼𝘿𝙔  ·  _PLAY_',
    '> ┊',
    `> ┊ 🎵 *${title}*`,
    ...(details ? [`> ┊ ◆ Details  ⟶  *${details}*`] : []),
    '> ┊ ↳ Audio is ready',
    '> ╰┈┈┈⟡ *GURUTECH SYSTEMS* ⟡┈┈┈╯'
  ].join('\n');
}

export async function downloadSongThumbnail(url) {
  if (!/^https:\/\//i.test(String(url || ''))) return null;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return null;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.startsWith('image/')) return null;
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > 2 * 1024 * 1024) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length && buffer.length <= 2 * 1024 * 1024 ? buffer : null;
  } catch {
    return null;
  }
}

export async function sendPlayAudio(client, m, song = {}, media = {}, {
  downloadBufferFn = downloadBuffer,
  sendAudioFn = sendAudioSafe,
  thumbnailBuffer = null
} = {}) {
  const buffer = Buffer.isBuffer(media.buffer)
    ? media.buffer
    : media.link
      ? await downloadBufferFn(media.link)
      : null;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('The audio source returned an empty file.');

  const title = cleanLine(media.title || song.title || 'YouTube audio', 80);
  const artist = cleanLine(media.channel || media.artist || song.artist || song.channel || '', 48);
  const duration = formatDuration(media.duration || song.duration);
  const details = [artist, duration].filter(Boolean).join(' · ');
  const videoId = media.videoId || song.videoId || extractYouTubeVideoId(media.videoUrl || song.videoUrl || '');
  const sourceUrl = media.videoUrl || song.videoUrl || youtubeWatchUrl(videoId);
  const thumbnailUrl = media.thumbnail || song.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
  let previewThumbnail = Buffer.isBuffer(thumbnailBuffer) && thumbnailBuffer.length ? thumbnailBuffer : null;
  if (!previewThumbnail) previewThumbnail = await downloadSongThumbnail(thumbnailUrl);
  if (previewThumbnail) previewThumbnail = await addWebsiteRibbon(previewThumbnail);
  if (!previewThumbnail) {
    previewThumbnail = (await getUserOrBotThumbnail(client, m?.sender).catch(() => null))?.bot?.buffer || null;
  }
  const caption = buildPlayAudioCaption({ title, artist, duration });
  const preview = {
    showAdAttribution: false,
    title,
    body: details || 'Song audio',
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(previewThumbnail ? { thumbnail: previewThumbnail } : {}),
    mediaType: 1,
    renderLargerThumbnail: false
  };
  const previewMessage = { text: caption };
  if (previewThumbnail) previewMessage.contextInfo = { externalAdReply: preview };

  await client.sendMessage(m.chat, previewMessage, m ? { quoted: m } : {});
  await sendAudioFn(client, m.chat, buffer, {
    title,
    quoted: m,
    caption: '',
    mimetype: audioMimeType(media.format),
    thumbnail: ''
  });
  return { buffer, title, artist, duration, thumbnail: previewThumbnail };
}
