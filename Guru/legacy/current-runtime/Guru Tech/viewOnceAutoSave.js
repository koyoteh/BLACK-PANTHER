// ════════════════════════════════════════════════════════════════════════════
//  AUTO-SAVE VIEW-ONCE MEDIA
//
//  Ported from the older BLACK-PANTHER-MD-main (guru/gmdFunctions2.js's
//  setupVVTracker), rewritten for this project's ESM/Baileys setup.
//
//  This listener caches the original stanza and media bytes, then sends a
//  recoverable incoming view-once to the configured owner's inbox. Owner
//  reactions/replies remain a fallback; other group members cannot trigger
//  owner-inbox delivery. `.vv` / `.vv2` remain explicit alternatives.
// ════════════════════════════════════════════════════════════════════════════

import * as baileys from '@whiskeysockets/baileys'
import { messageStore } from './anti.js'
import { getMessageJidAliases, getPhoneNumber, normalizeJid } from './utils/baileysIdentity.js'
import CONFIG from './config.js'
import { getSentViewOnce } from './viewOnceSentStore.js'

const { downloadMediaMessage, downloadContentFromMessage, downloadViewOnceMessage } = baileys

function isViewOnceContent(content) {
  return Boolean(getViewOnceMedia(content))
}

// Find media inside ephemeral and view-once wrappers. Keep a depth limit for
// malformed or unexpectedly nested protocol objects.
const VIEW_ONCE_TYPES = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
const VIEW_ONCE_WRAPPERS = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage', 'editedMessage', 'associatedChildMessage', 'lottieStickerMessage']

export function getViewOnceMedia(content, inheritedViewOnce = false, depth = 0) {
  if (!content || typeof content !== 'object' || depth > 8) return null

  for (const wrapper of VIEW_ONCE_WRAPPERS) {
    const inner = content[wrapper]?.message || (wrapper === 'lottieStickerMessage' ? content[wrapper] : null)
    if (!inner || typeof inner !== 'object') continue
    const isViewOnceWrapper = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'].includes(wrapper)
    const media = getViewOnceMedia(inner, inheritedViewOnce || isViewOnceWrapper, depth + 1)
    if (media) return media
  }

  for (const type of VIEW_ONCE_TYPES) {
    const media = content[type]
    if (media && (inheritedViewOnce || media.viewOnce)) return { type, media }
  }

  return null
}

// Keep the original stanza metadata separately from the anti-delete store.
// That store intentionally has a short lifetime; `.vv` should still be able
// to retry a transient media-download failure for a while after arrival.
const viewOnceSourceCache = new Map() // id -> { message, timestamp }
const downloadedCache = new Map() // id -> { buffer, type, media, timestamp }
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 60
const SOURCE_CACHE_MAX_ENTRIES = 120
const inFlight = new Map() // id -> Promise (download still running)
const placeholderRequested = new Set()
const unavailableViewOnceIds = new Set()
const automaticDeliveryInFlight = new Map() // id -> Promise
const automaticallyDelivered = new Set()

function cleanViewOnceCaches() {
  const now = Date.now()
  for (const [id, entry] of downloadedCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) downloadedCache.delete(id)
  }
  for (const [id, entry] of viewOnceSourceCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) viewOnceSourceCache.delete(id)
  }
  while (downloadedCache.size > CACHE_MAX_ENTRIES) {
    downloadedCache.delete(downloadedCache.keys().next().value)
  }
  while (viewOnceSourceCache.size > SOURCE_CACHE_MAX_ENTRIES) {
    viewOnceSourceCache.delete(viewOnceSourceCache.keys().next().value)
  }
}

function rememberViewOnceSource(message) {
  const id = message?.key?.id
  if (!id || !getViewOnceMedia(message?.message)) return
  viewOnceSourceCache.delete(id)
  viewOnceSourceCache.set(id, { message, timestamp: Date.now() })
  cleanViewOnceCaches()
}

