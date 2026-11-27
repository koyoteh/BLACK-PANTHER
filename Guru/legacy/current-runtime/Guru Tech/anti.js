import moment from 'moment-timezone'
import CONFIG from './config.js'
import { findGroupParticipant, getPhoneNumber, isLidJid, normalizeJid } from './utils/baileysIdentity.js'

const antiDeleteCache = new Set()
const antiEditCache = new Set()
export const messageStore = new Map()

export function cleanMessageStore() {
  const now = Date.now()
  const tenMinutes = 10 * 60 * 1000
  for (const [key, value] of messageStore.entries()) {
    if (now - value.timestamp > tenMinutes) messageStore.delete(key)
  }
}

function getCachedMessageForChat(messageId, revokeMessage) {
  const cachedMessage = messageStore.get(messageId)
  if (!cachedMessage) return null
  const cachedChats = [cachedMessage.key?.remoteJid, cachedMessage.key?.remoteJidAlt].map(normalizeJid).filter(Boolean)
  const revokeChats = [revokeMessage?.key?.remoteJid, revokeMessage?.key?.remoteJidAlt].map(normalizeJid).filter(Boolean)
  return cachedChats.some(jid => revokeChats.includes(jid)) ? cachedMessage : null
}

function getPhoneFromJid(jid, lidToPhoneMap) {
  const cleanJid = normalizeJid(jid)
  if (!cleanJid) return null
  if (isLidJid(cleanJid)) return lidToPhoneMap?.get(cleanJid) || null
  return getPhoneNumber(cleanJid)
}

function getUserNumber(jid, lidToPhoneMap) {
  if (!jid) return 'Unknown'
  const cleanJid = normalizeJid(jid)
  const phone = getPhoneFromJid(cleanJid, lidToPhoneMap)
  if (phone) return phone
  if (isLidJid(cleanJid)) return 'Unknown'
  return cleanJid?.split('@')[0] || 'Unknown'
}

async function lookupWhatsAppContact(sock, jid, lidToPhoneMap) {
  const phone = getPhoneFromJid(jid, lidToPhoneMap)
  if (!phone) return null
  const contacts = await sock.onWhatsApp(`${phone}@s.whatsapp.net`)
  return contacts?.[0] || null
}

