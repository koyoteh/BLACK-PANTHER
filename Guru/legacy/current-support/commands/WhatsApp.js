import { downloadContentFromMessage, downloadMediaMessage, generateWAMessageFromContent, normalizeMessageContent, proto } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import path from 'path';
import { Jimp } from 'jimp';
import { MESSAGES } from '../france/index.js';
import CONFIG from '../../Guru Tech/config.js';
import { t, translate, translateAIResponse, getUserLang } from '../france/translator.js';
import { deliverViewOnceMediaToOwner, getViewOnceBuffer, getViewOnceMedia, getViewOnceMediaById, getViewOnceSourceMessage } from '../../Guru Tech/viewOnceAutoSave.js';
import { normalizeJid } from '../../Guru Tech/utils/baileysIdentity.js';
import { saveSentViewOnce } from '../../Guru Tech/viewOnceSentStore.js';

const S_WHATSAPP_NET = 's.whatsapp.net';

function getOwnerJid() {
  if (!CONFIG.OWNER_NUMBER) return null
  let ownerNumber = CONFIG.OWNER_NUMBER.toString()
  ownerNumber = ownerNumber.replace(/[+\s]/g, '')
  ownerNumber = ownerNumber.replace(/[^0-9]/g, '')
  return `${ownerNumber}@s.whatsapp.net`
}

