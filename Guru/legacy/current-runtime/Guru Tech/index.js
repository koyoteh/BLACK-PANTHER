import { createRequire } from 'module';
globalThis.require = createRequire(import.meta.url);

import Pino from 'pino'
import fs from 'fs'
import path from 'path'
import express from 'express'
import { Boom } from '@hapi/boom'
import { fileURLToPath } from 'url'
import moment from 'moment-timezone'
import { loadSudoList } from './utils/sudoStore.js'
import CONFIG from './config.js'
import { findGroupParticipant, getLidJid, getMessageJidAliases, getPhoneNumber as extractPhoneNumber, isLidJid, isPhoneJid, normalizeJid } from './utils/baileysIdentity.js'
import { applyRuntimeSettings } from './runtimeSettings.js'
import { bindSettingsToSession, closePersistentSettings, initializePersistentSettings } from './persistentSettings.js'
import { handleGroupSecurityMessage } from './groupSecurity.js'
import { getCommandPermissionFailure } from './commandPermissions.js'
import { createMessageDiagnostics, recordMessageUpsert } from './messageDiagnostics.js'
import { handleMenuCategoryReply } from '../Guru/commands/Menu.js'
import {
  seenStatusIds,
  processStatusMessage,
  handleStatusReply,
  logStatus
} from './bc.js'
import {
  default as makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  useMultiFileAuthState,
  downloadMediaMessage
} from '@whiskeysockets/baileys'
import { handleDeletedMessage, handleEditedMessage, messageStore, cleanMessageStore } from './anti.js'
import { installViewOnceAutoSave } from './viewOnceAutoSave.js'

await initializePersistentSettings()
await bindSettingsToSession(process.env.SESSION_ID || process.env.SESSION)
applyRuntimeSettings(CONFIG)
global.ALLOWED_USERS = loadSudoList()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let OWNER_NUMBER = null
let OWNER_LIDS = []
let OWNER_FULL_JID = null

const processedMessages = new Set()
const MESSAGE_TIMEOUT = 3000
const executingCommands = new Set()
const presenceTimers = new Map()

const phoneToLidMap = new Map()
const lidToPhoneMap = new Map()

function getPhoneFromJid(jid) {
  const cleanJid = normalizeJid(jid)
  if (!cleanJid) return null
  if (isLidJid(cleanJid)) return lidToPhoneMap.get(cleanJid) || null
  return extractPhoneNumber(cleanJid)
}

function getLidFromJid(jid) {
  return getLidJid(jid)
}

function getCleanJid(jid) {
  return normalizeJid(jid)
}

function rememberJidPair(first, second) {
  const values = [first, second].map(getCleanJid).filter(Boolean)
  const phoneJid = values.find(isPhoneJid)
  const lidJid = values.find(isLidJid)
  const phone = phoneJid && extractPhoneNumber(phoneJid)
  if (!phone || !lidJid) return
  phoneToLidMap.set(phone, lidJid)
  lidToPhoneMap.set(lidJid, phone)
}

function getHostingProvider() {
  if (process.env.DYNO || process.env.HEROKU_APP_NAME) return 'Heroku'
  if (process.env.RENDER_SERVICE_ID || process.env.RENDER) return 'Render'
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return 'Railway'
  if (process.env.KOYEB_SERVICE_ID) return 'Koyeb'
  return CONFIG.HOSTING_PROVIDER || 'Unknown host'
}

function getRealSenderJid(msg) {
  return getRealSenderJids(msg)[0] || null
}

function getRealSenderJids(msg) {
  const key = msg?.key || {}
  rememberJidPair(key.remoteJid, key.remoteJidAlt)
  rememberJidPair(key.participant, key.participantAlt)
  rememberJidPair(sock?.user?.id, sock?.user?.lid)
  return getMessageJidAliases(msg, { selfJids: [sock?.user?.id, sock?.user?.lid] })
}

function getSenderPhone(jid) {
  if (!jid) return 'Unknown'
  const phone = getPhoneFromJid(jid)
  if (phone) return phone
  const cleanJid = getCleanJid(jid)
  if (isLidJid(cleanJid)) return 'Unknown'
  return cleanJid?.split('@')[0] || 'Unknown'
}

