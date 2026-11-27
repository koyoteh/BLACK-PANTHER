import moment from 'moment-timezone'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import CONFIG from './config.js'
import { isPhoneJid, normalizeJid } from './utils/baileysIdentity.js'
import { chooseStatusReactionEmoji } from './statusReactions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const seenStatusIds = new Set()
const STATUS_VIEW_MAX_RETRIES = 3
const STATUS_VIEW_RETRY_BASE_MS = 1000
const STATUS_LIKE_TIMEOUT_MS = 25000
const STATUS_LIKE_QUEUE_LIMIT = 10
// Optional custom pool; otherwise a 25-emoji pool is used.
const STATUS_LIKE_EMOJIS = (process.env.STATUS_LIKE_EMOJIS || '')
  .split(',').map(e => e.trim()).filter(Boolean)
const statusLikeQueue = []
let statusLikeBusy = false

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function withTimeout(operation, timeoutMs, message) {
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function pumpStatusLikeQueue() {
  if (statusLikeBusy) return
  statusLikeBusy = true
  try {
    while (statusLikeQueue.length) {
      const job = statusLikeQueue.shift()
      // Like Silva-MD, send the reaction only to the poster's phone JID.
      // Including the bot's own JIDs or a LID here can make WhatsApp discard it.
      const recipients = job.phoneJid ? [job.phoneJid] : []
      if (!recipients.length) {
        console.warn(`⚠️ Skipping status reaction without a phone JID: ${job.participant}`)
        continue
      }

      const sendReaction = (text) => withTimeout(
        () => job.sock.sendMessage('status@broadcast', {
          react: { text, key: job.key }
        }, { statusJidList: [...recipients] }),
        STATUS_LIKE_TIMEOUT_MS,
        'status like timed out'
      )

      let liked = false
      for (let attempt = 1; attempt <= 2 && !liked; attempt++) {
        try {
          await sendReaction(job.reactContent)
          liked = true
          console.log(`${job.reactContent} Reacted to status from: ${job.participant}`)
        } catch (error) {
          console.warn(`⚠️ Status reaction attempt ${attempt} failed: ${error.message}`)
          // A "name"/"brand" reaction isn't an official emoji, so some client
          // versions reject it. Don't lose the reaction — retry once with a
          // safe emoji from the pool instead of giving up silently.
          if (job.wasCustom && attempt === 1) {
            job.reactContent = chooseStatusReactionEmoji('random', Math.random, STATUS_LIKE_EMOJIS)
            job.wasCustom = false
          }
          if (attempt < 2) await wait(1500)
        }
      }
    }
  } finally {
    statusLikeBusy = false
  }
}

// Builds the reaction content for a status, following STATUS_REACT_MODE
// (ported from the older BLACK-PANTHER-MD-main's STATUS_REACT_EMOJI):
//   ''       -> random emoji from the pool (STATUS_LIKE_EMOJI setting)
//   'name'   -> the poster's own WhatsApp display name
//   'brand'  -> a branded phrase + the time/date the status was viewed
//   anything else -> used literally as the reaction text
// Returns { reactContent, wasCustom } — wasCustom marks name/brand/literal
// content so the queue can fall back to a safe emoji if WhatsApp rejects it.
function buildReactionContent(pushName) {
  const mode = (CONFIG.STATUS_REACT_MODE || '').trim().toLowerCase()

  if (mode === 'name') {
    return { reactContent: pushName || 'Unknown', wasCustom: true }
  }

  if (mode === 'brand') {
    const brandPhrase = CONFIG.STATUS_BRAND_PHRASE || `👀 Seen by ${CONFIG.BOT_NAME || 'BLACK PANTHER'}`
    const timeStr = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: CONFIG.TZ }).format(new Date())
    const dateStr = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: CONFIG.TZ }).format(new Date())
    return { reactContent: `${brandPhrase} • ${timeStr} ${dateStr}`, wasCustom: true }
  }

  if (mode && mode !== 'random') {
    return { reactContent: CONFIG.STATUS_REACT_MODE, wasCustom: true }
  }

  return {
    reactContent: chooseStatusReactionEmoji(CONFIG.STATUS_LIKE_EMOJI, Math.random, STATUS_LIKE_EMOJIS),
    wasCustom: false
  }
}

function enqueueStatusLike(sock, key, participant, phoneJid, pushName) {
  if (!participant || participant === 'Unknown' || !phoneJid) return
  if (statusLikeQueue.length >= STATUS_LIKE_QUEUE_LIMIT) {
    console.warn('⚠️ Status like queue full; skipping reaction')
    return
  }
  const { reactContent, wasCustom } = buildReactionContent(pushName)
  statusLikeQueue.push({ sock, key, participant, phoneJid, reactContent, wasCustom })
  void pumpStatusLikeQueue()
}

