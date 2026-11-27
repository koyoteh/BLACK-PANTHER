import CONFIG from '../../Guru Tech/config.js'
import { updateRuntimeSettings } from '../../Guru Tech/runtimeSettings.js'

const MODE_LABELS = {
  public: 'PUBLIC',
  private: 'PRIVATE',
  group: 'GROUP ONLY'
}

export const commands = [
  {
    name: 'mod',
    aliases: ['mode', 'setmode'],
    description: 'Switch the bot between public, private, and group-only modes (owner only).',
    category: 'Settings',
    execute: async ({ sock, from, msg, text, isOwner }) => {
      if (!isOwner) {
        return sock.sendMessage(from, {
          text: 'Only the bot owner can change its mode.'
        }, { quoted: msg })
      }

      const requested = String(text || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
      if (!requested || requested === 'status') {
        const current = MODE_LABELS[String(CONFIG.MODE || 'private').toLowerCase()] || String(CONFIG.MODE).toUpperCase()
        return sock.sendMessage(from, {
          text: `Current mode: *${current}*\nUsage: .mod public | .mod private | .mod group only`
        }, { quoted: msg })
      }

      const mode = requested === 'public' ? 'public'
        : requested === 'private' ? 'private'
          : ['group', 'groups', 'grouponly'].includes(requested) ? 'group'
            : null

      if (!mode) {
        return sock.sendMessage(from, {
          text: 'Choose one: `.mod public`, `.mod private`, or `.mod group only`.'
        }, { quoted: msg })
      }

      await updateRuntimeSettings(CONFIG, { MODE: mode })
      return sock.sendMessage(from, {
        text: `✅ Mode changed to *${MODE_LABELS[mode]}* and saved across bot restarts.`
      }, { quoted: msg })
    }
  }
]
