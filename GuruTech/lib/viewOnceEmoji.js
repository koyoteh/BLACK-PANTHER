// Emoji shortcuts for saving a view-once message quietly.
//   1. The owner replies to a view-once with one of these emojis (same as .vv / .retrieve).
//   2. The owner reacts to a view-once with one of these emojis.
// Nothing is sent to the chat the view-once came from: the media goes to the bot's own chat only.

export const VV_EMOJIS = ['😘', '😅', '😂', '🤩', '😍', '🥰', '😋', '❤️', '♥️', '🙂'];

export function normalizeEmoji(value) {
  return String(value || '').replace(/[\uFE0E\uFE0F\u200D\s]/g, '');
}

const NORMALIZED = new Set(VV_EMOJIS.map(normalizeEmoji));

export function isVvEmoji(value) {
  return NORMALIZED.has(normalizeEmoji(value));
}

const VO_WRAPPERS = ['viewOnceMessageV2Extension', 'viewOnceMessageV2', 'viewOnceMessage'];
const TRANSPORT = ['ephemeralMessage', 'documentWithCaptionMessage', 'deviceSentMessage', 'editedMessage', 'futureProofMessage'];

// Returns { type, msg } when the message is a view-once image/video/voice note, otherwise null.
export function findViewOnceMedia(message) {
  if (!message || typeof message !== 'object') return null;
  let current = message;
  let wrapped = false;
  for (let i = 0; i < 15; i++) {
    const key = [...VO_WRAPPERS, ...TRANSPORT].find((name) => current?.[name]?.message);
    if (!key) break;
    if (VO_WRAPPERS.includes(key)) wrapped = true;
    current = current[key].message;
  }
  const candidates = [
    ['image', current?.imageMessage],
    ['video', current?.videoMessage],
    ['audio', current?.audioMessage || current?.pttMessage]
  ];
  for (const [type, msg] of candidates) {
    if (msg && (wrapped || msg.viewOnce === true)) return { type, msg };
  }
  return null;
}

// Messages kept in the database were saved as JSON, which turns Buffers into { type: 'Buffer', data: [...] }.
export function reviveBuffers(value) {
  if (Array.isArray(value)) return value.map(reviveBuffers);
  if (value && typeof value === 'object') {
    if (value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = reviveBuffers(item);
    return out;
  }
  return value;
}

export async function loadStoredMessage(store, chat, id) {
  if (!id) return null;
  try {
    if (store?.chats) {
      const lists = [];
      if (Array.isArray(store.chats[chat])) lists.push(store.chats[chat]);
      for (const [jid, list] of Object.entries(store.chats)) {
        if (jid !== chat && Array.isArray(list)) lists.push(list);
      }
      for (const list of lists) {
        const found = list.find((item) => item?.key?.id === id);
        if (found?.message) return { key: found.key, message: found.message, sender: found.sender || found.key?.participant || '' };
      }
    }
  } catch {}
  try {
    const { getMessage } = await import('./MessageStore.js');
    const row = await getMessage(id);
    if (row?.message?.message) {
      return {
        key: row.message.key || { id, remoteJid: row.jid },
        message: reviveBuffers(row.message.message),
        sender: row.sender || row.message?.key?.participant || ''
      };
    }
  } catch {}
  return null;
}

async function downloadMedia(client, media) {
  try {
    const baileys = await import('@whiskeysockets/baileys');
    const stream = await baileys.downloadContentFromMessage(media.msg, media.type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    if (buffer.length) return buffer;
  } catch {}
  try {
    const buffer = await client.downloadMediaMessage(media.msg);
    if (buffer?.length) return buffer;
  } catch {}
  return null;
}

function botChatJid(client) {
  const raw = client.user?.id || '';
  const decoded = client.decodeJid ? client.decodeJid(raw) : raw;
  return decoded.includes(':') ? `${decoded.split(':')[0]}@s.whatsapp.net` : decoded;
}

const recentlySaved = new Set();

// Saves the view-once media to the bot's own chat. Sends nothing to the original chat. Returns true on success.
export async function saveViewOnceSilently(client, { message, id = '', senderJid = '', chat = '' }) {
  try {
    const media = findViewOnceMedia(message);
    if (!media) return false;
    if (id && recentlySaved.has(id)) return true;

    const dest = botChatJid(client);
    if (!dest) return false;
    const buffer = await downloadMedia(client, media);
    if (!buffer) {
      console.log(`⚠️ [VV-EMOJI] could not download the view-once${id ? ` (${id})` : ''}: WhatsApp may not have given this session the media`);
      return false;
    }

    const raw = String(senderJid || '');
    const rawNumber = raw.split('@')[0].split(':')[0];
    const cached = raw.endsWith('@lid') ? globalThis.lidPhoneCache?.get(rawNumber) : null;
    const senderNumber = (cached ? String(cached).replace(/\D/g, '') : rawNumber) || 'Unknown';
    const when = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
    const extra = String(media.msg.caption || '').trim();
    const caption = [
      '╭─❏ 「 VIEW ONCE SAVED 」',
      `│ Sender: @${senderNumber}`,
      `│ Chat: ${String(chat).endsWith('@g.us') ? 'Group 👥' : 'DM 💬'}`,
      `│ Time: ${when}`,
      ...(extra ? [`│ Caption: ${extra}`] : []),
      '╰───────────────'
    ].join('\n');
    const mentions = senderJid ? [senderJid] : [];

    if (media.type === 'image') await client.sendMessage(dest, { image: buffer, caption, mentions });
    else if (media.type === 'video') await client.sendMessage(dest, { video: buffer, caption, mentions });
    else {
      await client.sendMessage(dest, { audio: buffer, mimetype: media.msg.mimetype || 'audio/ogg; codecs=opus', ptt: media.msg.ptt !== false });
      await client.sendMessage(dest, { text: caption, mentions });
    }
    if (id) {
      recentlySaved.add(id);
      if (recentlySaved.size > 200) recentlySaved.delete(recentlySaved.values().next().value);
    }
    return true;
  } catch (error) {
    console.log('❌ [VV-EMOJI]:', error?.message || error);
    return false;
  }
}

// The owner reacted to a message with one of the emojis. Saves it if that message is a view-once.
export async function handleViewOnceReaction(client, mek, store) {
  const reaction = mek?.message?.reactionMessage;
  if (!reaction || !isVvEmoji(reaction.text)) return false;
  const targetId = reaction.key?.id;
  console.log(`[VV-EMOJI] reaction ${reaction.text} fromMe=${mek.key?.fromMe === true} target=${targetId || 'none'}`);
  if (mek.key?.fromMe !== true) return false; // only the owner's own reactions count
  if (reaction.key?.fromMe === true) return false; // skip the owner's own messages
  if (!targetId) return false;
  const chat = mek.key.remoteJid || reaction.key?.remoteJid || '';
  const target = await loadStoredMessage(store, chat, targetId);
  const isViewOnce = !!(target && findViewOnceMedia(target.message));
  console.log(`[VV-EMOJI] reaction target found=${!!target} viewOnce=${isViewOnce}`);
  if (!isViewOnce) return false;
  return saveViewOnceSilently(client, {
    message: target.message,
    id: targetId,
    senderJid: reaction.key?.participant || target.key?.participant || target.sender || reaction.key?.remoteJid || chat,
    chat
  });
}