async function getBuffer(message, type) {
  const stream = await downloadContentFromMessage(message, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const resizeImage = async (imagePath) => {
  const image = await Jimp.read(imagePath);
  const resized = image.crop({ x: 0, y: 0, w: image.bitmap.width, h: image.bitmap.height }).scaleToFit({ w: 720, h: 720 });
  return {
    img: await resized.getBuffer('image/jpeg'),
    preview: await resized.normalize().getBuffer('image/jpeg')
  };
};

function formatJid(input) {
  const cleaned = input.replace(/[^0-9]/g, '');
  return `${cleaned}@s.whatsapp.net`;
}

function getSenderJid(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

const SENDABLE_VIEW_ONCE_MEDIA = ['imageMessage', 'videoMessage', 'audioMessage'];

function commandContextInfo(msg) {
  const content = msg?.message || {};
  return content.extendedTextMessage?.contextInfo || content.imageMessage?.contextInfo || content.videoMessage?.contextInfo || content.audioMessage?.contextInfo || content.documentMessage?.contextInfo || content.stickerMessage?.contextInfo || null;
}

function findSendableMedia(content) {
  const normalized = normalizeMessageContent(content) || content || {};
  for (const type of SENDABLE_VIEW_ONCE_MEDIA) {
    if (normalized[type]) return { type, media: normalized[type] };
  }
  return null;
}

function extractTextContent(content) {
  const normalized = normalizeMessageContent(content) || content || {};
  return String(normalized.conversation || normalized.extendedTextMessage?.text || normalized.imageMessage?.caption || normalized.videoMessage?.caption || normalized.audioMessage?.caption || '').trim();
}

function mentionJids(text = '') {
  return [...new Set([...String(text).matchAll(/@([0-9]{7,20})/g)].map(match => `${match[1]}@s.whatsapp.net`))];
}

function createOutgoingMediaPayload(type, buffer, media, caption) {
  const contextInfo = mentionJids(caption).length ? { mentionedJid: mentionJids(caption) } : undefined;
  const common = { mimetype: media?.mimetype, viewOnce: true, ...(caption ? { caption } : {}), ...(contextInfo ? { contextInfo } : {}) };
  if (type === 'imageMessage') return { image: buffer, ...common };
  if (type === 'videoMessage') return { video: buffer, ...common };
  return { audio: buffer, mimetype: media?.mimetype || 'audio/mp4', ptt: Boolean(media?.ptt), viewOnce: true, ...(contextInfo ? { contextInfo } : {}) };
}

async function sendViewOnceText(sock, chatId, text) {
  const mentions = mentionJids(text);
  const textMessage = { extendedTextMessage: { text, ...(mentions.length ? { contextInfo: { mentionedJid: mentions } } : {}) } };
  const content = proto.Message.fromObject({ viewOnceMessageV2: { message: textMessage } });
  const generated = generateWAMessageFromContent(chatId, content, {
    userJid: sock.user?.id || sock.user?.lid,
    messageId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  });
  await sock.relayMessage(chatId, generated.message, { messageId: generated.key.id });
  return generated;
}

let isStatusFetching = false;
let fetchInterval;

export const commands = [
  {
    name: "fullpp",
    description: "Set your profile picture without compression (owner only).",
    category: "WhatsApp",
    aliases: ["mypp", "dp"],
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedImage = quoted?.imageMessage;

      if (!quotedImage) {
        const noImageMsg = await t(from, 'whatsapp', 'fullpp.noImage');
        return sock.sendMessage(from, {
          text: noImageMsg
        }, { quoted: msg });
      }

      try {
        console.log("=== FULLPP DEBUG START ===");
        console.log("1. Got quoted image message");

        const buffer = await getBuffer(quotedImage, "image");
        console.log("2. Buffer created, size:", buffer.length, "bytes");

        const mediaPath = path.join(process.cwd(), "temp", `${Date.now()}.jpg`);
        await fs.ensureDir(path.dirname(mediaPath));
        await fs.writeFile(mediaPath, buffer);
        console.log("3. File saved to:", mediaPath);

        const resized = await resizeImage(mediaPath);
        console.log("4. Image resized, output size:", resized.img.length, "bytes");

        console.log("5. About to send query to:", S_WHATSAPP_NET);

        const result = await sock.query({
          tag: "iq",
          attrs: {
            to: S_WHATSAPP_NET,
            type: "set",
            xmlns: "w:profile:picture"
          },
          content: [{
            tag: "picture",
            attrs: { type: "image" },
            content: resized.img
          }]
        });

        console.log("7. Query successful, response:", result);

        const successMsg = await t(from, 'whatsapp', 'fullpp.success');
        await sock.sendMessage(from, {
          text: successMsg
        }, { quoted: msg });
        await fs.unlink(mediaPath);
        console.log("=== FULLPP DEBUG END (SUCCESS) ===");
      } catch (err) {
        console.error("=== FULLPP ERROR ===");
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        console.error("Error object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));

        if (err.response) {
          console.error("Error response:", err.response);
          if (err.response.content) {
            console.error("Error content:", err.response.content);
          }
        }

        if (err.code) {
          console.error("Error code:", err.code);
        }

        const errorMsg = await t(from, 'whatsapp', 'fullpp.error');
        await sock.sendMessage(from, {
          text: errorMsg
        }, { quoted: msg });

        const ownerJid = getOwnerJid();
        if (ownerJid) {
          await sock.sendMessage(ownerJid, {
            text: `Fullpp error in ${from}:\n${err.message}\n\nStack: ${err.stack?.slice(0, 200)}`
          });
        }
      }
    }
  },
  {
    name: 'privacy',
    aliases: [],
    description: 'Displays your current privacy settings.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      try {
        const privacySettings = await sock.fetchPrivacySettings(true);
        const name = sock.user?.name || "User";
        const avatar = await sock.profilePictureUrl(sock.user.id, 'image').catch(() => 'https://telegra.ph/file/b34645ca1e3a34f1b3978.jpg');

        const infoTemplate = await t(from, 'whatsapp', 'privacy.info');
        const caption = infoTemplate
          .replace('{name}', name)
          .replace('{online}', privacySettings.online || 'N/A')
          .replace('{profile}', privacySettings.profile || 'N/A')
          .replace('{last}', privacySettings.last || 'N/A')
          .replace('{readreceipts}', privacySettings.readreceipts || 'N/A')
          .replace('{status}', privacySettings.status || 'N/A')
          .replace('{groupadd}', privacySettings.groupadd || 'N/A')
          .replace('{calladd}', privacySettings.calladd || 'N/A');

        await sock.sendMessage(from, {
          image: { url: avatar },
          caption: caption
        }, { quoted: msg });
      } catch (err) {
        const errorMsg = await t(from, 'whatsapp', 'privacy.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'pin',
    description: 'Pin a chat.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      try {
        await sock.chatModify({ pin: true }, from);
        const successMsg = await t(from, 'whatsapp', 'pin.success');
        await sock.sendMessage(from, { text: successMsg }, { quoted: msg });
      } catch (err) {
        console.error('Pin error:', err);
        const errorMsg = await t(from, 'whatsapp', 'pin.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'unpin',
    description: 'Unpin a chat.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      try {
        await sock.chatModify({ pin: false }, from);
        const successMsg = await t(from, 'whatsapp', 'unpin.success');
        await sock.sendMessage(from, { text: successMsg }, { quoted: msg });
      } catch (err) {
        console.error('Unpin error:', err);
        const errorMsg = await t(from, 'whatsapp', 'unpin.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'star',
    description: 'Star a quoted message.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const fromMe = msg.message?.extendedTextMessage?.contextInfo?.participant === sock.user.id;

      if (!quoted) {
        const noReplyMsg = await t(from, 'whatsapp', 'star.noReply');
        await sock.sendMessage(from, { text: noReplyMsg }, { quoted: msg });
        return;
      }

      try {
        await sock.chatModify({
          star: {
            messages: [{ id: quoted, fromMe }],
            star: true
          }
        }, from);
        const successMsg = await t(from, 'whatsapp', 'star.success');
        await sock.sendMessage(from, { text: successMsg }, { quoted: msg });
      } catch (err) {
        console.error('Star error:', err);
        const errorMsg = await t(from, 'whatsapp', 'star.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'unstar',
    description: 'Unstar a quoted message.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const fromMe = msg.message?.extendedTextMessage?.contextInfo?.participant === sock.user.id;

      if (!quoted) {
        const noReplyMsg = await t(from, 'whatsapp', 'unstar.noReply');
        await sock.sendMessage(from, { text: noReplyMsg }, { quoted: msg });
        return;
      }

      try {
        await sock.chatModify({
          star: {
            messages: [{ id: quoted, fromMe }],
            star: false
          }
        }, from);
        const successMsg = await t(from, 'whatsapp', 'unstar.success');
        await sock.sendMessage(from, { text: successMsg }, { quoted: msg });
      } catch (err) {
        console.error('Unstar error:', err);
        const errorMsg = await t(from, 'whatsapp', 'unstar.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'mydp',
    aliases: [],
    description: 'Updates your profile picture privacy setting.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const options = {
        all: await t(from, 'whatsapp', 'mydp.options.all'),
        contacts: await t(from, 'whatsapp', 'mydp.options.contacts'),
        contact_blacklist: await t(from, 'whatsapp', 'mydp.options.contact_blacklist'),
        none: await t(from, 'whatsapp', 'mydp.options.none')
      };

      const choice = text.toLowerCase();
      if (!choice || !options[choice]) {
        const helpTemplate = await t(from, 'whatsapp', 'mydp.help');
        const optionsList = Object.entries(options).map(([k, v]) => `- *${k}*: ${v}`).join('\n');
        const help = helpTemplate.replace('{options}', optionsList);
        return sock.sendMessage(from, { text: help }, { quoted: msg });
      }

      try {
        await sock.updateProfilePicturePrivacy(choice);
        const successMsg = await t(from, 'whatsapp', 'mydp.success');
        await sock.sendMessage(from, { text: successMsg.replace('{choice}', choice) }, { quoted: msg });
      } catch {
        const errorMsg = await t(from, 'whatsapp', 'mydp.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'mystatus',
    aliases: [],
    description: 'Updates your status privacy setting.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const options = {
        all: await t(from, 'whatsapp', 'mystatus.options.all'),
        contacts: await t(from, 'whatsapp', 'mystatus.options.contacts'),
        contact_blacklist: await t(from, 'whatsapp', 'mystatus.options.contact_blacklist'),
        none: await t(from, 'whatsapp', 'mystatus.options.none')
      };

      const choice = text.toLowerCase();
      if (!choice || !options[choice]) {
        const helpTemplate = await t(from, 'whatsapp', 'mystatus.help');
        const optionsList = Object.entries(options).map(([k, v]) => `- *${k}*: ${v}`).join('\n');
        const help = helpTemplate.replace('{options}', optionsList);
        return sock.sendMessage(from, { text: help }, { quoted: msg });
      }

      try {
        await sock.updateStatusPrivacy(choice);
        const successMsg = await t(from, 'whatsapp', 'mystatus.success');
        await sock.sendMessage(from, { text: successMsg.replace('{choice}', choice) }, { quoted: msg });
      } catch {
        const errorMsg = await t(from, 'whatsapp', 'mystatus.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'groupadd',
    aliases: [],
    description: 'Updates who can add you to groups.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const options = {
        all: await t(from, 'whatsapp', 'groupadd.options.all'),
        contacts: await t(from, 'whatsapp', 'groupadd.options.contacts'),
        contact_blacklist: await t(from, 'whatsapp', 'groupadd.options.contact_blacklist'),
        none: await t(from, 'whatsapp', 'groupadd.options.none')
      };

      const choice = text.toLowerCase();
      if (!choice || !options[choice]) {
        const helpTemplate = await t(from, 'whatsapp', 'groupadd.help');
        const optionsList = Object.entries(options).map(([k, v]) => `- *${k}*: ${v}`).join('\n');
        const help = helpTemplate.replace('{options}', optionsList);
        return sock.sendMessage(from, { text: help }, { quoted: msg });
      }

      try {
        await sock.updateGroupsAddPrivacy(choice);
        const successMsg = await t(from, 'whatsapp', 'groupadd.success');
        await sock.sendMessage(from, { text: successMsg.replace('{choice}', choice) }, { quoted: msg });
      } catch {
        const errorMsg = await t(from, 'whatsapp', 'groupadd.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'lastseen',
    aliases: [],
    description: 'Updates your last seen privacy settings.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const availablePrivacies = {
        all: await t(from, 'whatsapp', 'lastseen.options.all'),
        contacts: await t(from, 'whatsapp', 'lastseen.options.contacts'),
        contact_blacklist: await t(from, 'whatsapp', 'lastseen.options.contact_blacklist'),
        none: await t(from, 'whatsapp', 'lastseen.options.none')
      };

      const priv = text.toLowerCase();
      if (!priv || !availablePrivacies[priv]) {
        const helpTemplate = await t(from, 'whatsapp', 'lastseen.help');
        let helpText = helpTemplate;
        for (const [key, desc] of Object.entries(availablePrivacies)) {
          helpText += `- *${key}*: ${desc}\n`;
        }
        const exampleMsg = await t(from, 'whatsapp', 'lastseen.example');
        helpText += exampleMsg;
        return await sock.sendMessage(from, { text: helpText }, { quoted: msg });
      }

      try {
        await sock.updateLastSeenPrivacy(priv);
        const successMsg = await t(from, 'whatsapp', 'lastseen.success');
        await sock.sendMessage(from, {
          text: successMsg.replace('{priv}', priv).replace('{desc}', availablePrivacies[priv])
        }, { quoted: msg });
      } catch (error) {
        console.error('Failed to update last seen:', error);
        const errorMsg = await t(from, 'whatsapp', 'lastseen.error');
        await sock.sendMessage(from, {
          text: errorMsg
        }, { quoted: msg });
      }
    }
  },
  {
    name: 'myonline',
    aliases: [],
    description: 'Updates your online privacy setting.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      const options = {
        all: await t(from, 'whatsapp', 'myonline.options.all'),
        match_last_seen: await t(from, 'whatsapp', 'myonline.options.match_last_seen')
      };

      const choice = text.toLowerCase();
      if (!choice || !options[choice]) {
        const helpTemplate = await t(from, 'whatsapp', 'myonline.help');
        const optionsList = Object.entries(options).map(([k, v]) => `- *${k}*: ${v}`).join('\n');
        const help = helpTemplate.replace('{options}', optionsList);
        return sock.sendMessage(from, { text: help }, { quoted: msg });
      }

      try {
        await sock.updateOnlinePrivacy(choice);
        const successMsg = await t(from, 'whatsapp', 'myonline.success');
        await sock.sendMessage(from, { text: successMsg.replace('{choice}', choice) }, { quoted: msg });
      } catch (err) {
        const errorMsg = await t(from, 'whatsapp', 'myonline.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'onwa',
    aliases: ["checkid", "checkno"],
    description: 'Checks if a WhatsApp ID exists.',
    category: 'WhatsApp',
    execute: async ({ sock, from, text, msg }) => {
      const rawNumber = text.trim().split(/\s+/)[0];
      if (!rawNumber) {
        const noNumberMsg = await t(from, 'whatsapp', 'onwa.noNumber');
        return await sock.sendMessage(from, { text: noNumberMsg }, { quoted: msg });
      }

      const number = rawNumber.replace(/[^\d]/g, '');
      if (number.length < 10) {
        const invalidMsg = await t(from, 'whatsapp', 'onwa.invalid');
        return await sock.sendMessage(from, { text: invalidMsg }, { quoted: msg });
      }

      const waJid = `${number}@s.whatsapp.net`;
      try {
        const [result] = await sock.onWhatsApp(waJid);
        const existsMsg = await t(from, 'whatsapp', 'onwa.exists');
        const notExistsMsg = await t(from, 'whatsapp', 'onwa.notExists');
        const response = result?.exists ? existsMsg.replace('{number}', rawNumber) : notExistsMsg.replace('{number}', rawNumber);
        await sock.sendMessage(from, { text: response }, { quoted: msg });
      } catch (error) {
        const errorMsg = await t(from, 'whatsapp', 'onwa.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
        console.error('checkIdCommand error:', error);
      }
    }
  },
  {
    name: 'bizprofile',
    aliases: ["bizp"],
    description: 'Fetches business description and category.',
    category: 'WhatsApp',
    execute: async ({ sock, from, text, msg }) => {
      const targetJid = text ? `${text.replace(/[^0-9]/g, '')}@s.whatsapp.net` : from;
      try {
        const profile = await sock.getBusinessProfile(targetJid);
        const resultTemplate = await t(from, 'whatsapp', 'bizprofile.result');
        const textMsg = resultTemplate
          .replace('{description}', profile.description || 'N/A')
          .replace('{category}', profile.category || 'N/A');
        await sock.sendMessage(from, { text: textMsg }, { quoted: msg });
      } catch {
        const errorMsg = await t(from, 'whatsapp', 'bizprofile.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'removedp',
    aliases: [],
    description: 'Removes your profile picture.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      try {
        await sock.removeProfilePicture(from);
        const successMsg = await t(from, 'whatsapp', 'removedp.success');
        await sock.sendMessage(from, { text: successMsg }, { quoted: msg });
      } catch (err) {
        const errorMsg = await t(from, 'whatsapp', 'removedp.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'archive',
    aliases: [],
    description: 'Archives the current chat.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      try {
        const lastMsgInChat = msg;
        await sock.chatModify({ archive: true, lastMessages: [lastMsgInChat] }, from);
        const successMsg = await t(from, 'whatsapp', 'archive.success');
        await sock.sendMessage(from, { text: successMsg }, { quoted: msg });
      } catch (error) {
        console.error('Error archiving chat:', error);
        const errorMsg = await t(from, 'whatsapp', 'archive.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'vv',
    aliases: ['viewonce', 'openphoto', 'openvideo', 'vvphoto', 'vvx'],
    description: 'Reveals supported view-once media.',
    category: 'User',
    execute: async ({ sock, from, text, msg, downloaders = {} }) => {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;
      const viewOnce = getViewOnceMediaById(contextInfo?.stanzaId, quoted, from);
      if (!viewOnce) {
        return sock.sendMessage(from, { text: '❌ Reply to view-once media with .vv.' }, { quoted: msg });
      }

      try {
        const { type, media } = viewOnce;

        // contextInfo.quotedMessage has its decryption key stripped by
        // WhatsApp for view-once content, so getBuffer(quoted...) always
        // fails here — getViewOnceBuffer uses the copy cached when this
        // view-once first arrived instead (see Guru Tech/viewOnceAutoSave.js).
        const messageId = contextInfo?.stanzaId;
        const sourceMessage = getViewOnceSourceMessage(messageId) || {
          key: {
            id: messageId,
            remoteJid: from,
            participant: contextInfo?.participant,
            participantAlt: contextInfo?.participantAlt,
            fromMe: Boolean(contextInfo?.fromMe)
          },
          message: quoted
        };
        const buffer = await getViewOnceBuffer(messageId, type, media, sock, downloaders, sourceMessage);
        if (!buffer) {
          const unavailableMsg = '❌ That view-once has expired or was already opened elsewhere — it can no longer be recovered.';
          await sock.sendMessage(from, { text: unavailableMsg }, { quoted: msg });
          return;
        }

        const captionMsg = await t(from, 'whatsapp', 'vv.caption');
        const kind = type === 'imageMessage' ? 'image' : type === 'videoMessage' ? 'video' : type === 'audioMessage' ? 'audio' : type === 'documentMessage' ? 'document' : 'sticker';
        const sendMsg = kind === 'audio'
          ? { audio: buffer, mimetype: media.mimetype || 'audio/mp4', ptt: Boolean(media.ptt) }
          : kind === 'document'
            ? { document: buffer, mimetype: media.mimetype || 'application/octet-stream', fileName: media.fileName || `view-once-${contextInfo?.stanzaId || 'media'}`, caption: captionMsg }
            : kind === 'sticker'
              ? { sticker: buffer }
              : { [kind]: buffer, caption: captionMsg, mimetype: media.mimetype };

        await sock.sendMessage(from, sendMsg, { quoted: msg });
        await sock.sendMessage(from, { react: { text: '😍', key: msg.key } }).catch(() => {});
      } catch (err) {
        console.error('vv command error:', err);
        await sock.sendMessage(from, { text: '❌ Could not recover that view-once. It may have expired or be unavailable.' }, { quoted: msg });
      }
    }
  },
  {
    name: 'vv2',
    aliases: ["😂","❤️","👍", 'retrieve'],
    description: 'Sends the view once media to the bot owner.',
    category: 'User',
    execute: async ({ sock, from, text, msg, downloaders = {} }) => {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;
      const viewOnce = getViewOnceMediaById(contextInfo?.stanzaId, quoted, from);
      if (!viewOnce) {
        return sock.sendMessage(from, { text: '❌ Reply to view-once media with .vv2.' }, { quoted: msg });
      }

      const ownerJid = getOwnerJid() || normalizeJid(sock.user?.id || sock.user?.lid);
      if (!ownerJid) {
        return sock.sendMessage(from, { text: '❌ The bot owner destination is not configured.' }, { quoted: msg });
      }

      try {
        const saved = await deliverViewOnceMediaToOwner(sock, {
          ...viewOnce,
          id: contextInfo?.stanzaId,
          sourceMessage: getViewOnceSourceMessage(contextInfo?.stanzaId) || { key: { id: contextInfo?.stanzaId, remoteJid: from, participant: contextInfo?.participant, participantAlt: contextInfo?.participantAlt, fromMe: Boolean(contextInfo?.fromMe) }, message: quoted },
          triggerMessage: msg,
          downloaders
        });
        if (!saved) return sock.sendMessage(from, { text: '❌ That view-once may have expired or is no longer available.' }, { quoted: msg });
      } catch (error) {
        console.error('vv2Command error:', error);
        await sock.sendMessage(from, { text: '❌ Could not recover that view-once for the owner.' }, { quoted: msg });
      }
    }
  },
  {
    name: 'vvsave',
    aliases: ['savevv'],
    description: 'Owner-only: recover a replied-to view-once media into the owner inbox with source attribution.',
    category: 'User',
    ownerOnly: true,
    execute: async ({ sock, from, msg, isOwner, downloaders = {} }) => {
      const ownerJid = getOwnerJid() || normalizeJid(sock.user?.id || sock.user?.lid);
      if (!isOwner) return sock.sendMessage(from, { text: '❌ This command is restricted to the bot owner.' }, { quoted: msg });
      const contextInfo = commandContextInfo(msg);
      const id = contextInfo?.stanzaId;
      const viewOnce = getViewOnceMediaById(id, contextInfo?.quotedMessage, from);
      if (!id || !viewOnce) {
        return sock.sendMessage(ownerJid || from, { text: 'Reply directly to a view-once photo, video, audio, document, or sticker with .vvsave.' });
      }

      const isSticker = viewOnce.type === 'stickerMessage';
      try {
        const saved = await deliverViewOnceMediaToOwner(sock, {
          ...viewOnce,
          id,
          sourceMessage: getViewOnceSourceMessage(id) || { key: { id, remoteJid: from, participant: contextInfo.participant, participantAlt: contextInfo.participantAlt, fromMe: Boolean(contextInfo.fromMe) }, message: contextInfo.quotedMessage },
          triggerMessage: msg,
          downloaders
        });
        if (saved) return;

        const error = '❌ That view-once could not be recovered. It may have expired or the original device did not provide its media key.';
        await sock.sendMessage(ownerJid || from, { text: error });
        if (!isSticker) await sock.sendMessage(from, { text: error }, { quoted: msg });
      } catch (error) {
        console.error('[VVSAVE] Recovery failed:', error.message);
        await sock.sendMessage(ownerJid || from, { text: `❌ Could not recover that view-once: ${error.message}` });
        if (!isSticker) await sock.sendMessage(from, { text: '❌ Could not recover that view-once.' }, { quoted: msg });
      }
    }
  },
  {
    name: 'toviewonce',
    aliases: ['tovo', 'toview'],
    description: 'Send text or image, video, and audio as view-once media.',
    category: 'User',
    execute: async ({ sock, from, text, msg, downloaders = {} }) => {
      const contextInfo = commandContextInfo(msg);
      const quotedContent = contextInfo?.quotedMessage;
      const quotedId = contextInfo?.stanzaId;
      let type = null;
      let media = null;
      let sourceMessage = null;
      let sourceMessageId = quotedId || null;
      let buffer = null;

      try {
        const quotedViewOnce = quotedId ? getViewOnceMediaById(quotedId, quotedContent, from) : null;
        const directMedia = findSendableMedia(msg.message);
        const quotedMedia = quotedContent ? findSendableMedia(quotedContent) : null;

        if (quotedViewOnce && SENDABLE_VIEW_ONCE_MEDIA.includes(quotedViewOnce.type)) {
          type = quotedViewOnce.type;
          media = quotedViewOnce.media;
          sourceMessage = getViewOnceSourceMessage(quotedId) || { key: { id: quotedId, remoteJid: from, participant: contextInfo?.participant, participantAlt: contextInfo?.participantAlt, fromMe: Boolean(contextInfo?.fromMe) }, message: quotedContent };
          buffer = await getViewOnceBuffer(quotedId, type, media, sock, downloaders, sourceMessage);
        } else if (directMedia) {
          ({ type, media } = directMedia);
          sourceMessage = msg;
          sourceMessageId = msg.key?.id || null;
          const directViewOnce = getViewOnceMedia(msg.message);
          buffer = directViewOnce
            ? await getViewOnceBuffer(sourceMessageId, type, media, sock, downloaders, sourceMessage)
            : await (downloaders.downloadMediaMessage || downloadMediaMessage)(sourceMessage, 'buffer', {}, { logger: console });
        } else if (quotedMedia) {
          ({ type, media } = quotedMedia);
          sourceMessage = { key: { id: quotedId, remoteJid: from, participant: contextInfo?.participant, fromMe: Boolean(contextInfo?.fromMe) }, message: quotedContent };
          buffer = await (downloaders.downloadMediaMessage || downloadMediaMessage)(sourceMessage, 'buffer', {}, { logger: console });
        }

        if (!type) {
          const textToSend = String(text || extractTextContent(quotedContent) || '').trim();
          if (!textToSend) {
            return sock.sendMessage(from, { text: 'Send `.toviewonce your text` or reply to an image, video, or audio with `.toviewonce`.' }, { quoted: msg });
          }
          await sendViewOnceText(sock, from, textToSend);
          return sock.sendMessage(from, { text: '✅ Sent as a view-once message.' }, { quoted: msg });
        }

        if (!buffer?.length) throw new Error('The source media could not be downloaded.');
        if (buffer.length > 16 * 1024 * 1024) throw new Error('This media exceeds the 16 MB recovery-store limit and was not sent.');
        const caption = String(text || media.caption || '').trim();
        const outgoing = await sock.sendMessage(from, createOutgoingMediaPayload(type, buffer, media, caption), { quoted: msg });
        const saved = saveSentViewOnce({
          chatId: from,
          messageId: outgoing?.key?.id,
          type,
          buffer,
          media: { ...media, caption },
          sourceMessageId
        });
        const notice = saved.stored
          ? '✅ Sent as view-once. Recovery copy kept for up to 3 hours (16 MB total).'
          : '✅ Sent as view-once, but a recovery copy could not be stored.';
        return sock.sendMessage(from, { text: notice }, { quoted: msg });
      } catch (error) {
        console.error('[TOVIEWONCE] Send failed:', error.message);
        return sock.sendMessage(from, { text: `❌ Could not create the view-once message: ${error.message}` }, { quoted: msg });
      }
    }
  },
  {
    name: 'details',
    aliases: [],
    description: 'Displays the full raw quoted message using Baileys structure.',
    category: 'User',
    execute: async ({ sock, from, text, msg }) => {
      const context = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = context?.quotedMessage;

      if (!quoted) {
        const noReplyMsg = await t(from, 'whatsapp', 'details.noReply');
        return sock.sendMessage(from, { text: noReplyMsg }, { quoted: msg });
      }

      try {
        const json = JSON.stringify(quoted, null, 2);
        const parts = json.match(/[\s\S]{1,3500}/g) || [];
        const resultTemplate = await t(from, 'whatsapp', 'details.result');
        for (const part of parts) {
          await sock.sendMessage(from, {
            text: resultTemplate.replace('{part}', part)
          }, { quoted: msg });
        }
      } catch (error) {
        const errorMsg = await t(from, 'whatsapp', 'details.error');
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
      }
    }
  },
  {
    name: 'blocklist',
    aliases: ['blocked'],
    description: 'Shows the list of blocked users.',
    category: 'WhatsApp',
    ownerOnly: true,
    execute: async ({ sock, from, text, msg }) => {
      try {
        const blockedJids = await sock.fetchBlocklist();
        if (!blockedJids || blockedJids.length === 0) {
          const emptyMsg = await t(from, 'whatsapp', 'blocklist.empty');
          return await sock.sendMessage(from, { text: emptyMsg }, { quoted: msg });
        }
        const formattedList = blockedJids.map((b, i) => `${i + 1}. ${b.replace('@s.whatsapp.net', '')}`).join('\n');
        const resultTemplate = await t(from, 'whatsapp', 'blocklist.result');
        await sock.sendMessage(from, {
          text: resultTemplate.replace('{list}', formattedList)
        }, { quoted: msg });
      } catch (error) {
        console.error('Error fetching block list:', error);
        const errorMsg = await t(from, 'whatsapp', 'blocklist.error');
        await sock.sendMessage(from, {
          text: errorMsg
        }, { quoted: msg });
      }
    }
  },
  {
    name: 'vcard',
    aliases: ['card'],
    description: 'Save a contact from a replied message with a custom name.',
    category: 'WhatsApp',
    execute: async ({ sock, from, text, msg }) => {
      const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
      const quotedSender = quotedContext?.participant || quotedContext?.remoteJid;

      if (!quotedSender) {
        const noReplyMsg = await t(from, 'whatsapp', 'vcard.noReply');
        return await sock.sendMessage(from, { text: noReplyMsg }, { quoted: msg });
      }

      if (!text) {
        const noNameMsg = await t(from, 'whatsapp', 'vcard.noName');
        return await sock.sendMessage(from, { text: noNameMsg }, { quoted: msg });
      }

      const name = text;
      const phoneNumber = quotedSender.split('@')[0];
      const vcardString = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${phoneNumber}:${phoneNumber}\nEND:VCARD`;

      await sock.sendMessage(
        from,
        {
          contacts: {
            displayName: name,
            contacts: [{ displayName: name, vcard: vcardString }]
          }
        },
        { quoted: msg }
      );
    }
  },
  {
    name: 'location',
    aliases: ['loc'],
    description: 'Returns Google Maps link from a replied location message.',
    category: 'WhatsApp',
    execute: async ({ sock, from, text, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const locMsg = quoted?.locationMessage;

      if (!locMsg) {
        const noReplyMsg = await t(from, 'whatsapp', 'location.noReply');
        return await sock.sendMessage(from, { text: noReplyMsg }, { quoted: msg });
      }

      const { degreesLatitude, degreesLongitude } = locMsg;
      const mapUrl = `https://maps.google.com/?q=${degreesLatitude},${degreesLongitude}`;

      const resultTemplate = await t(from, 'whatsapp', 'location.result');
      await sock.sendMessage(from, {
        text: resultTemplate.replace('{url}', mapUrl),
        previewType: 0,
        contextInfo: { isForwarded: true }
      }, { quoted: msg });
    }
  }
];