function formatPhoneNumber(phone) {
  if (!phone || phone === 'Unknown') return 'Unknown'
  const cleaned = phone.replace(/[^\d+]/g, '')
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

function isDevUser(jid) {
  if (!jid) return false

  const cleanJid = getCleanJid(jid)
  const phone = getPhoneFromJid(cleanJid)
  const lid = getLidFromJid(cleanJid)

  const configuredOwnerNumber = (CONFIG.OWNER_NUMBER || '').replace(/\D/g, '')
  if (phone && (phone === configuredOwnerNumber || phone === OWNER_NUMBER)) return true
  if (lid && OWNER_LIDS.includes(lid)) return true

  const mappedPhone = lid && lidToPhoneMap.get(lid)
  return Boolean(mappedPhone && (mappedPhone === configuredOwnerNumber || mappedPhone === OWNER_NUMBER))
}

function formatLogMessage(type, chatJid, senderJid, senderName, body, isGroup = false, groupName = '', messageId = '', messageType = '') {
  const timestamp = moment().tz(CONFIG.TZ).format('DD/MM/YYYY HH:mm:ss')
  const logType = isGroup ? '👥 GROUP' : '👤 PRIVATE'
  console.log(`\n[📅 ${timestamp}] [${logType}]`)
  console.log(`├─ 💬 Chat: ${groupName || senderName} (${chatJid})`)
  const senderPhone = getSenderPhone(senderJid)
  const senderLid = getLidFromJid(senderJid)
  console.log(`├─ 👤 Sender: ${senderName} (+${senderPhone})${senderLid ? ` [LID: ${senderLid}]` : ''}`)
  if (body) console.log(`├─ 📝 Message: ${body}`)
  console.log(`└─ 🔍 Details: ${messageType} | ${isGroup ? 'Group' : 'Private'} | ${messageId}\n`)
}

function logError(context, command, user, error) {
  const timestamp = moment().tz(CONFIG.TZ).format('DD/MM/YYYY HH:mm:ss')
  console.log(`\n[📅 ${timestamp}] [❌ ERROR]`)
  console.log(`├─ 🔧 Context: ${context}`)
  if (command) console.log(`├─ 🎯 Command: ${command}`)
  if (user) console.log(`├─ 👤 User: ${user}`)
  console.log(`└─ 💬 Error: ${error}\n`)
}

function logConnection(event, details = {}) {
  const timestamp = moment().tz(CONFIG.TZ).format('DD/MM/YYYY HH:mm:ss')
  console.log(`\n[📅 ${timestamp}] [${event === 'connected' ? '✅ CONNECTED' : '🔄 RECONNECTING'}]`)
  if (event === 'connected') {
    console.log(`├─ 🤖 Bot: ${CONFIG.BOT_NAME} v${CONFIG.BOT_VERSION}`)
    if (details.number) console.log(`├─ 📱 Number: ${details.number}`)
    if (details.lid) console.log(`├─ 🔑 LID: ${details.lid}`)
    if (details.mode) console.log(`├─ ⚙️ Mode: ${details.mode}`)
    if (details.commands) console.log(`└─ 📊 Commands: ${details.commands} loaded\n`)
  } else {
    console.log(`├─ 🔌 Reason: ${details.reason || 'Unknown'}`)
    if (details.attempt) console.log(`├─ 🔢 Attempt: ${details.attempt}`)
    if (details.delay) console.log(`└─ ⏳ Delay: ${details.delay} seconds\n`)
  }
}

function logCommand(senderName, senderNumber, command, location, groupName = '') {
  const timestamp = moment().tz(CONFIG.TZ).format('DD/MM/YYYY HH:mm:ss')
  console.log(`\n[📅 ${timestamp}] [⚡ COMMAND]`)
  if (groupName) console.log(`├─ 💬 Group: ${groupName}`)
  const displayNumber = senderNumber === 'Unknown' ? 'Unknown' : formatPhoneNumber(senderNumber)
  console.log(`├─ 👤 Executed By: ${senderName} (${displayNumber})`)
  console.log(`├─ 🎯 Command: ${command}`)
  console.log(`└─ 📍 Location: ${location}\n`)
}

const AUTH_DIR = path.join(__dirname, 'auth')
const CREDS_PATH = path.join(AUTH_DIR, 'creds.json')
fs.mkdirSync(AUTH_DIR, { recursive: true })
if (!fs.existsSync(CREDS_PATH)) {
  if (!CONFIG.SESSION) {
    console.error('No WhatsApp session found. Set SESSION or SESSION_ID (both formats are supported).')
    process.exit(1)
  }
  const credsBuffer = Buffer.from(CONFIG.SESSION, 'base64')
  try {
    JSON.parse(credsBuffer.toString('utf8'))
  } catch {
    console.error('WhatsApp session is not valid base64-encoded credentials JSON.')
    process.exit(1)
  }
  fs.writeFileSync(CREDS_PATH, credsBuffer, { mode: 0o600 })
}
if (CONFIG.SESSION) console.log(`[AUTH] Session format accepted: ${CONFIG.SESSION_FORMAT}`)

const commandsDir = path.join(__dirname, '..', 'Guru', 'commands')
const commands = new Map()
const commandAliases = new Map()

for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
  const mod = await import(path.join(commandsDir, file))
  if (!mod.commands) continue
  for (const c of mod.commands) {
    commands.set(c.name.toLowerCase(), c)
    if (Array.isArray(c.aliases)) {
      for (const a of c.aliases) commandAliases.set(a.toLowerCase(), c.name.toLowerCase())
    }
  }
}

function isAllowedUser(msg, sockUserJid) {
  const mode = String(CONFIG.MODE || 'private').toLowerCase()
  if (mode === 'public' || mode === 'group') return true

  if (msg.key?.fromMe) return true
  const senderJids = getRealSenderJids(msg).map(getCleanJid).filter(Boolean)
  const selfJids = [sockUserJid, sock?.user?.lid].map(getCleanJid).filter(Boolean)
  if (senderJids.some(jid => selfJids.includes(jid))) return true
  if (senderJids.some(isDevUser)) return true

  for (const senderJid of senderJids) {
    const senderPhone = getPhoneFromJid(senderJid)
    const senderLid = getLidFromJid(senderJid)
    if (senderPhone && senderPhone === OWNER_NUMBER) return true
    if (senderLid && OWNER_LIDS.includes(senderLid)) return true
    if (global.ALLOWED_USERS && (
      (senderPhone && global.ALLOWED_USERS.has(senderPhone)) ||
      (senderLid && global.ALLOWED_USERS.has(senderLid)) ||
      global.ALLOWED_USERS.has(senderJid)
    )) return true
  }

  return false
}

