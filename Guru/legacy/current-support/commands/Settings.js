import CONFIG from '../../Guru Tech/config.js'
import { getSettingsStorageStatus } from '../../Guru Tech/persistentSettings.js'
import { updateRuntimeSettings } from '../../Guru Tech/runtimeSettings.js'
import { getGroupSecurity } from '../../Guru Tech/groupSecurity.js'
import { isSingleEmoji, normalizeStatusReaction } from '../../Guru Tech/statusReactions.js'

const SWITCHES = Object.freeze({
  antidelete: { label: 'Anti-delete', key: 'ANTIDELETE' },
  antiedit: { label: 'Anti-edit', key: 'ANTIEDIT' },
  antiviewonce: { label: 'Anti-view-once', key: 'ANTIVIEWONCE' },
  autoview: { label: 'Auto-view status', key: 'AUTO_VIEW' },
  autolike: { label: 'Auto-like status', key: 'AUTO_LIKE' },
  autoreply: { label: 'Auto-reply to status', key: 'AUTO_REPLY_STATUS' },
  autoread: { label: 'Auto-read chats', key: 'AUTO_READ' },
  alwaysonline: { label: 'Always online', key: 'ALWAYS_ONLINE' },
  anticall: { label: 'Anti-call', key: 'ANTICALL' },
  autoblock: { label: 'Auto-block callers', key: 'AUTOBLOCK' }
})

const SWITCH_ALIASES = Object.freeze({
  'auto-view': 'autoview', viewstatus: 'autoview', autoviewstatus: 'autoview',
  'auto-like': 'autolike', statuslike: 'autolike', autolikestatus: 'autolike',
  'auto-read': 'autoread', read: 'autoread',
  'auto-reply': 'autoreply', 'auto-reply-status': 'autoreply', autoreplystatus: 'autoreply',
  'always-online': 'alwaysonline', online: 'alwaysonline',
  antidel: 'antidelete', 'anti-delete': 'antidelete',
  'anti-edit': 'antiedit', 'anti-viewonce': 'antiviewonce', antivv: 'antiviewonce', autovv: 'antiviewonce', rejectcalls: 'anticall', callguard: 'anticall',
  autoblockcall: 'autoblock', blockcallers: 'autoblock'
})

function canonicalName(value) {
  const name = String(value || '').trim().toLowerCase()
  return SWITCH_ALIASES[name] || name.replace(/[\s_]+/g, '-')
}

function settingsText(from) {
  const storage = getSettingsStorageStatus()
  const rows = [
    `• Bot name: *${CONFIG.BOT_NAME}*`,
    `• Command prefix: *${(CONFIG.PREFIXES || []).join(', ') || '(none)'}*`,
    `• Mode: *${String(CONFIG.MODE || 'private').toUpperCase()}*`,
    ...Object.entries(SWITCHES).map(([, option]) => `• ${option.label}: *${CONFIG[option.key] ? 'ON' : 'OFF'}*`),
    `• Status reaction: *${normalizeStatusReaction(CONFIG.STATUS_LIKE_EMOJI)}*`
  ]
  let groupNote = ''
  if (from?.endsWith('@g.us')) {
    const group = getGroupSecurity(from)
    rows.push(`• Group anti-link: *${group.antiLink.enabled ? 'ON' : 'OFF'}*`)
    rows.push(`• Group anti-bot: *${group.antiBot.enabled ? 'ON' : 'OFF'}*`)
    rows.push(`• Group slow mode: *${group.slowmodeSeconds ? `${group.slowmodeSeconds}s` : 'OFF'}*`)
    groupNote = '\nGroup controls: `.antilink` and `.antibot` (group admins).'
  }
  const persistenceNote = storage.durable
    ? 'Storage: *PostgreSQL — durable across dyno restarts.*'
    : 'Storage: *Local JSON.* On Heroku this is not durable across dyno restarts; configure a working `DATABASE_URL`.'
  return `*⚙️ BLACK PANTHER SETTINGS*\n\n${rows.join('\n')}\n\n${persistenceNote}\n\nChange a switch: .settings <name> on|off\nSet mode: .settings mode private|public|group\nSet bot name: .settings name <name> or .botname <name>\nSet prefix: .prefix ! or .settings prefix !\nSet reaction: .settings reaction <emoji|random>\nExample: .settings autoview on or .settings alwaysonline on${groupNote}`
}

async function setBotName({ sock, from, msg, text }) {
  const name = String(text || '').trim().replace(/\s+/g, ' ')
  if (!name) return sock.sendMessage(from, { text: `Current bot name: *${CONFIG.BOT_NAME}*\nUsage: .botname <new name>` }, { quoted: msg })
  if (name.length > 40 || /[\u0000-\u001f]/.test(name)) {
    return sock.sendMessage(from, { text: 'Bot names must be 1–40 characters and cannot contain control characters.' }, { quoted: msg })
  }
  try {
    await updateRuntimeSettings(CONFIG, { BOT_NAME: name })
    return sock.sendMessage(from, { text: `✅ Bot name changed to *${name}* and saved across restarts.` }, { quoted: msg })
  } catch (error) {
    return sock.sendMessage(from, { text: `❌ Could not save the bot name: ${error.message}` }, { quoted: msg })
  }
}