function cacheDownloadedBuffer(id, buffer, type, media) {
  if (!id || !buffer?.length) return
  downloadedCache.delete(id)
  downloadedCache.set(id, { buffer, type, media, timestamp: Date.now() })
  cleanViewOnceCaches()
}

export function getViewOnceMediaById(id, quotedContent, chatId = null) {
  cleanViewOnceCaches()
  const candidates = [
    getViewOnceMedia(viewOnceSourceCache.get(id)?.message?.message),
    getViewOnceMedia(messageStore.get(id)?.message),
    getViewOnceMedia(quotedContent)
  ].filter(Boolean)
  // Prefer the original stanza with its full decryption key over WhatsApp's
  // quoted copy, which may retain the wrapper but strip key/path fields.
  const cachedSent = getSentViewOnce(id, chatId)
  return candidates.find(candidate => candidate.media?.mediaKey?.length) ||
    candidates.find(candidate => candidate.media?.directPath || candidate.media?.url) ||
    candidates[0] || (cachedSent ? { type: cachedSent.type, media: { ...cachedSent.media, viewOnce: true } } : null)
}

export function getViewOnceSourceMessage(id) {
  return viewOnceSourceCache.get(id)?.message || messageStore.get(id) || null
}

function extractViewOnceMedia(content) {
  return getViewOnceMedia(content)
}

function extractContextInfo(content) {
  return (
    content?.extendedTextMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo ||
    content?.audioMessage?.contextInfo ||
    content?.documentMessage?.contextInfo ||
    content?.stickerMessage?.contextInfo ||
    content?.buttonsResponseMessage?.contextInfo ||
    content?.listResponseMessage?.contextInfo ||
    content?.contextInfo ||
    null
  )
}

function ownerIdentity(sock) {
  const ownerNumber = String(CONFIG.OWNER_NUMBER || globalThis.BOT_NUMBER || '').replace(/\D/g, '')
  const configuredLids = Array.isArray(CONFIG.USER_LID) ? CONFIG.USER_LID : [CONFIG.USER_LID].filter(Boolean)
  const selfJids = [sock.user?.id, sock.user?.lid, globalThis.BOT_LID, ...configuredLids].filter(Boolean)
  const ownerJids = new Set(selfJids.map(normalizeJid).filter(Boolean))
  if (ownerNumber) ownerJids.add(`${ownerNumber}@s.whatsapp.net`)
  return { ownerNumber, ownerJids, selfJids }
}

function isOwnerActor(message, sock) {
  const { ownerNumber, ownerJids, selfJids } = ownerIdentity(sock)
  const actorJids = getMessageJidAliases(message, { selfJids })
  if (actorJids.some(jid => ownerJids.has(normalizeJid(jid)))) return true
  return Boolean(ownerNumber && actorJids.some(jid => getPhoneNumber(jid) === ownerNumber))
}

function isExplicitViewOnceCommand(message) {
  const content = message?.message || {}
  const body = String(content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.videoMessage?.caption || content.audioMessage?.caption || content.documentMessage?.caption || content.stickerMessage?.caption || '').trimStart()
  if (!body) return false
  const prefix = (CONFIG.PREFIXES || []).find(value => value && body.startsWith(value))
  if (!prefix) return false
  const name = body.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase()
  return ['vv', 'vv2', 'vvsave', 'savevv', 'viewonce', 'openphoto', 'openvideo', 'vvphoto', 'vvx', 'retrieve', 'toviewonce', 'tovo', 'toview', 'sticker', 'tosticker', 's'].includes(name)
}

const shortTypeLabel = {
  imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio',
  documentMessage: 'document', stickerMessage: 'sticker'
}

function hasMediaLocation(media) {
  return Boolean(media?.url || media?.directPath)
}

function httpStatus(error) {
  return Number(error?.status || error?.statusCode || error?.output?.statusCode || error?.response?.status || 0)
}

function canRefreshMedia(error) {
  return [404, 410].includes(httpStatus(error))
}

