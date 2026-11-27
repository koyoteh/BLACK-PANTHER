import { audioFileExtension } from './daveTechMusic.js';

function safeFileName(name, ext = 'mp3') {
  const base = String(name || 'audio')
    .replace(/[^\w\s\-\.\(\)\[\]]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'audio';
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

export async function sendAudioSafe(client, jid, buffer, {
  title = 'audio',
  quoted = null,
  caption = '',
  mimetype = 'audio/mpeg',
  thumbnail = ''
} = {}) {
  const fileName = safeFileName(title, audioFileExtension(mimetype));
  const sendOptions = quoted ? { quoted } : {};
  let captionSent = false;

  if (caption && /^https?:\/\//i.test(String(thumbnail || '').trim())) {
    try {
      await client.sendMessage(jid, { image: { url: String(thumbnail).trim() }, caption }, sendOptions);
      captionSent = true;
    } catch (error) {
      console.warn('[audio] Song thumbnail could not be sent:', error?.message || error);
    }
  }

  if (caption && !captionSent) {
    await client.sendMessage(jid, { text: caption }, sendOptions);
  }

  await client.sendMessage(
    jid,
    {
      audio: buffer,
      mimetype,
      ptt: false,
      fileName
    },
    sendOptions
  );
}

export default sendAudioSafe;