async function setCommandPrefix({ sock, from, msg, text }) {
  const prefix = String(text || '').trim()
  const current = (CONFIG.PREFIXES || []).join(', ') || '(none)'
  if (!prefix) {
    return sock.sendMessage(from, { text: `Current command prefix: *${current}*\nUsage: .prefix ! (choose 1–4 non-space characters; commas are not allowed)` }, { quoted: msg })
  }
  if (prefix.length > 4 || prefix.startsWith('$') || /[\s,\u0000-\u001f\u007f]/u.test(prefix)) {
    return sock.sendMessage(from, { text: 'Choose a prefix of 1–4 characters with no spaces, commas, or control characters. The $ prefix is reserved. Example: .prefix !' }, { quoted: msg })
  }
  try {
    await updateRuntimeSettings(CONFIG, { PREFIXES: [prefix] })
    return sock.sendMessage(from, { text: `✅ Command prefix changed to *${prefix}* and saved across restarts. Use ${prefix}help for commands.` }, { quoted: msg })
  } catch (error) {
    return sock.sendMessage(from, { text: `❌ Could not save the command prefix: ${error.message}` }, { quoted: msg })
  }
}

export const commands = [
  {
    name: 'settings',
    aliases: ['setting', 'botsettings'],
    description: 'Owner-only: view and change the bot’s saved settings.',
    category: 'Settings',
    ownerOnly: true,
    execute: async ({ sock, from, msg, text, isOwner }) => {
      if (!isOwner) return sock.sendMessage(from, { text: '❌ This command is restricted to the bot owner.' }, { quoted: msg })
      const input = String(text || '').trim()
      if (!input || /^(?:status|list|show)$/i.test(input)) {
        return sock.sendMessage(from, { text: settingsText(from) }, { quoted: msg })
      }
      const [rawName, ...rest] = input.split(/\s+/)
      const name = canonicalName(rawName)
      const value = rest.join(' ').trim()
      const normalizedValue = value.toLowerCase()

      if (['name', 'botname', 'bot-name'].includes(name)) {
        return setBotName({ sock, from, msg, text: value })
      }
      if (name === 'prefix') {
        return setCommandPrefix({ sock, from, msg, text: value })
      }
      if (['mode', 'mod'].includes(name)) {
        const modeInput = normalizedValue.replace(/[\s_-]+/g, '')
        const mode = modeInput === 'public' ? 'public'
          : modeInput === 'private' ? 'private'
            : ['group', 'groups', 'grouponly'].includes(modeInput) ? 'group'
              : null
        if (!mode) return sock.sendMessage(from, { text: 'Use `.settings mode private`, `.settings mode public`, or `.settings mode group`.' }, { quoted: msg })
        await updateRuntimeSettings(CONFIG, { MODE: mode })
        return sock.sendMessage(from, { text: `✅ Mode is now *${mode.toUpperCase()}* and saved across restarts.` }, { quoted: msg })
      }
      if (['reaction', 'statusreaction', 'likeemoji'].includes(name)) {
        const emoji = normalizedValue === 'random' ? 'random' : value
        if (emoji !== 'random' && !isSingleEmoji(emoji)) {
          return sock.sendMessage(from, { text: 'Use `.settings reaction random` or provide one emoji, such as `.settings reaction 🔥`.' }, { quoted: msg })
        }
        await updateRuntimeSettings(CONFIG, { STATUS_LIKE_EMOJI: emoji })
        return sock.sendMessage(from, { text: `✅ Status reaction is now *${emoji}* and saved across restarts.` }, { quoted: msg })
      }

      const canonical = SWITCH_ALIASES[name] || name.replace(/[\s_-]+/g, '')
      const option = SWITCHES[canonical]
      if (!option) return sock.sendMessage(from, { text: 'Unknown setting. Send `.settings` to see the available settings.' }, { quoted: msg })
      if (!['on', 'off'].includes(normalizedValue)) {
        return sock.sendMessage(from, { text: `Use: .settings ${canonical} on | off` }, { quoted: msg })
      }
      const enabled = normalizedValue === 'on'
      const patch = { [option.key]: enabled }
      if (option.key === 'AUTOBLOCK' && enabled) patch.ANTICALL = true
      if (option.key === 'ANTICALL' && !enabled) patch.AUTOBLOCK = false
      try {
        await updateRuntimeSettings(CONFIG, patch)
        return sock.sendMessage(from, { text: `✅ ${option.label} is now *${enabled ? 'ON' : 'OFF'}* and saved across restarts.` }, { quoted: msg })
      } catch (error) {
        return sock.sendMessage(from, { text: `❌ Could not save that setting: ${error.message}` }, { quoted: msg })
      }
    }
  },
  {
    name: 'botname',
    aliases: ['setbotname', 'setname'],
    description: 'Owner-only: change the bot display name and save it across restarts.',
    category: 'Settings',
    ownerOnly: true,
    execute: async ({ sock, from, msg, text, isOwner }) => {
      if (!isOwner) return sock.sendMessage(from, { text: '❌ This command is restricted to the bot owner.' }, { quoted: msg })
      return setBotName({ sock, from, msg, text })
    }
  },
  {
    name: 'prefix',
    aliases: ['setprefix'],
    description: 'Owner-only: show or change the command prefix and save it across restarts.',
    category: 'Settings',
    ownerOnly: true,
    execute: async ({ sock, from, msg, text, isOwner }) => {
      if (!isOwner) return sock.sendMessage(from, { text: '❌ This command is restricted to the bot owner.' }, { quoted: msg })
      return setCommandPrefix({ sock, from, msg, text })
    }
  }
]