export async function recoverViewOnceMediaMessage(message, sock, downloaders = {}) {
  let currentMessage = message
  let found = getViewOnceMedia(currentMessage?.message)
  if (!found) throw new Error('The source message does not contain view-once media.')

  const downloadFullMessage = downloaders.downloadMediaMessage || downloadMediaMessage
  const downloadInnerMedia = downloaders.downloadContentFromMessage || downloadContentFromMessage
  const downloadViewOnce = downloaders.downloadViewOnceMessage ||
    (!downloaders.downloadMediaMessage && !downloaders.downloadContentFromMessage ? downloadViewOnceMessage : null)
  const updateMedia = downloaders.updateMediaMessage || sock?.updateMediaMessage?.bind(sock)
  const hasMediaKey = () => Boolean(found?.media?.mediaKey?.length)
  let updateAttempted = false

  const requestMediaUpdate = async candidate => {
    if (updateAttempted) return currentMessage
    if (!hasMediaKey()) throw new Error('The original message has no media key for a reupload request.')
    if (typeof updateMedia !== 'function') throw new Error('This Baileys socket does not expose updateMediaMessage().')
    updateAttempted = true
    currentMessage = await updateMedia(candidate || currentMessage) || candidate || currentMessage
    found = getViewOnceMedia(currentMessage?.message) || found
    return currentMessage
  }

  // The installed Baileys downloader rejects a missing URL/directPath before
  // it invokes its reupload callback. Request a fresh media path first.
  if (!hasMediaLocation(found.media) && hasMediaKey()) {
    await requestMediaUpdate(currentMessage)
    found = getViewOnceMedia(currentMessage?.message) || found
  }

  const downloadWholeMessage = async () => {
    const ctx = {
      logger: console,
      reuploadRequest: async candidate => requestMediaUpdate(candidate)
    }
    const buffer = downloadViewOnce
      ? await downloadViewOnce(currentMessage, 'buffer', {}, ctx)
      : await downloadFullMessage(currentMessage, 'buffer', {}, ctx)
    if (!buffer?.length) throw new Error('downloadMediaMessage returned an empty buffer.')
    return Buffer.from(buffer)
  }

  const downloadInner = async () => {
    found = getViewOnceMedia(currentMessage?.message) || found
    if (!hasMediaLocation(found.media)) throw new Error('Media URL and directPath are both missing.')
    const kind = shortTypeLabel[found.type]
    if (!kind) throw new Error(`Unsupported view-once media type: ${found.type}`)
    const stream = await downloadInnerMedia(found.media, kind)
    const chunks = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    const buffer = Buffer.concat(chunks)
    if (!buffer.length) throw new Error('The media stream returned no bytes.')
    return buffer
  }

  let lastError
  try {
    return { buffer: await downloadWholeMessage(), type: found.type, media: found.media, message: currentMessage }
  } catch (error) {
    lastError = error
    if (!updateAttempted && hasMediaKey() && canRefreshMedia(error)) {
      await requestMediaUpdate(currentMessage)
      try {
        return { buffer: await downloadWholeMessage(), type: found.type, media: found.media, message: currentMessage }
      } catch (retryError) {
        lastError = retryError
      }
    }
  }

  try {
    const buffer = await downloadInner()
    return { buffer, type: found.type, media: found.media, message: currentMessage }
  } catch (error) {
    lastError = error
    if (!updateAttempted && hasMediaKey() && canRefreshMedia(error)) {
      await requestMediaUpdate(currentMessage)
      try {
        const buffer = await downloadWholeMessage().catch(() => downloadInner())
        return { buffer, type: found.type, media: found.media, message: currentMessage }
      } catch (retryError) {
        lastError = retryError
      }
    }
  }

  throw lastError || new Error('View-once media could not be recovered.')
}