function isAllowedCaller(callerJid) {
  if (!callerJid) return false
  const cleanCallerJid = getCleanJid(callerJid)
  if (isDevUser(cleanCallerJid)) return true

  const callerPhone = getPhoneFromJid(cleanCallerJid)
  if (callerPhone && callerPhone === OWNER_NUMBER) return true

  const callerLid = getLidFromJid(cleanCallerJid)
  if (callerLid && OWNER_LIDS.includes(callerLid)) return true

  return false
}

const app = express()
app.get('/', (_, r) => r.send(`${CONFIG.BOT_NAME} is Running`))
app.listen(CONFIG.PORT)

let sock = null
const messageDiagnostics = createMessageDiagnostics()
app.get('/health', (_, res) => {
  const connected = Boolean(sock?.user?.id || sock?.user?.lid)
  res.status(connected ? 200 : 503).json({
    bot: CONFIG.BOT_NAME,
    whatsapp: connected ? 'connected' : 'disconnected',
    inbound: { ...messageDiagnostics }
  })
})
const groupCache = new Map()
const readMessagesQueue = new Set()

async function autoReadMessages(keys) {
  if (!CONFIG.AUTO_READ) return

  try {
    const messagesToRead = keys.filter(key => !readMessagesQueue.has(key.id))
    if (messagesToRead.length === 0) return

    for (const key of messagesToRead) {
      readMessagesQueue.add(key.id)
    }

    setTimeout(async () => {
      try {
        await sock.readMessages(messagesToRead)
        for (const key of messagesToRead) {
          readMessagesQueue.delete(key.id)
        }
      } catch (error) {
        logError('Auto Read Messages', null, null, error.message)
      }
    }, 1000)
  } catch (error) {
    logError('Auto Read Messages', null, null, error.message)
  }
}

async function updatePresence(jid, presenceType) {
  if (!sock || !jid) return

  try {
    await sock.sendPresenceUpdate(presenceType, jid)
  } catch (error) {
  }
}

function shouldShowPresence(isGroup) {
  if (CONFIG.ALWAYS_ONLINE) return false
  if (isGroup) {
    return CONFIG.GRP_PRESENCE && CONFIG.GRP_PRESENCE !== '' && CONFIG.GRP_PRESENCE !== 'none'
  } else {
    return CONFIG.DM_PRESENCE && CONFIG.DM_PRESENCE !== '' && CONFIG.DM_PRESENCE !== 'none'
  }
}

function getPresenceType(isGroup) {
  if (isGroup) {
    const presence = CONFIG.GRP_PRESENCE?.toLowerCase()
    if (presence === 'typing') return 'composing'
    if (presence === 'recording') return 'recording'
    if (presence === 'online') return 'available'
  } else {
    const presence = CONFIG.DM_PRESENCE?.toLowerCase()
    if (presence === 'typing') return 'composing'
    if (presence === 'recording') return 'recording'
    if (presence === 'online') return 'available'
  }
  return null
}

async function setChatPresence(jid, isGroup) {
  if (!shouldShowPresence(isGroup)) return

  if (presenceTimers.has(jid)) {
    clearTimeout(presenceTimers.get(jid))
  }

  const presenceType = getPresenceType(isGroup)
  if (!presenceType) return

  await updatePresence(jid, presenceType)

  const timer = setTimeout(async () => {
    await updatePresence(jid, 'paused')
    presenceTimers.delete(jid)
  }, 5000)

  presenceTimers.set(jid, timer)
}

async function clearChatPresence(jid) {
  if (CONFIG.ALWAYS_ONLINE) return
  if (presenceTimers.has(jid)) {
    clearTimeout(presenceTimers.get(jid))
    presenceTimers.delete(jid)
  }
  await updatePresence(jid, 'paused')
}

async function fetchGroupMetadata(groupJid) {
  if (groupCache.has(groupJid)) return groupCache.get(groupJid)
  try {
    const metadata = await sock.groupMetadata(groupJid)
    groupCache.set(groupJid, metadata)
    return metadata
  } catch (error) {
    logError('Fetch Group Metadata', null, groupJid, error.message)
    return null
  }
}

function getOwnerJid() {
  if (!CONFIG.OWNER_NUMBER) return null
  let ownerNumber = CONFIG.OWNER_NUMBER.toString()
  ownerNumber = ownerNumber.replace(/[+\s]/g, '')
  ownerNumber = ownerNumber.replace(/[^0-9]/g, '')
  return `${ownerNumber}@s.whatsapp.net`
}

function escapeVCardField(value) {
  return String(value || '').replace(/[\r\n\\,:;]/g, ' ').trim()
}

// Fetched once and cached for the life of the process — embedding this in
// every outgoing message's quoted vCard means we must never re-fetch it per
// message. Resolves to null (no PHOTO field, falls back to a default avatar)
// if CONFIG.BOT_PIC can't be fetched, so a bad image never breaks sending.
let vCardPhotoPromise = null
function getVCardPhotoBase64() {
  if (!vCardPhotoPromise) {
    vCardPhotoPromise = (async () => {
      try {
        const url = CONFIG.BOT_PIC
        if (!url) return null
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        // vCard PHOTO lines must be a single unbroken line of base64.
        return buf.toString('base64')
      } catch (err) {
        console.error('[BRAND] Could not fetch BOT_PIC for the vCard tag, using default avatar:', err.message)
        return null
      }
    })()
  }
  return vCardPhotoPromise
}

