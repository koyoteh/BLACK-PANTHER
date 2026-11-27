import { isSingleEmoji } from './statusReactions.js'
import { readSettingsNamespace, writeSettingsNamespace } from './persistentSettings.js'

const ALLOWED_KEYS = new Set([
  'ANTICALL', 'AUTOBLOCK', 'ANTIDELETE', 'ANTIEDIT', 'ANTIVIEWONCE',
  'AUTO_VIEW', 'AUTO_LIKE', 'AUTO_READ', 'AUTO_REPLY_STATUS', 'ALWAYS_ONLINE',
  'STATUS_LIKE_EMOJI', 'MODE', 'BOT_NAME', 'PREFIXES'
])

function isAllowedValue(key, value) {
  if (key === 'STATUS_LIKE_EMOJI') return value === 'random' || isSingleEmoji(value)
  if (key === 'MODE') return ['public', 'private', 'group'].includes(value)
  if (key === 'BOT_NAME') return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 40 && !/[\r\n\u0000-\u001f]/.test(value)
  if (key === 'PREFIXES') return Array.isArray(value) && value.length > 0 && value.length <= 10 && value.every(prefix => typeof prefix === 'string' && prefix.length > 0 && prefix.length <= 4 && !prefix.startsWith('$') && !/[\s,\u0000-\u001f\u007f]/u.test(prefix))
  return typeof value === 'boolean'
}

function readSettings() {
  return readSettingsNamespace('runtime-settings')
}

export function applyRuntimeSettings(config) {
  const current = readSettings()
  for (const key of ALLOWED_KEYS) {
    if (isAllowedValue(key, current[key])) {
      config[key] = current[key]
      if (key === 'MODE') process.env.MODE = current[key]
      if (key === 'PREFIXES') process.env.PREFIXES = current[key].join(',')
    }
  }
  return config
}

export async function updateRuntimeSettings(config, patch) {
  const stored = readSettings()
  const next = { ...stored }
  for (const [key, value] of Object.entries(patch || {})) {
    if (!ALLOWED_KEYS.has(key) || !isAllowedValue(key, value)) throw new TypeError(`Unsupported runtime setting: ${key}`)
    next[key] = value
  }
  await writeSettingsNamespace('runtime-settings', next)
  Object.assign(config, patch)
  if (Object.hasOwn(patch || {}, 'MODE')) process.env.MODE = patch.MODE
  if (Object.hasOwn(patch || {}, 'PREFIXES')) process.env.PREFIXES = patch.PREFIXES.join(',')
  return { ...next }
}