export function logStatus(participant, messageId, pushName, statusType = 'unknown', caption = '') {
  const timestamp = moment().tz(CONFIG.TZ).format('DD/MM/YYYY HH:mm:ss')
  const userPhone = getStatusUserPhone(participant)
  const formattedPhone = formatPhoneNumber(userPhone)

  console.log(`\n[📅 ${timestamp}] [📊 STATUS UPDATE]`)
  console.log(`├─ 👤 From: ${pushName || 'Unknown'} (${formattedPhone})`)
  console.log(`├─ 🔑 JID: ${participant}`)
  console.log(`├─ 🆔 Message ID: ${messageId}`)
  console.log(`├─ 📎 Type: ${statusType}`)
  if (caption) console.log(`├─ 📝 Content: ${caption.substring(0, 100)}`)
  console.log(`├─ 👁️ Auto View: ${CONFIG.AUTO_VIEW === true ? '✅ ON' : '❌ OFF'}`)
  console.log(`├─ ❤️ Auto Like: ${CONFIG.AUTO_LIKE === true ? '✅ ON' : '❌ OFF'}`)
  console.log(`└─ 📖 Auto Read: ${CONFIG.AUTO_READ === true ? '✅ ON' : '❌ OFF'}\n`)
}

export function getStatusUserPhone(statusJid) {
  if (!statusJid) return 'Unknown'
  return statusJid.split('@')[0]
}

