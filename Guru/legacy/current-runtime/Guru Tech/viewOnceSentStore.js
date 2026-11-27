import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'toviewonce_sent.json')
const STORE_FILE = process.env.VIEW_ONCE_SENT_FILE || DEFAULT_FILE
const ENTRY_TTL_MS = 3 * 60 * 60 * 1000
const MAX_BYTES = 16 * 1024 * 1024
let store

function loadStore() {
  if (store) return store
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'))
    store = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    store = {}
  }
  return store
}

function entryBytes(entry) {
  return Number(entry?.byteLength) || 0
}

function pruneStore(now = Date.now()) {
  const current = loadStore()
  for (const [key, entry] of Object.entries(current)) {
    if (!entry?.timestamp || now - entry.timestamp > ENTRY_TTL_MS || typeof entry.buffer !== 'string') {
      delete current[key]
    }
  }
  let total = Object.values(current).reduce((sum, entry) => sum + entryBytes(entry), 0)
  if (total > MAX_BYTES) {
    const oldestFirst = Object.entries(current).sort((a, b) => a[1].timestamp - b[1].timestamp)
    for (const [key, entry] of oldestFirst) {
      if (total <= MAX_BYTES) break
      total -= entryBytes(entry)
      delete current[key]
    }
  }
  return current
}

function persistStore() {
  const directory = path.dirname(STORE_FILE)
  fs.mkdirSync(directory, { recursive: true })
  const tempPath = `${STORE_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(loadStore()), { mode: 0o600 })
  fs.renameSync(tempPath, STORE_FILE)
}

function safeMetadata(media = {}) {
  return {
    mimetype: String(media.mimetype || '').slice(0, 120),
    caption: String(media.caption || '').slice(0, 1024),
    fileName: String(media.fileName || '').slice(0, 160),
    ptt: Boolean(media.ptt),
    isAnimated: Boolean(media.isAnimated),
    isLottie: Boolean(media.isLottie)
  }
}

export function saveSentViewOnce({ chatId, messageId, type, buffer, media = {}, sourceMessageId = null }) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  if (!chatId || !messageId || !type || !bytes.length) return { stored: false, reason: 'invalid-input' }
  if (bytes.length > MAX_BYTES) return { stored: false, reason: 'over-limit' }

  const current = pruneStore()
  const key = `${chatId}:${messageId}`
  current[key] = {
    chatId,
    messageId,
    type,
    media: safeMetadata(media),
    sourceMessageId: sourceMessageId ? String(sourceMessageId).slice(0, 128) : null,
    buffer: bytes.toString('base64'),
    byteLength: bytes.length,
    timestamp: Date.now()
  }

  let total = Object.values(current).reduce((sum, entry) => sum + entryBytes(entry), 0)
  if (total > MAX_BYTES) {
    const oldestFirst = Object.entries(current)
      .filter(([entryKey]) => entryKey !== key)
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
    for (const [entryKey, entry] of oldestFirst) {
      if (total <= MAX_BYTES) break
      total -= entryBytes(entry)
      delete current[entryKey]
    }
  }
  if (total > MAX_BYTES) {
    delete current[key]
    return { stored: false, reason: 'over-limit' }
  }

  persistStore()
  return { stored: true, reason: null }
}

export function getSentViewOnce(messageId, chatId = null) {
  if (!messageId) return null
  const current = pruneStore()
  const matching = Object.values(current).find(entry =>
    entry.messageId === messageId && (!chatId || entry.chatId === chatId)
  )
  if (!matching) return null
  return {
    ...matching,
    buffer: Buffer.from(matching.buffer, 'base64')
  }
}

export function removeSentViewOnce(messageId, chatId = null) {
  if (!messageId) return false
  const current = loadStore()
  let removed = false
  for (const [key, entry] of Object.entries(current)) {
    if (entry.messageId === messageId && (!chatId || entry.chatId === chatId)) {
      delete current[key]
      removed = true
    }
  }
  if (removed) persistStore()
  return removed
}