// ── Pre-download cache ──────────────────────────────────────────────────
// View-once media can stop being fetchable from WhatsApp's servers not
// long after it arrives, whether or not anyone actually opened it. Trying
// to download it lazily when the user later runs `.vv` / `.vv2` kept failing
// with "Cannot derive from empty media key" even outside self-chat. So
// instead: download the real bytes once, immediately when
// the view-once message first arrives (while the key is still freshest —
// the bot is a recipient at that point, same as any other device would
// be) — then forward the recovered buffer into the configured owner's inbox.
// A short TTL cache, same pattern as the
// anti-delete/anti-edit message store.
// Silva MD keeps view-once bytes until the cache is full, not for a short
// timer, so `.vv` still works hours later. Same idea here: 6 hours, plus a
// hard cap on entries so large videos can't exhaust memory.

async function automaticallyDeliverViewOnce(id, type, media, message, sock, downloaders) {
  if (!id || automaticallyDelivered.has(id)) return
  if (automaticDeliveryInFlight.has(id)) return automaticDeliveryInFlight.get(id)

  const delivery = deliverViewOnceMediaToOwner(sock, {
    type,
    media,
    id,
    sourceMessage: message,
    downloaders
  }).then(delivered => {
    if (delivered) {
      automaticallyDelivered.add(id)
      while (automaticallyDelivered.size > 1000) {
        automaticallyDelivered.delete(automaticallyDelivered.values().next().value)
      }
    }
    return delivered
  }).catch(error => {
    console.error(`[VO-AUTOSAVE] Automatic inbox delivery failed for ${id}:`, error.message)
    return false
  }).finally(() => automaticDeliveryInFlight.delete(id))

  automaticDeliveryInFlight.set(id, delivery)
  return delivery
}

async function deliverOwnerTriggeredViewOnce(sock, { type, media, id, sourceMessage, triggerMessage, downloaders }) {
  if (!id || automaticallyDelivered.has(id)) return false
  const pendingDownload = inFlight.get(id)
  if (pendingDownload) await pendingDownload
  const pendingAutomaticDelivery = automaticDeliveryInFlight.get(id)
  if (pendingAutomaticDelivery) await pendingAutomaticDelivery
  if (automaticallyDelivered.has(id)) return false
  return deliverViewOnceMediaToOwner(sock, { type, media, id, sourceMessage, triggerMessage, downloaders })
}

async function predownloadViewOnce(message, type, media, sock, downloaders = {}, { autoDeliver = false } = {}) {
  const id = message?.key?.id
  if (!id) return
  if (downloadedCache.has(id)) {
    if (autoDeliver) await automaticallyDeliverViewOnce(id, type, media, message, sock, downloaders)
    return
  }
  if (inFlight.has(id)) {
    await inFlight.get(id)
    if (autoDeliver && downloadedCache.has(id)) await automaticallyDeliverViewOnce(id, type, media, message, sock, downloaders)
    return
  }

  const job = (async () => {
    try {
      const recovered = await recoverViewOnceMediaMessage(message, sock, downloaders)
      cacheDownloadedBuffer(id, recovered.buffer, recovered.type || type, recovered.media || media)
      console.log(`[VO-AUTOSAVE] cached view-once ${id} (${recovered.buffer.length} bytes)`)
    } catch (err) {
      console.error('[VO-AUTOSAVE] Pre-download failed:', err.message)
    }
  })()
  inFlight.set(id, job)
  try {
    await job
  } finally {
    inFlight.delete(id)
  }
  if (autoDeliver && downloadedCache.has(id)) {
    await automaticallyDeliverViewOnce(id, type, media, message, sock, downloaders)
  }
}