function formatPhoneNumber(phone) {
  if (!phone || phone === 'Unknown') return 'Unknown'
  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

export async function processStatusMessage(msg, sock) {
  if (!msg?.key || !msg.message || (msg.key.remoteJid !== 'status@broadcast' && msg.key.remoteJidAlt !== 'status@broadcast')) return
  if (!msg.key.id || msg.message?.protocolMessage) return

  if (msg.key.fromMe === true) return

  const id = msg.key.id
  if (seenStatusIds.has(id)) return
  // Mark as seen immediately (Silva MD): WhatsApp can retransmit the same
  // status 2-3 times within moments, and the view delay below would let
  // duplicates slip through if we only recorded the ID at the end.
  seenStatusIds.add(id)
  if (seenStatusIds.size > 1000) {
    seenStatusIds.delete(seenStatusIds.values().next().value)
  }

  const participantCandidates = [
    msg.key.participantPn,
    msg.key.participantAlt,
    msg.participant,
    msg.key.participant,
    msg.key.remoteJidAlt
  ].map(normalizeJid).filter(jid => jid && jid !== 'status@broadcast')
  const resolvedParticipant = participantCandidates[0]
  const phoneJid = participantCandidates.find(isPhoneJid) || null
  const resolvedKey = {
    ...msg.key,
    remoteJid: 'status@broadcast',
    ...(resolvedParticipant ? { participant: resolvedParticipant } : {})
  }

  const statusPosterJid = resolvedParticipant || (msg.key.remoteJidAlt !== 'status@broadcast' ? msg.key.remoteJidAlt : null) || 'Unknown'
  let statusType = 'unknown'
  let statusCaption = ''

  try {
    if (msg.message?.imageMessage) {
      statusType = 'image'
      statusCaption = msg.message.imageMessage.caption || ''
    } else if (msg.message?.videoMessage) {
      statusType = 'video'
      statusCaption = msg.message.videoMessage.caption || ''
    } else if (msg.message?.conversation) {
      statusType = 'text'
      statusCaption = msg.message.conversation
    } else if (msg.message?.extendedTextMessage) {
      statusType = 'text'
      statusCaption = msg.message.extendedTextMessage.text || ''
    } else if (msg.message?.audioMessage) {
      statusType = 'audio'
    } else if (msg.message?.documentMessage) {
      statusType = 'document'
    }

    // Ported from the older BLACK-PANTHER-MD-main's setupStatusHandlers:
    // wait STATUS_VIEW_DELAY seconds before viewing, if configured.
    if (CONFIG.AUTO_VIEW === true && CONFIG.STATUS_VIEW_DELAY > 0) {
      await wait(CONFIG.STATUS_VIEW_DELAY * 1000)
    }

    // ── Auto view (Silva MD style: independent of auto-react) ───────────
    if (CONFIG.AUTO_VIEW === true) {
      const viewParticipant = msg.key.participant || resolvedParticipant
      if (!viewParticipant) {
        console.warn(`⚠️ Status ${id} arrived without a participant JID; skipping read receipt.`)
      } else {
        let viewError
        for (let attempt = 1; attempt <= STATUS_VIEW_MAX_RETRIES; attempt++) {
          try {
            let viewDone = false
            if (typeof sock.sendReceipt === 'function') {
              try {
                await sock.sendReceipt('status@broadcast', viewParticipant, [id], 'read')
                viewDone = true
              } catch (receiptError) {
                console.warn(`⚠️ sendReceipt failed; trying readMessages: ${receiptError.message}`)
              }
            }
            if (!viewDone) await sock.readMessages([resolvedKey])
            console.log(`✅ Viewed status: ${statusPosterJid.split('@')[0]} [${id}]`)
            viewError = null
            break
          } catch (error) {
            viewError = error
            if (attempt < STATUS_VIEW_MAX_RETRIES) {
              console.warn(`⚠️ Status view attempt ${attempt} failed; retrying: ${error.message}`)
              await wait(STATUS_VIEW_RETRY_BASE_MS * attempt)
            }
          }
        }
        if (viewError) console.error(`❌ Failed to view status ${id} after ${STATUS_VIEW_MAX_RETRIES} attempts: ${viewError.message}`)
      }
    }

    // ── Auto react ───────────────────────────────────────────────────────
    if (CONFIG.AUTO_LIKE === true && statusPosterJid !== 'Unknown') {
      if (!phoneJid) {
        console.warn(`⚠️ Status ${id} has no phone JID; skipping reaction rather than sending an invalid LID recipient.`)
      } else {
        const reactKey = { ...msg.key, remoteJid: 'status@broadcast', participant: phoneJid, fromMe: false }
        delete reactKey.participantPn
        delete reactKey.participantAlt
        setTimeout(() => enqueueStatusLike(sock, reactKey, statusPosterJid, phoneJid, msg.pushName), 2000)
      }
    }

    // Ported from the older BLACK-PANTHER-MD-main's setupStatusHandlers:
    // after viewing, optionally DM the poster a confirmation text too.
    if (
      CONFIG.AUTO_VIEW === true &&
      CONFIG.AUTO_REPLY_STATUS === true &&
      !msg.key.fromMe &&
      statusPosterJid !== 'Unknown'
    ) {
      try {
        await sock.sendMessage(statusPosterJid, { text: CONFIG.STATUS_REPLY_TEXT }, { quoted: resolvedKey ? { key: resolvedKey, message: msg.message } : undefined })
      } catch (error) {
        console.warn(`⚠️ Could not send status auto-reply to ${statusPosterJid}: ${error.message}`)
      }
    }

    let senderName = msg.pushName || 'Unknown'
    if (statusPosterJid !== 'Unknown') {
      try {
        const contact = await sock.onWhatsApp(statusPosterJid)
        if (contact && contact[0]) {
          senderName = contact[0].notify || senderName
        }
      } catch {}
    }

    logStatus(statusPosterJid, id, senderName, statusType, statusCaption)

  } catch (err) {
    console.error('[AUTO-VIEW] Error viewing status:', err)
  }
}

export async function handleStatusReply(msg, sock, senderJid) {
  const tempDir = '/tmp/ultra-guru-temp'
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  try {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const quotedMsg = contextInfo?.quotedMessage
    const commandText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const normalizedCommand = commandText.toLowerCase().trim()
    const statusCommands = ['share', 'send', 'tuma', 'nitumie']
    const isStatusReply = contextInfo?.participant && quotedMsg

    if (statusCommands.includes(normalizedCommand) && isStatusReply) {
      const recipientJid = senderJid
      let sendMsg
      const quotedMsgWrapper = { message: quotedMsg }

      if (quotedMsg.imageMessage) {
        const buffer = await downloadMediaMessage(quotedMsgWrapper, 'buffer', {}, { logger: console })
        const filePath = path.join(tempDir, `${Date.now()}-status-image.jpg`)
        fs.writeFileSync(filePath, buffer)
        sendMsg = { image: { url: filePath }, caption: '📸 Sent by *BLACK PANTHER* !' }
      } else if (quotedMsg.videoMessage) {
        const buffer = await downloadMediaMessage(quotedMsgWrapper, 'buffer', {}, { logger: console })
        const filePath = path.join(tempDir, `${Date.now()}-status-video.mp4`)
        fs.writeFileSync(filePath, buffer)
        sendMsg = { video: { url: filePath }, caption: '🎥 Sent by *BLACK PANTHER* !' }
      } else if (quotedMsg.stickerMessage) {
        const buffer = await downloadMediaMessage(quotedMsgWrapper, 'buffer', {}, { logger: console })
        const filePath = path.join(tempDir, `${Date.now()}-status-sticker.webp`)
        fs.writeFileSync(filePath, buffer)
        sendMsg = { sticker: { url: filePath } }
      } else {
        return false
      }

      await sock.sendMessage(recipientJid, sendMsg, { quoted: msg })

      const fileUrl = sendMsg.image?.url || sendMsg.video?.url || sendMsg.sticker?.url
      if (fileUrl) {
        try { await fs.promises.unlink(fileUrl) } catch {}
      }
      return true
    }
  } catch (err) {
    console.error(`Error in status reply: ${err.message}`)
  }
  return false
}