function installBrandedResponseContext(targetSock) {
  const sendMessage = targetSock.sendMessage.bind(targetSock)
  getVCardPhotoBase64() // kick the fetch off now, not on the first reply
  targetSock.sendMessage = async (jid, content, options) => {
    if (!content || typeof content !== 'object' || Buffer.isBuffer(content) || Array.isArray(content)) {
      return sendMessage(jid, content, options)
    }
    if (['react', 'delete', 'poll', 'groupInvite'].some(type => Object.hasOwn(content, type))) {
      return sendMessage(jid, content, options)
    }

    // This exact shape (fromMe:false, participant "0@s.whatsapp.net",
    // remoteJid "status@broadcast") is what makes WhatsApp render the quoted
    // preview as "Status · ✓ WhatsApp" with the displayName below it as a
    // verified-looking contact badge. Changing any of these three fields
    // breaks that rendering, so they're fixed rather than derived from config.
    const verifiedLabel = escapeVCardField(CONFIG.VERIFIED_LABEL || '❯❯ Mr. Guru') || '❯❯ Mr. Guru'
    const photoB64 = await getVCardPhotoBase64()
    const photoLine = photoB64 ? `\nPHOTO;ENCODING=b;TYPE=JPEG:${photoB64}` : ''
    const brandedContact = {
      key: {
        fromMe: false,
        participant: '0@s.whatsapp.net',
        remoteJid: 'status@broadcast'
      },
      message: {
        contactMessage: {
          displayName: verifiedLabel,
          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:Meta\nORG:META AI;\nTEL;type=CELL;type=VOICE;waid=254105521300:+254105521300${photoLine}\nEND:VCARD`
        }
      }
    }
    const messageOptions = options && typeof options === 'object' && !Array.isArray(options)
      ? options
      : {}

    const messageContext = content.contextInfo && typeof content.contextInfo === 'object'
      ? content.contextInfo
      : {}
    const supportedTextFields = new Set(['text', 'contextInfo', 'mentions'])
    const hasOnlyTextContent = Object.keys(content).every(field => supportedTextFields.has(field))

    if (CONFIG.CHANNEL_URL && typeof content.text === 'string' && hasOnlyTextContent) {
      const channelButtonContent = {
        ...content,
        footer: CONFIG.BOT_NAME || 'BLACK PANTHER',
        templateButtons: [{
          index: 1,
          urlButton: {
            displayText: 'View Channel',
            url: CONFIG.CHANNEL_URL
          }
        }]
      }
      try {
        return await sendMessage(jid, channelButtonContent, { ...messageOptions, quoted: brandedContact })
      } catch (ctaError) {
        console.warn('[CHANNEL CTA] Button send failed; falling back to text:', ctaError?.message || ctaError)
        return sendMessage(jid, content, { ...messageOptions, quoted: brandedContact })
      }
    }

    return sendMessage(jid, content, { ...messageOptions, quoted: brandedContact })
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  AUTO-JOIN GROUP
//
//  CONFIG.AUTO_JOIN_GROUP_LINK (set from .env) is a chat.whatsapp.com invite
//  link or bare code. On every connect, the bot accepts that invite — a
//  harmless no-op if it's already a member. If it's later removed from that
//  specific group while running, it waits a bit and tries to rejoin using
//  the same link, up to a small number of times so a deliberate removal by
//  an admin doesn't turn into an endless join/kick loop.
// ════════════════════════════════════════════════════════════════════════════
let autoJoinGroupJid = null       // resolved once we successfully look up the invite
let autoJoinAttemptedThisRun = false
let autoJoinRejoinCount = 0
const AUTO_JOIN_MAX_REJOINS = 5
const AUTO_JOIN_REJOIN_DELAY_MS = 15000

function extractInviteCode(link) {
  const raw = String(link || '').trim()
  if (!raw) return null
  const m = raw.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]+)/)
  return m ? m[1] : raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

async function joinAutoJoinGroup(targetSock, { isRejoin = false } = {}) {
  const code = extractInviteCode(CONFIG.AUTO_JOIN_GROUP_LINK)
  if (!code) return

  try {
    if (!autoJoinGroupJid) {
      const info = await targetSock.groupGetInviteInfo(code)
      if (info?.id) autoJoinGroupJid = info.id
    }
  } catch (err) {
    // Link may be expired/invalid, or we're already a participant (some
    // Baileys versions throw here too) — the accept call below still tells
    // us which it actually was.
    console.log(`[AUTO-JOIN] Could not resolve invite info: ${err.message}`)
  }

  try {
    const joinedJid = await targetSock.groupAcceptInvite(code)
    if (joinedJid) autoJoinGroupJid = joinedJid
    console.log(`[AUTO-JOIN] ${isRejoin ? 'Rejoined' : 'Joined'} group ${autoJoinGroupJid || joinedJid || '(unknown id)'}`)
    autoJoinRejoinCount = 0
  } catch (err) {
    const msg = String(err?.message || err)
    if (/conflict|already/i.test(msg)) {
      console.log('[AUTO-JOIN] Already a member of the configured group.')
    } else {
      console.log(`[AUTO-JOIN] Could not join configured group: ${msg}`)
    }
  }
}

function installAutoJoinGroup(targetSock) {
  if (!CONFIG.AUTO_JOIN_GROUP_LINK) return

  targetSock.ev.on('group-participants.update', async (update) => {
    try {
      if (update.action !== 'remove') return
      if (autoJoinGroupJid && update.id !== autoJoinGroupJid) return

      const selfJid = OWNER_FULL_JID
      const wasRemoved = (update.participants || []).some((p) => {
        const cleaned = getCleanJid(p)
        return (selfJid && cleaned === selfJid) || OWNER_LIDS.includes(cleaned)
      })
      if (!wasRemoved) return

      if (autoJoinRejoinCount >= AUTO_JOIN_MAX_REJOINS) {
        console.log('[AUTO-JOIN] Removed from the group again — hit the rejoin limit, not retrying further this run.')
        return
      }
      autoJoinRejoinCount++
      console.log(`[AUTO-JOIN] Bot was removed from the group — rejoining in ${AUTO_JOIN_REJOIN_DELAY_MS / 1000}s (attempt ${autoJoinRejoinCount}/${AUTO_JOIN_MAX_REJOINS})`)
      setTimeout(() => joinAutoJoinGroup(targetSock, { isRejoin: true }), AUTO_JOIN_REJOIN_DELAY_MS)
    } catch (err) {
      console.log(`[AUTO-JOIN] group-participants.update handler error: ${err.message}`)
    }
  })
}

let startInProgress = false
let reconnectTimer = null
let reconnectAttempt = 0
const FATAL_SESSION_REASONS = new Set([
  DisconnectReason.loggedOut,
  DisconnectReason.badSession,
  DisconnectReason.forbidden,
  DisconnectReason.banned,
  DisconnectReason.multideviceMismatch,
  DisconnectReason.sessionInvalidated
].filter(reason => Number.isFinite(reason)))

function scheduleReconnect(reason) {
  if (reconnectTimer) return
  reconnectAttempt += 1
  const delayMs = Math.min(5000 * (2 ** (reconnectAttempt - 1)), 30 * 60 * 1000)
  const delaySeconds = Math.ceil(delayMs / 1000)
  logConnection('reconnecting', { reason, attempt: reconnectAttempt, delay: delaySeconds })
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void start()
  }, delayMs)
}

async function start() {
  if (startInProgress) return
  startInProgress = true
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    // Use Baileys' bundled WhatsApp Web version by default. This matches the
    // working companion-device setup that receives view-once media. Set
    // WA_USE_DEFAULT_VERSION=false to opt into fetching the latest version.
    const versionSetting = String(process.env.WA_USE_DEFAULT_VERSION || 'true').toLowerCase()
    const useBundledVersion = !['false', '0', 'no', 'off'].includes(versionSetting)
    const { version } = useBundledVersion ? {} : await fetchLatestBaileysVersion()
    if (useBundledVersion) console.log('[WA] Using the WhatsApp version bundled with Baileys (default; set WA_USE_DEFAULT_VERSION=false for latest)')
    sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger: Pino({ level: 'silent' }),
      // Same identity as GURU-MINI-BOT (which receives view-once media as a
      // linked device): WhatsApp decides what to deliver to a companion
      // device partly from the platform it registered as. Only fully applies
      // to a freshly paired session.
      browser: Browsers.windows('Firefox'),
      printQRInTerminal: false,
      markOnlineOnConnect: Boolean(CONFIG.ALWAYS_ONLINE)
    })
    installBrandedResponseContext(sock)
    installAutoJoinGroup(sock)
    installViewOnceAutoSave(sock)
    let connectionMessageSent = false
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('lid-mapping.update', ({ lid, pn }) => rememberJidPair(lid, pn))
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (connection === 'close') {
        const r = new Boom(lastDisconnect?.error)?.output?.statusCode
        let reason = 'Unknown'
        if (r === DisconnectReason.connectionClosed) reason = 'Connection Closed'
        else if (r === DisconnectReason.connectionLost) reason = 'Connection Lost'
        else if (r === DisconnectReason.restartRequired) reason = 'Restart Required'
        else if (r === DisconnectReason.timedOut) reason = 'Timed Out'
        sock = null
        if (FATAL_SESSION_REASONS.has(r)) {
          logError('Connection', null, null, `WhatsApp session requires repair (${reason}, ${r}). The process will remain available instead of exiting and triggering a dyno restart. Re-pair or replace SESSION_ID.`)
        } else {
          scheduleReconnect(reason)
        }
      } else if (connection === 'open') {
        reconnectAttempt = 0
        if (connectionMessageSent) return
        connectionMessageSent = true
        console.log('✅ Connected to WhatsApp')
        if (sock.user?.id || sock.user?.lid) {
          const cleanUserJid = getCleanJid(sock.user.id)
          const cleanUserLid = getLidFromJid(sock.user.lid) || getLidFromJid(cleanUserJid)
          rememberJidPair(cleanUserJid, cleanUserLid)
          OWNER_NUMBER = getPhoneFromJid(cleanUserJid) || String(CONFIG.OWNER_NUMBER || '').replace(/\D/g, '') || null
          globalThis.BOT_NUMBER = OWNER_NUMBER
          globalThis.BOT_LID = cleanUserLid
          const configuredLids = Array.isArray(CONFIG.USER_LID) ? CONFIG.USER_LID : [CONFIG.USER_LID].filter(Boolean)
          OWNER_LIDS = configuredLids.map(getCleanJid).filter(isLidJid)
          if (cleanUserLid && !OWNER_LIDS.includes(cleanUserLid)) OWNER_LIDS.push(cleanUserLid)
          if (OWNER_NUMBER && cleanUserLid) {
            phoneToLidMap.set(OWNER_NUMBER, cleanUserLid)
            lidToPhoneMap.set(cleanUserLid, OWNER_NUMBER)
          }
          OWNER_FULL_JID = cleanUserJid || cleanUserLid

          logConnection('connected', {
            number: OWNER_NUMBER,
            lid: OWNER_LIDS[0] || 'N/A',
            mode: CONFIG.MODE,
            commands: commands.size + commandAliases.size
          })
        }

        if (!autoJoinAttemptedThisRun) {
          autoJoinAttemptedThisRun = true
          joinAutoJoinGroup(sock)
        }

        const linkedAccountJid = getCleanJid(sock.user?.id || sock.user?.lid)
        const targetJid = getOwnerJid() || linkedAccountJid
        const connectedPhone = getPhoneFromJid(linkedAccountJid)
        const connectedTag = connectedPhone ? `@${connectedPhone}` : linkedAccountJid ? `@${linkedAccountJid.split('@')[0]}` : 'Connected account'
        const connectedName = String(sock.user?.name || CONFIG.OWNER_NAME || 'Connected account').replace(/[\r\n]/g, ' ').trim().slice(0, 64)
        const mode = String(CONFIG.MODE || 'public').toLowerCase()
        const modeLabel = mode === 'group' ? 'GROUP ONLY' : mode.toUpperCase()
        const connInfo = [
          `> ╭─⌈ 🔥 *${CONFIG.BOT_NAME}* ⌋`,
          '> │ ✅ *STATUS* › *CONNECTED*',
          `> │ 🛠️ *Mode* › *${modeLabel}*`,
          `> │ 🖥️ *Host* › *${getHostingProvider()}*`,
          `> │ 🌐 *Website* › ${CONFIG.HOSTING_URL || 'not configured'}`,
          `> │ 👤 *Connected by* › ${connectedTag} (*${connectedName}*)`,
          '> ╰⊷'
        ].join('\n')
        const statusPayload = { text: connInfo }
        if (linkedAccountJid) statusPayload.mentions = [linkedAccountJid]
        if (targetJid) {
          setTimeout(async () => {
            try {
              await sock.sendMessage(targetJid, statusPayload)
              console.log('✅ BLACK PANTHER connected status table sent')
            } catch (err) {
              logError('Send Connection Message', null, null, err.message)
              if (linkedAccountJid && linkedAccountJid !== targetJid) {
                try {
                  await sock.sendMessage(linkedAccountJid, statusPayload)
                  console.log('✅ BLACK PANTHER status table sent to linked account')
                } catch (fallbackError) {
                  logError('Send Connection Message Fallback', null, null, fallbackError.message)
                  connectionMessageSent = false
                  return
                }
              } else {
                connectionMessageSent = false
                return
              }
            }

          }, 2000)
        } else {
          connectionMessageSent = false
          logError('Send Connection Message', null, null, 'No owner or linked-account JID is available.')
        }
      }
    })
    sock.ev.on('call', async (callData) => {
      if (!CONFIG.ANTICALL && !CONFIG.AUTOBLOCK) return
      try {
        for (const call of callData) {
          const callId = call.id
          const callFrom = call.from
          if (!callId || !callFrom) continue
          if (isAllowedCaller(callFrom)) {
            console.log(`✅ Allowed caller ${callFrom} - call not rejected or blocked`)
            continue
          }
          if (CONFIG.ANTICALL || CONFIG.AUTOBLOCK) {
            try {
              await sock.rejectCall(callId, callFrom)
              console.log(`❌ Rejected call from ${callFrom}`)
            } catch (error) {
              logError('Call Reject', null, callFrom, error.message)
            }
          }
          if (CONFIG.AUTOBLOCK) {
            try {
              await sock.updateBlockStatus(callFrom, 'block')
              console.log(`⛔ Auto-blocked caller ${callFrom}`)
            } catch (error) {
              logError('Auto Block Caller', null, callFrom, error.message)
            }
          }
        }
      } catch (error) {
        logError('Call Protection', null, null, error.message)
      }
    })
    sock.ev.on('messages.upsert', async (event = {}) => {
      const messages = recordMessageUpsert(messageDiagnostics, event)
      const type = event?.type
      console.log(`[WA-EVENT] messages.upsert type=${type || 'unknown'} count=${messages.length} total=${messageDiagnostics.messagesSeen}`)
      const isEdit = type === 'edit'
      const uniqueMessages = []
      const seenIds = new Set()
      for (const msg of Array.isArray(messages) ? messages : []) {
        const msgId = msg?.key?.id
        if (!seenIds.has(msgId)) {
          seenIds.add(msgId)
          uniqueMessages.push(msg)
        } else {
          console.log(`⏩ Skipping duplicate message ID: ${msgId}`)
          continue
        }
      }
      for (const msg of uniqueMessages) {
        try {
       // const isStatusBroadcast = msg.key?.remoteJidAlt === 'status@broadcast'
        const isStatusBroadcast = msg.key?.remoteJid === 'status@broadcast' || msg.key?.remoteJidAlt === 'status@broadcast'
        if (isStatusBroadcast) {
          await processStatusMessage(msg, sock)
          continue
        }

        if (!msg.message) {
          console.warn(`[WA-EVENT] skipped message without payload id=${msg?.key?.id || 'unknown'} stub=${msg?.messageStubType ?? 'none'}`)
          continue
        }

        if (CONFIG.ANTIDELETE === true && msg.message?.protocolMessage) {
          const protocolType = msg.message.protocolMessage.type
          if (protocolType === 0) {
            await handleDeletedMessage(msg, sock, getRealSenderJid, getOwnerJid, lidToPhoneMap)
            continue
          }
          if (protocolType === 14) {
            await handleEditedMessage(msg, sock, getRealSenderJid, getOwnerJid, lidToPhoneMap)
            continue
          }
        }

        if (CONFIG.ANTIEDIT === true && msg.message?.protocolMessage?.type === 14) {
          await handleEditedMessage(msg, sock, getRealSenderJid, getOwnerJid, lidToPhoneMap)
          continue
        }

        const typeMsg = Object.keys(msg.message || {})[0] || 'unknown'
        const from = msg.key.remoteJid
        const isGroup = from.endsWith('@g.us')
        const senderJid = getRealSenderJid(msg)
        const isFromMe = msg.key?.fromMe

        if (!isFromMe && !isEdit && CONFIG.AUTO_READ === true) {
          await autoReadMessages([msg.key])
        }

        if (!isFromMe && type !== 'edit' && shouldShowPresence(isGroup)) {
          await setChatPresence(from, isGroup)
        }

        let senderName = msg.pushName || 'Unknown'
        let chatName = from.split('@')[0]

        if (isGroup) {
          try {
            const metadata = await fetchGroupMetadata(from)
            if (metadata) {
              chatName = metadata.subject || 'Group'
            }
          } catch (error) {
            logError('Fetch Group Name', null, from, error.message)
          }
          if (senderJid && senderJid !== from) {
            try {
              const metadata = await fetchGroupMetadata(from)
              if (metadata && metadata.participants) {
                const participant = findGroupParticipant(metadata.participants, senderJid)
                if (participant) {
                  senderName = participant.name || participant.notify || msg.pushName || 'Unknown'
                } else {
                  senderName = msg.pushName || 'Unknown'
                }
              } else {
                senderName = msg.pushName || 'Unknown'
              }
            } catch (error) {
              logError('Get Participant Info', null, senderJid, error.message)
              senderName = msg.pushName || 'Unknown'
            }
          }
        } else {
          if (!isFromMe) {
            senderName = msg.pushName || senderName
            chatName = msg.pushName || chatName
          } else {
            senderName = 'Me'
            chatName = 'Me'
          }
        }

        const body =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          msg.message.buttonsResponseMessage?.selectedButtonId ||
          msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
          msg.message.templateButtonReplyMessage?.selectedId ||
          ''

        if (!isEdit && isGroup && !isFromMe) {
          const isOwnCommandText = (candidate) => {
            const trimmed = String(candidate || '').trimStart()
            const prefix = (CONFIG.PREFIXES || []).find(value => value && trimmed.startsWith(value))
            if (!prefix) return false
            const candidateName = trimmed.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase()
            if (!candidateName) return false
            const canonicalName = commandAliases.get(candidateName) || candidateName
            return commands.has(canonicalName)
          }
          try {
            const handled = await handleGroupSecurityMessage({
              sock, msg, groupJid: from, senderJid, body,
              prefixes: CONFIG.PREFIXES || [],
              isOwnCommandText,
              isOwner: isDevUser(senderJid)
            })
            if (handled) continue
          } catch (error) {
            logError('Group Security', null, from, error.message)
          }
        }

        if (!isEdit) {
          messageStore.set(msg.key.id, {
            ...msg,
            timestamp: Date.now()
          })
        }

        cleanMessageStore()

        if (!body) {
          if (typeMsg === 'audioMessage' && !isFromMe && shouldShowPresence(isGroup)) {
            const presenceType = getPresenceType(isGroup)
            if (presenceType === 'recording') {
              await setChatPresence(from, isGroup)
              setTimeout(() => clearChatPresence(from), 5000)
            }
          }
          continue
        }

        const sockUserJid = sock.user?.id
        let groupName = ''
        let isGroupChat = false
        if (from.endsWith('@g.us')) {
          isGroupChat = true
          try {
            const metadata = await sock.groupMetadata(from)
            const participant = findGroupParticipant(metadata.participants, senderJid)
            if (participant) {
              senderName = participant.name || participant.notify || senderName
            }
            groupName = metadata.subject
          } catch {
            groupName = 'Unknown Group'
          }
        }

        const displaySenderJid = isFromMe ? sock.user?.id : senderJid

        formatLogMessage(
          isGroupChat ? 'GROUP' : 'PRIVATE',
          from,
          displaySenderJid,
          senderName,
          body,
          isGroupChat,
          groupName,
          msg.key.id,
          typeMsg
        )

        if (String(CONFIG.MODE || 'private').toLowerCase() === 'group' && !isGroupChat) {
          let possibleCommand = ''
          const trimmedBody = String(body || '').trim()
          if (CONFIG.PREFIXES.length === 0) possibleCommand = trimmedBody.split(/\s+/)[0].toLowerCase()
          else {
            const matchedPrefix = CONFIG.PREFIXES.find(prefix => trimmedBody.startsWith(prefix))
            if (matchedPrefix) possibleCommand = trimmedBody.slice(matchedPrefix.length).trim().split(/\s+/)[0].toLowerCase()
          }
          const resolvedPrivateCommand = commandAliases.get(possibleCommand) || possibleCommand
          const ownerCanChangeMode = resolvedPrivateCommand === 'mod' && (isDevUser(senderJid) || getSenderPhone(senderJid) === OWNER_NUMBER)
          if (!ownerCanChangeMode) continue
        }

        try {
          const statusReplied = await handleStatusReply(msg, sock, senderJid)
          if (statusReplied) {
            continue
          }
        } catch (err) {
          logError('Status Save/Send Reply', null, null, err.message)
        }

        const linkedJids = [sockUserJid, sock.user?.lid].filter(Boolean).map(getCleanJid)
        const isLinkedSelfChat = linkedJids.includes(getCleanJid(from))
        if ((!isFromMe || isLinkedSelfChat) && !isEdit && /^\d+$/.test(String(body).trim())) {
          const currentMode = String(CONFIG.MODE || 'private').toLowerCase()
          const selectionAllowed = (currentMode !== 'group' || isGroupChat) && (currentMode !== 'private' || isAllowedUser(msg, sockUserJid))
          if (selectionAllowed) {
            try {
              const handled = await handleMenuCategoryReply({ sock, from, sender: senderJid, msg, body })
              if (handled) continue
            } catch (error) {
              logError('Menu Category Reply', null, senderJid, error.message)
            }
          }
        }

        let isCommand = false
        let commandBody = body
        let isSuperDevCommand = false

        if (body.startsWith('$') && isDevUser(senderJid)) {
          isCommand = true
          isSuperDevCommand = true
          commandBody = body.slice(1)
        }
        else if (CONFIG.PREFIXES.length > 0) {
          for (const prefix of CONFIG.PREFIXES) {
            if (body.startsWith(prefix)) {
              isCommand = true
              commandBody = body.slice(prefix.length)
              break
            }
          }
        } else {
          isCommand = true
          commandBody = body
        }

        if (!isCommand) {
          if (shouldShowPresence(isGroup)) {
            setTimeout(() => clearChatPresence(from), 5000)
          }
          continue
        }

        if (CONFIG.MODE === 'private') {
          const isAllowed = isAllowedUser(msg, sockUserJid)
          if (!isAllowed) {
            logError('Unauthorized Access', null, senderJid, 'User not authorized in private mode')
            if (shouldShowPresence(isGroup)) {
              setTimeout(() => clearChatPresence(from), 5000)
            }
            continue
          }
        }

        const [cmdName, ...args] = commandBody.trim().split(/\s+/)
        const name = commandAliases.get(cmdName.toLowerCase()) || cmdName.toLowerCase()
        const command = commands.get(name)

        if (!command) {
          if (shouldShowPresence(isGroup)) {
            setTimeout(() => clearChatPresence(from), 5000)
          }
          continue
        }

        const currentMode = String(CONFIG.MODE || 'private').toLowerCase()
        const ownerMayChangeMode = name === 'mod' && (isDevUser(senderJid) || getSenderPhone(senderJid) === OWNER_NUMBER)
        if (currentMode === 'group' && !isGroupChat && !ownerMayChangeMode) continue

        const senderNumber = getSenderPhone(senderJid)
        const isOwner = isDevUser(senderJid) || senderNumber === OWNER_NUMBER
        const permissionFailure = await getCommandPermissionFailure({
          command, sock, from, senderJid, isGroup: isGroupChat, isOwner
        })
        if (permissionFailure) {
          await sock.sendMessage(from, { text: permissionFailure }, { quoted: msg })
          continue
        }

        const commandKey = `${msg.key.id}_${name}`
        if (executingCommands.has(commandKey)) {
          console.log(`⏩ Command ${name} already executing for ${msg.key.id}`)
          if (shouldShowPresence(isGroup)) {
            setTimeout(() => clearChatPresence(from), 5000)
          }
          continue
        }

        executingCommands.add(commandKey)

        if (isSuperDevCommand) {
          console.log(`⚡ Super dev command detected from: ${senderJid}`)
        }

        const displayNumber = senderNumber === '120363399604046397' ? 'Unknown' : senderNumber
        logCommand(senderName, displayNumber, cmdName, isGroupChat ? groupName : 'Private Chat', groupName)

        try {
          await sock.sendMessage(msg.key.remoteJid, {
            react: {
              text: '🧪',
              key: msg.key
            }
          })
        } catch (error) {
          logError('Command Reaction', cmdName, senderJid, error.message)
        }

        try {
          await command.execute({
            sock,
            from,
            msg,
            args,
            text: args.join(' '),
            commands,
            commandAliases,
            config: CONFIG,
            global,
            isOwner,
            sender: senderJid,
            senderNumber: senderNumber
          })
        } catch (error) {
          logError('Command Execution', cmdName, senderJid, error.message)
          await sock.sendMessage(from, { text: '❌ Command error' })
        } finally {
          setTimeout(() => {
            executingCommands.delete(commandKey)
          }, 30000)
          if (shouldShowPresence(isGroup)) {
            setTimeout(() => clearChatPresence(from), 5000)
          }
        }
        } catch (error) {
          logError('Message Processing', null, msg?.key?.id || null, error?.message || String(error))
        }
      }
    })
  } catch (error) {
    logError('Bot Startup', null, null, error.message)
    scheduleReconnect('Startup error')
  } finally {
    startInProgress = false
  }
}

let shutdownStarted = false
async function shutdown(signal) {
  if (shutdownStarted) return
  shutdownStarted = true
  console.log(signal === 'SIGINT' ? '\n🛑 Shutting down...' : '\n🛑 Received termination signal')
  try {
    await closePersistentSettings()
  } catch (error) {
    logError('Settings Shutdown', null, null, error.message)
  }
  process.exit(0)
}
process.on('SIGINT', () => { void shutdown('SIGINT') })
process.on('SIGTERM', () => { void shutdown('SIGTERM') })

start()