// Shared by the `.vv` / `vv2` commands (Guru/commands/WhatsApp.js) so they
// don't each repeat the same broken approach of reading the media straight
// off contextInfo.quotedMessage — WhatsApp strips the decryption key from
// that copy for view-once content, so that always fails with "Cannot
// derive from empty media key", however it's downloaded. This returns the
// buffer cached when the original view-once first arrived, if we have it,
// falling back to a live (reupload-assisted) attempt otherwise.
export async function getViewOnceBuffer(id, fallbackType, fallbackMedia, sock, downloaders = {}, fallbackMessage = null) {
  cleanViewOnceCaches()
  // If the arrival download is still running, wait for it instead of
  // starting a second (and likelier to fail) download.
  if (id && inFlight.has(id)) await inFlight.get(id)
  const cached = id ? downloadedCache.get(id) : null
  if (cached) return cached.buffer
  const sentChatId = fallbackMessage?.key?.remoteJid || viewOnceSourceCache.get(id)?.message?.key?.remoteJid || messageStore.get(id)?.key?.remoteJid || null
  const sentCopy = id ? getSentViewOnce(id, sentChatId) : null
  if (sentCopy?.buffer?.length) {
    cacheDownloadedBuffer(id, sentCopy.buffer, sentCopy.type, { ...sentCopy.media, viewOnce: true })
    return sentCopy.buffer
  }
  if (!fallbackType || !fallbackMedia) return null
  // The original upsert retains the real stanza key and media decryption
  // data; quotedMessage copies often have these fields stripped by WhatsApp.
  const originalMessage = id
    ? viewOnceSourceCache.get(id)?.message || messageStore.get(id)
    : null
  const originalVo = getViewOnceMedia(originalMessage?.message)
  const source = originalMessage?.message
    ? originalMessage
    : fallbackMessage || { key: { id }, message: { viewOnceMessageV2: { message: { [fallbackType]: fallbackMedia } } } }
  try {
    const recovered = await recoverViewOnceMediaMessage(source, sock, downloaders)
    cacheDownloadedBuffer(id, recovered.buffer, recovered.type || originalVo?.type || fallbackType, recovered.media || originalVo?.media || fallbackMedia)
    return recovered.buffer
  } catch (err) {
    console.error('[VO-AUTOSAVE] Baileys recovery failed:', err.message)
  }

  // Full diagnosis so one log paste tells us exactly why recovery failed.
  try {
    const stored = originalMessage
    const storedVo = originalVo
    const m = fallbackMedia || {}
    console.error(`[VO-AUTOSAVE] DIAG id=${id} inCache=${downloadedCache.has(id)} inFlight=${inFlight.has(id)} inStore=${Boolean(stored)} storedFromMe=${stored?.key?.fromMe} storedHasKey=${Boolean(storedVo?.media?.mediaKey?.length)} storedHasPath=${Boolean(storedVo?.media?.directPath || storedVo?.media?.url)} quotedHasKey=${Boolean(m.mediaKey?.length)} quotedHasPath=${Boolean(m.directPath || m.url)} cacheSize=${downloadedCache.size}`)
  } catch {}
  return null
}

function getViewOnceAttribution(sock, sourceMessage) {
  const key = sourceMessage?.key || {}
  const groupId = String(key.remoteJid || '')
  const aliases = getMessageJidAliases(sourceMessage || {}, { selfJids: [] })
  const phone = aliases.map(getPhoneNumber).find(Boolean)
  const senderJid = phone ? `${phone}@s.whatsapp.net` : normalizeJid(key.participant || key.participantAlt || key.remoteJid)
  return { groupId: groupId.endsWith('@g.us') ? groupId : null, senderJid }
}