function formatPhoneNumber(phone) {
  if (!phone || phone === 'Unknown') return 'Unknown'
  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

function logAntiDelete(chatName, deletedBy, phone, time, originalMsg, senderName, senderNumber) {
  const timestamp = moment().tz(CONFIG.TZ).format('DD/MM/YYYY HH:mm:ss')
  console.log(`\n[📅 ${timestamp}] [🗑️ ANTI-DELETE]`)
  console.log(`├─ 💬 Chat: ${chatName}`)
  console.log(`├─ 👤 Deleted By: ${deletedBy} (${formatPhoneNumber(senderNumber)})`)
  if (senderName && senderName !== deletedBy) console.log(`├─ 📛 Original Sender: ${senderName} (${formatPhoneNumber(phone)})`)
  console.log(`├─ 🗓️ Time: ${time}`)
  console.log(`└─ 📱 Original: "${originalMsg.substring(0, 50)}${originalMsg.length > 50 ? '...' : ''}"\n`)
}

function logAntiEdit(chatName, editedBy, phone, time, originalMsg, editedMsg, senderName, senderNumber) {
  const timestamp = moment().tz(CONFIG.TZ).format('DD/MM/YYYY HH:mm:ss')
  console.log(`\n[📅 ${timestamp}] [✏️ ANTI-EDIT]`)
  console.log(`├─ 💬 Chat: ${chatName}`)
  console.log(`├─ 👤 Edited By: ${editedBy} (${formatPhoneNumber(senderNumber)})`)
  if (senderName && senderName !== editedBy) console.log(`├─ 📛 Original Sender: ${senderName} (${formatPhoneNumber(phone)})`)
  console.log(`├─ 🗓️ Time: ${time}`)
  console.log(`├─ 📱 Original: "${originalMsg.substring(0, 50)}${originalMsg.length > 50 ? '...' : ''}"`)
  console.log(`└─ 📝 Edited to: "${editedMsg.substring(0, 50)}${editedMsg.length > 50 ? '...' : ''}"\n`)
}

export async function handleDeletedMessage(msg, sock, getRealSenderJid, getOwnerJid, lidToPhoneMap) {
  const protocolMsg = msg.message.protocolMessage
  if (!protocolMsg || protocolMsg.type !== 0) return
  const deletedMsgKey = protocolMsg.key
  const deletedMsgId = deletedMsgKey.id
  const deleterJid = getRealSenderJid(msg)
  const from = msg.key.remoteJid

  const cacheKey = `${from}_${deletedMsgId}_${deleterJid}_delete`
  if (antiDeleteCache.has(cacheKey)) return
  antiDeleteCache.add(cacheKey)
  setTimeout(() => antiDeleteCache.delete(cacheKey), 5000)

  const deletedMsg = getCachedMessageForChat(deletedMsgId, msg)
  if (!deletedMsg) {
    console.warn(`[ANTI-DELETE] Revoke received, but original ${deletedMsgId || 'unknown-id'} is not in this chat's recent-message cache.`)
    return
  }

  const deleterNumber = getUserNumber(deleterJid, lidToPhoneMap)
  const formattedDeleterPhone = formatPhoneNumber(deleterNumber)
  let deleterName = deleterNumber
  let deleterMention = deleterJid

  try {
    const deleterContact = await lookupWhatsAppContact(sock, deleterJid, lidToPhoneMap)
    if (deleterContact) {
      deleterName = deleterContact.name || deleterContact.pushname || deleterNumber
      if (!isLidJid(deleterJid)) deleterMention = deleterContact.jid || deleterJid
    }
  } catch { deleterName = deleterNumber }

  let chatName = ''
  let chatType = 'Personal'
  let chatMention = null
  const date = moment().tz(CONFIG.TZ).format('DD/MM/YYYY')
  const time = moment().tz(CONFIG.TZ).format('HH:mm:ss')

  if (from.endsWith('@g.us')) {
    try {
      const metadata = await sock.groupMetadata(from)
      const deleterParticipant = findGroupParticipant(metadata.participants, deleterJid)
      deleterName = deleterParticipant?.name || deleterParticipant?.notify || deleterName
      chatName = metadata.subject
      chatType = 'Group'
      chatMention = from
    } catch { chatName = 'Unknown Group' }
  } else if (from.endsWith('status@broadcast')) {
    chatName = 'Status Update'
    chatType = 'Status'
    deleterName = msg.pushName || deleterName
  } else {
    try {
      const chatContact = await lookupWhatsAppContact(sock, from, lidToPhoneMap)
      if (chatContact) {
        chatName = chatContact.name || chatContact.pushname || deleterName
      } else {
        chatName = deleterName
      }
    } catch {
      chatName = deleterName
    }
  }

  const originalMsgBody =
    deletedMsg.message?.conversation ||
    deletedMsg.message?.extendedTextMessage?.text ||
    deletedMsg.message?.imageMessage?.caption ||
    deletedMsg.message?.videoMessage?.caption ||
    deletedMsg.message?.stickerMessage?.caption ||
    deletedMsg.message?.documentMessage?.caption ||
    '[Media Message]'

  const ownerJid = normalizeJid(getOwnerJid()) || normalizeJid(sock.user?.id) || normalizeJid(sock.user?.lid)
  if (!ownerJid) {
    console.error('[ANTI-DELETE] Cannot forward deleted message: no configured owner or linked-account JID is available.')
    return
  }
  if (ownerJid) {
    const mentions = [deleterMention]
    if (chatMention) mentions.push(chatMention)

    await sock.sendMessage(ownerJid, {
      text: `*⚡ BLACK PANTHER ANTI-DELETE ⚡*\n\n*💬 Chat:* @${deleterName.replace(/\s/g, '')} ${chatType === 'Group' ? `(${chatName})` : ''}\n*📌 Type:* ${chatType}\n*👤 Deleted By:* @${deleterName.replace(/\s/g, '')}\n*📞 Number:* ${formattedDeleterPhone}\n*📅 Date:* ${date}\n*⏰ Time:* ${time}\n\n*🗑️ The following message was deleted:*`,
      mentions: mentions
    })
    await sock.sendMessage(ownerJid, { forward: deletedMsg })
  }
  logAntiDelete(chatName, deleterName, '', time, originalMsgBody, '', deleterNumber)
  messageStore.delete(deletedMsgId)
}

export async function handleEditedMessage(msg, sock, getRealSenderJid, getOwnerJid, lidToPhoneMap) {
  const protocolMsg = msg.message.protocolMessage
  if (!protocolMsg || protocolMsg.type !== 14) return
  if (!CONFIG.ANTIEDIT) return

  const editedMsgKey = protocolMsg.key
  const editedMsgId = editedMsgKey.id
  const editorJid = getRealSenderJid(msg)
  const from = msg.key.remoteJid
  const selfJids = new Set([sock.user?.id, sock.user?.lid].map(normalizeJid).filter(Boolean))
  if (selfJids.has(normalizeJid(editorJid))) return

  const cacheKey = `${from}_${editedMsgId}_${editorJid}_edit`
  if (antiEditCache.has(cacheKey)) return
  antiEditCache.add(cacheKey)
  setTimeout(() => antiEditCache.delete(cacheKey), 5000)

  const originalMsg = getCachedMessageForChat(editedMsgId, msg)
  if (!originalMsg) return

  const editorNumber = getUserNumber(editorJid, lidToPhoneMap)
  const formattedEditorPhone = formatPhoneNumber(editorNumber)
  let editorName = editorNumber
  let editorMention = editorJid

  try {
    const editorContact = await lookupWhatsAppContact(sock, editorJid, lidToPhoneMap)
    if (editorContact) {
      editorName = editorContact.name || editorContact.pushname || editorNumber
      if (!isLidJid(editorJid)) editorMention = editorContact.jid || editorJid
    }
  } catch { editorName = editorNumber }

  let chatName = ''
  let chatType = 'Personal'
  let chatMention = null
  const date = moment().tz(CONFIG.TZ).format('DD/MM/YYYY')
  const time = moment().tz(CONFIG.TZ).format('HH:mm:ss')

  if (from.endsWith('@g.us')) {
    try {
      const metadata = await sock.groupMetadata(from)
      const editorParticipant = findGroupParticipant(metadata.participants, editorJid)
      editorName = editorParticipant?.name || editorParticipant?.notify || editorName
      chatName = metadata.subject
      chatType = 'Group'
      chatMention = from
    } catch { chatName = 'Unknown Group' }
  } else if (from.endsWith('status@broadcast')) {
    chatName = 'Status Update'
    chatType = 'Status'
    editorName = msg.pushName || editorName
  } else {
    try {
      const chatContact = await lookupWhatsAppContact(sock, from, lidToPhoneMap)
      if (chatContact) {
        chatName = chatContact.name || chatContact.pushname || editorName
      } else {
        chatName = editorName
      }
    } catch {
      chatName = editorName
    }
  }

  const originalMsgBody =
    originalMsg.message?.conversation ||
    originalMsg.message?.extendedTextMessage?.text ||
    originalMsg.message?.imageMessage?.caption ||
    originalMsg.message?.videoMessage?.caption ||
    originalMsg.message?.stickerMessage?.caption ||
    originalMsg.message?.documentMessage?.caption ||
    '[Media Message]'
  const editedMsgBody =
    protocolMsg.editedMessage?.conversation ||
    protocolMsg.editedMessage?.extendedTextMessage?.text ||
    '[Edited Message]'

  const ownerJid = getOwnerJid()
  if (ownerJid) {
    const mentions = [editorMention]
    if (chatMention) mentions.push(chatMention)

    await sock.sendMessage(ownerJid, {
      text: `*⚡ BLACK PANTHER ANTI-EDIT ⚡*\n\n*💬 Chat:* ${chatName} ${chatType === 'Group' ? `(${chatName})` : ''}\n*📌 Type:* ${chatType}\n*👤 Edited By:* @${editorName.replace(/\s/g, '')}\n*📞 Number:* ${formattedEditorPhone}\n*📅 Date:* ${date}\n*⏰ Time:* ${time}\n\n*📱 Original Message:*\n"${originalMsgBody}"\n\n*✏️ Edited to:*\n"${editedMsgBody}"`,
      mentions: mentions
    })
  }
  logAntiEdit(chatName, editorName, '', time, originalMsgBody, editedMsgBody, '', editorNumber)
  messageStore.set(editedMsgId, { ...msg, timestamp: Date.now() })
}
