import dotenv from 'dotenv'
import { gunzipSync } from 'node:zlib'

dotenv.config({ path: '.env' })

const DEFAULT_BOT_PIC = 'https://raw.githubusercontent.com/cleanplata/BLACK-PANTHER/main/black/assets/black-panther.jpg'
const DEFAULT_CHANNEL_JID = '120363431857319034@newsletter'
const DEFAULT_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbDh88NCMY0Fartkxm1g'

function parsePrefixes(prefixStr) {
  if (!prefixStr || prefixStr.trim() === '' || prefixStr.toLowerCase() === 'none') return []
  return prefixStr.split(',').map(p => p.trim()).filter(Boolean)
}

function parseBoolean(value) {
  if (typeof value === 'string') {
    return ['on', 'true', '1', 'yes'].includes(value.toLowerCase())
  }
  return Boolean(value)
}

function parseLids(lidStr) {
  if (!lidStr || lidStr.trim() === '') return []
  return lidStr.split(',').map(l => l.trim()).filter(Boolean).map(l => l.includes('@') ? l : `${l}@lid`)
}

function parseMenuImages(menuImagesStr, fallbackImage) {
  if (!menuImagesStr || menuImagesStr.trim() === '') return fallbackImage ? [fallbackImage] : []
  return menuImagesStr.split(',').map(img => img.trim()).filter(Boolean)
}

function normalizeSession(rawSession) {
  const session = rawSession?.trim()
  if (!session) return null

  let jsonText
  if (session.startsWith('GURU~')) {
    // Current BLACK-PANTHER sessions are GURU~ + base64(gzip(creds.json)).
    try {
      jsonText = gunzipSync(Buffer.from(session.slice('GURU~'.length), 'base64')).toString('utf8')
    } catch {
      throw new Error('SESSION_ID has the GURU~ prefix but is not valid gzip/base64 data.')
    }
  } else {
    // Legacy plain SESSION values are base64-encoded creds.json.
    try {
      jsonText = Buffer.from(session, 'base64').toString('utf8')
    } catch {
      throw new Error('SESSION must be base64-encoded credentials, or SESSION_ID must use the GURU~ format.')
    }
  }

  try {
    JSON.parse(jsonText)
  } catch {
    throw new Error('The supplied WhatsApp session decoded, but was not valid credentials JSON.')
  }

  // index.js writes this value to auth/creds.json as UTF-8 bytes.
  return Buffer.from(jsonText, 'utf8').toString('base64')
}

const botPic = process.env.BOT_PIC || DEFAULT_BOT_PIC
const sessionInput = process.env.SESSION?.trim() || process.env.SESSION_ID?.trim() || ''

const CONFIG = {
  MODE: (process.env.MODE || 'private').trim().toLowerCase(),
  PREFIXES: parsePrefixes(process.env.PREFIXES || '.'),
  PORT: parseInt(process.env.PORT, 10) || 3000,
  SESSION: normalizeSession(sessionInput),
  SESSION_FORMAT: !sessionInput ? null : sessionInput.startsWith('GURU~') ? 'GURU~ gzip/base64' : 'base64 creds.json',
  TZ: process.env.TZ || process.env.TIME_ZONE || 'Africa/Nairobi',
  ANTICALL: parseBoolean(process.env.ANTICALL || 'off'),
  AUTOBLOCK: parseBoolean(process.env.AUTOBLOCK || 'off'),
  ANTIDELETE: parseBoolean(process.env.ANTIDELETE || 'on'),
  ANTIEDIT: parseBoolean(process.env.ANTIEDIT || 'on'),
  // Automatically save every incoming view-once to the owner inbox.
  ANTIVIEWONCE: parseBoolean(process.env.ANTIVIEWONCE || 'on'),
  AUTO_READ: parseBoolean(process.env.AUTO_READ || 'off'),
  AUTO_VIEW: parseBoolean(process.env.AUTO_VIEW ?? process.env.AUTO_READ_STATUS ?? 'on'),
  AUTO_LIKE: parseBoolean(process.env.AUTO_LIKE ?? process.env.AUTO_LIKE_STATUS ?? 'on'),
  ALWAYS_ONLINE: parseBoolean(process.env.ALWAYS_ONLINE ?? 'on'),
  STATUS_LIKE_EMOJI: process.env.STATUS_LIKE_EMOJI || 'random',
  // How many seconds to wait after a status arrives before viewing it.
  // Ported from the older BLACK-PANTHER-MD-main's STATUS_VIEW_DELAY.
  STATUS_VIEW_DELAY: Number(process.env.STATUS_VIEW_DELAY) || 0,
  // Content the status reaction uses, beyond a plain emoji:
  // '' / 'random'  -> pick randomly from the STATUS_LIKE_EMOJI pool (default)
  // 'name'         -> react with the status poster's own WhatsApp display name
  // 'brand'        -> react with a branded phrase + the time/date viewed
  // anything else  -> used literally as the reaction text
  // This is separate from STATUS_LIKE_EMOJI (which stays the single-emoji/
  // random setting the `.reaction` command edits) so that command keeps
  // working exactly as before; set this one via env for the extra modes.
  STATUS_REACT_MODE: (process.env.STATUS_REACT_MODE || '').trim(),
  STATUS_BRAND_PHRASE: (process.env.STATUS_BRAND_PHRASE || '').trim(),
  // After viewing (and optionally reacting to) a status, also DM the
  // poster a confirmation text. Off by default, same as the older bot.
  AUTO_REPLY_STATUS: parseBoolean(process.env.AUTO_REPLY_STATUS || 'off'),
  STATUS_REPLY_TEXT: process.env.STATUS_REPLY_TEXT || '*✨ Your status viewed successfully! ✨*',
  DM_PRESENCE: process.env.DM_PRESENCE || '',
  GRP_PRESENCE: process.env.GRP_PRESENCE || '',
  USER_LID: parseLids(process.env.USER_LID || ''),
  OWNER_NUMBER: (process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
  OWNER_NAME: process.env.OWNER_NAME || 'GuruTech',
  BOT_NAME: process.env.BOT_NAME || 'BLACK PANTHER',
  BOT_PIC: botPic,
  BOT_VERSION: process.env.BOT_VERSION || '3.0.0',
  MENU_IMAGES: parseMenuImages(process.env.MENU_IMAGES || '', botPic),
  CHANNEL_JID: process.env.CHANNEL_JID || process.env.NEWSLETTER_JID || DEFAULT_CHANNEL_JID,
  CHANNEL_URL: process.env.CHANNEL_URL || process.env.NEWSLETTER_URL || DEFAULT_CHANNEL_URL,
  HOSTING_URL: process.env.HOSTING_URL || 'https://cheap.bothosting.gurutech.top',
  HOSTING_PROVIDER: process.env.HOSTING_PROVIDER || 'Bothosting',
  GITHUB_REPO: process.env.GITHUB_REPO || 'cleanplata/BLACK-PANTHER',
  // A https://chat.whatsapp.com/XXXX link (or just the XXXX code). The bot
  // joins this group on every startup, and rejoins automatically if it's
  // ever removed from it. Leave blank to disable.
  AUTO_JOIN_GROUP_LINK: process.env.AUTO_JOIN_GROUP_LINK || process.env.GROUP_INVITE_LINK || 'https://chat.whatsapp.com/LvzOybevMoU3zyhk29bweM?s=cl&p=a&iam=2',
}

export { normalizeSession }
export default CONFIG