export async function deliverViewOnceMediaToOwner(sock, { type, media, id, sourceMessage = null, triggerMessage = null, downloaders = {} }) {
  const kind = shortTypeLabel[type]
  if (!kind) return false
  const ownerNum = String(CONFIG.OWNER_NUMBER || globalThis.BOT_NUMBER || '').replace(/\D/g, '')
  const targetJid = ownerNum
    ? `${ownerNum}@s.whatsapp.net`
    : normalizeJid(sock.user?.id || sock.user?.lid || globalThis.BOT_LID)
  if (!targetJid) return false
  const buffer = await getViewOnceBuffer(id, type, media, sock, downloaders, sourceMessage)
  if (!buffer?.length) return false
  const normalizedType = type === 'imageMessage' ? 'image' : type === 'videoMessage' ? 'video' : type === 'audioMessage' ? 'audio' : type === 'documentMessage' ? 'document' : 'sticker'
  const attribution = getViewOnceAttribution(sock, sourceMessage)
  const senderNumber = getPhoneNumber(attribution.senderJid) || String(attribution.senderJid || '').split('@')[0] || 'Unknown'
  const when = new Date().toLocaleString('en-KE', { timeZone: CONFIG.TZ || 'Africa/Nairobi' })
  const caption = [
    '╭─❏ 「 VIEW ONCE RETRIEVED 」',
    `│ Sender: @${senderNumber}`,
    `│ Chat: ${attribution.groupId ? 'Group 👥' : 'DM 💬'}`,
    `│ Time: ${when}`,
    ...(media.caption ? [`│ Caption: ${media.caption}`] : []),
    '╰───────────────'
  ].join('\n')
  const captionMentions = attribution.senderJid ? [attribution.senderJid] : []
  if (normalizedType === 'image') await sock.sendMessage(targetJid, { image: buffer, caption, mentions: captionMentions, mimetype: media.mimetype || 'image/jpeg' })
  else if (normalizedType === 'video') await sock.sendMessage(targetJid, { video: buffer, caption, mentions: captionMentions, mimetype: media.mimetype || 'video/mp4' })
  else if (normalizedType === 'audio') { await sock.sendMessage(targetJid, { audio: buffer, mimetype: media.mimetype || 'audio/mp4', ptt: Boolean(media.ptt) }); await sock.sendMessage(targetJid, { text: caption, mentions: captionMentions }) }
  else if (normalizedType === 'document') await sock.sendMessage(targetJid, { document: buffer, mimetype: media.mimetype || 'application/octet-stream', fileName: media.fileName || `view-once-${id || 'media'}`, caption })
  else { await sock.sendMessage(targetJid, { sticker: buffer }); await sock.sendMessage(targetJid, { text: caption, mentions: captionMentions }) }

  const triggerChat = triggerMessage?.key?.remoteJid
  if (triggerChat?.endsWith('@g.us') && triggerMessage.key) {
    await sock.sendMessage(triggerChat, { react: { text: '✅', key: triggerMessage.key } }).catch(() => {})
    await sock.sendMessage(triggerChat, { text: '✅ View-once media saved to your owner inbox.' }, { quoted: triggerMessage })
  }
  console.log(`[VO-AUTOSAVE] delivered ${kind} to owner inbox from message ${id}`)
  return true
}

const installedSockets = new WeakSet()

export function installViewOnceAutoSave(sock, downloaders = {}) {
  if (installedSockets.has(sock)) return
  installedSockets.add(sock)

  // Raw envelope probe: shows exactly what WhatsApp's server sent for each
  // incoming message that has no encrypted payload or is flagged
  // "unavailable" (e.g. type=view_once_unavailable_fanout means the server
  // deliberately did NOT send the content to this linked device).
  try {
    sock.ws?.on?.('CB:message', node => {
      try {
        const kids = Array.isArray(node?.content) ? node.content : []
        const un = kids.find(k => k?.tag === 'unavailable')
        const hasEnc = kids.some(k => k?.tag === 'enc')
        if (un && /view.?once/i.test(String(un.attrs?.type || '')) && node.attrs?.id) {
          unavailableViewOnceIds.add(node.attrs.id)
          while (unavailableViewOnceIds.size > 500) {
            unavailableViewOnceIds.delete(unavailableViewOnceIds.values().next().value)
          }
        }
        if (un || (!hasEnc && node?.attrs?.from && node.attrs.from !== 'status@broadcast')) {
          console.log(`[VO-AUTOSAVE] RAW envelope id=${node.attrs?.id} from=${node.attrs?.from} type=${node.attrs?.type} children=${kids.map(k => k.tag + JSON.stringify(k.attrs || {})).join(' | ') || 'none'}`)
        }
      } catch {}
    })
  } catch {}

  // Answers to the on-demand history request arrive here.
  sock.ev.on('messaging-history.set', ({ messages, syncType }) => {
    for (const m of messages || []) {
      try {
        const id = m?.key?.id
        const wanted = id && placeholderRequested.has(id)
        const vo = m?.message ? extractViewOnceMedia(m.message) : null
        if (wanted) {
          console.log(`[VO-AUTOSAVE] history answer for ${id}: syncType=${syncType} hasContent=${Boolean(m.message)} viewOnce=${Boolean(vo)} mediaKey=${Boolean(vo?.media?.mediaKey?.length)} directPath=${Boolean(vo?.media?.directPath || vo?.media?.url)}`)
        }
        if (vo) {
          rememberViewOnceSource(m)
          if (vo.media?.mediaKey?.length) void predownloadViewOnce(m, vo.type, vo.media, sock, downloaders, { autoDeliver: Boolean(wanted) && CONFIG.ANTIVIEWONCE !== false })
        }
      } catch (e) {
        console.error('[VO-AUTOSAVE] history handler error:', e.message)
      }
    }
  })

  // Any later update to a message we asked about (content may arrive here).
  sock.ev.on('messages.update', updates => {
    for (const u of updates || []) {
      const id = u?.key?.id
      if (id && placeholderRequested.has(id)) {
        console.log(`[VO-AUTOSAVE] update for requested ${id}: keys=${Object.keys(u.update || {}).join(',')}`)
        const m = u.update?.message
        const vo = m ? extractViewOnceMedia(m) : null
        if (vo) {
          const updatedMessage = { key: u.key, message: m }
          rememberViewOnceSource(updatedMessage)
          if (vo.media?.mediaKey?.length) void predownloadViewOnce(updatedMessage, vo.type, vo.media, sock, downloaders, { autoDeliver: CONFIG.ANTIVIEWONCE !== false })
        }
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type: upsertType }) => {
    for (const msg of messages) {
      try {
        const content = msg?.message
        if (msg?.key?.remoteJid && msg.key.remoteJid !== 'status@broadcast' && !msg.key.fromMe) {
          if (!content) {
            // WhatsApp sometimes delivers a message to a linked device with
            // no readable content (undecryptable / withheld). Log it so we
            // can tell "never delivered" apart from "delivered but unsaved".
            const stubDetails = JSON.stringify(msg.messageStubParameters || [])
            const explicitlyUnavailable = unavailableViewOnceIds.has(msg.key.id) || (msg.messageStubParameters || []).some(value => /absent from node|view.?once|unavailable/i.test(String(value)))
            console.log(`[VO-AUTOSAVE] upsert with NO content id=${msg.key.id} stub=${msg.messageStubType ?? 'none'} params=${stubDetails}; recoverablePayload=false`)
            if (explicitlyUnavailable) {
              console.warn(`[VO-AUTOSAVE] WhatsApp supplied only an unavailable/stub envelope for ${msg.key.id}; no media key or encrypted payload exists on this linked session to download or forward.`)
            }
            // Ask the main phone to resend the real content (Baileys
            // "placeholder resend"). If the phone answers, the full message
            // comes back as a new upsert and is cached by the code below.
            if (!placeholderRequested.has(msg.key.id) && typeof sock.requestPlaceholderResend === 'function') {
              placeholderRequested.add(msg.key.id)
              if (placeholderRequested.size > 500) placeholderRequested.delete(placeholderRequested.values().next().value)
              sock.requestPlaceholderResend(msg.key)
                .then(r => console.log(`[VO-AUTOSAVE] requested resend from phone for ${msg.key.id}: ${String(r)}`))
                .catch(e => console.error(`[VO-AUTOSAVE] resend request failed for ${msg.key.id}: ${e.message}`))
            } else if (typeof sock.requestPlaceholderResend !== 'function') {
              console.log('[VO-AUTOSAVE] this Baileys version has no requestPlaceholderResend')
            }
            // Second, different request: on-demand history sync for this one
            // message. The phone answers through 'messaging-history.set'
            // (handled below), which may carry the media even if the
            // placeholder resend is ignored.
            if (typeof sock.fetchMessageHistory === 'function') {
              const ts = msg.messageTimestamp?.toNumber ? msg.messageTimestamp.toNumber() : Number(msg.messageTimestamp || Math.floor(Date.now() / 1000))
              setTimeout(() => {
                sock.fetchMessageHistory(1, msg.key, ts)
                  .then(r => console.log(`[VO-AUTOSAVE] requested on-demand history for ${msg.key.id}: ${String(r)}`))
                  .catch(e => console.error(`[VO-AUTOSAVE] history request failed for ${msg.key.id}: ${e.message}`))
              }, 4000)
            }
          } else {
            const k = Object.keys(content).filter(x => x !== 'messageContextInfo')
            if (k.some(x => /image|video|audio|viewonce/i.test(x))) console.log(`[VO-AUTOSAVE] media upsert id=${msg.key.id} keys=${k.join(',')}`)
          }
        }
        if (!content) continue
        if (msg.key.remoteJid === 'status@broadcast') continue

        // ── Pre-download: this message itself is a fresh view-once ───────
        // Cache and forward real bytes now, while they're still fetchable;
        // `.vv` / `.vv2` remain alternatives if the automatic download fails.
        // fromMe messages are cached too (Silva MD doesn't skip them): a
        // view-once sent from your own phone/self-chat arrives here with
        // fromMe=true, and skipping it left `.vv` with nothing cached.
        const topKeys = Object.keys(content)
        if (!isViewOnceContent(content) && topKeys.some(k => /viewonce/i.test(k))) {
          console.log(`[VO-AUTOSAVE] view-once wrapper NOT recognised, id=${msg.key.id} keys=${topKeys.join(',')}`)
        }
        if (isViewOnceContent(content)) {
          const vo = extractViewOnceMedia(content)
          if (vo) {
            rememberViewOnceSource(msg)
            const hasKey = Boolean(vo.media?.mediaKey?.length)
            const hasPath = Boolean(vo.media?.directPath || vo.media?.url)
            console.log(`[VO-AUTOSAVE] view-once seen id=${msg.key.id} fromMe=${Boolean(msg.key.fromMe)} type=${vo.type} mediaKey=${hasKey} directPath=${hasPath}`)
            const wasPlaceholderRequested = placeholderRequested.has(msg.key.id)
            const shouldAutoDeliver = CONFIG.ANTIVIEWONCE !== false && !msg.key.fromMe && (upsertType === 'notify' || wasPlaceholderRequested)
            void predownloadViewOnce(msg, vo.type, vo.media, sock, downloaders, { autoDeliver: shouldAutoDeliver })
          }
        }

        // Reactions/replies remain a fallback for the owner only. The
        // automatic path above marks successfully delivered messages so
        // later reactions/replies do not send duplicate copies.
        if (!isOwnerActor(msg, sock) || isExplicitViewOnceCommand(msg)) continue
        if (content.reactionMessage) {
          const reactedId = content.reactionMessage.key?.id
          if (!reactedId) continue
          const vo = getViewOnceMediaById(reactedId, null, msg.key?.remoteJid)
          if (vo) await deliverOwnerTriggeredViewOnce(sock, { ...vo, id: reactedId, sourceMessage: getViewOnceSourceMessage(reactedId), triggerMessage: msg, downloaders })
          continue
        }
        const contextInfo = extractContextInfo(content)
        if (!contextInfo?.stanzaId) continue
        const vo = getViewOnceMediaById(contextInfo.stanzaId, contextInfo.quotedMessage, msg.key?.remoteJid)
        if (vo) await deliverOwnerTriggeredViewOnce(sock, { ...vo, id: contextInfo.stanzaId, sourceMessage: getViewOnceSourceMessage(contextInfo.stanzaId), triggerMessage: msg, downloaders })

      } catch (err) {
        console.error('[VO-AUTOSAVE] Error:', err.message)
      }
    }
  })
}
