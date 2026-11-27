import CONFIG from '../../Guru Tech/config.js'
import { updateRuntimeSettings } from '../../Guru Tech/runtimeSettings.js'
import { isSingleEmoji, normalizeStatusReaction } from '../../Guru Tech/statusReactions.js'

function describe(setting) {
  return setting === 'random' ? 'Random from the 25-emoji set' : `Fixed emoji: ${setting}`
}

export const commands = [{
  name: 'reaction',
  aliases: ['statusreaction', 'likeemoji'],
  description: 'Set the emoji used when automatically reacting to WhatsApp statuses.',
  category: 'Settings',
  ownerOnly: true,
  execute: async ({ sock, from, msg, text, isOwner }) => {
    if (!isOwner) {
      return sock.sendMessage(from, { text: '❌ This command is restricted to the bot owner.' }, { quoted: msg })
    }

    const requested = String(text || '').trim()
    const current = normalizeStatusReaction(CONFIG.STATUS_LIKE_EMOJI)
    if (!requested || requested.toLowerCase() === 'status') {
      return sock.sendMessage(from, {
        text: `🐾 *BLACK PANTHER STATUS REACTION*\nCurrent: ${describe(current)}\n\nSet one emoji: ".reaction 🔥"\nRestore random mode: ".reaction random"`
      }, { quoted: msg })
    }

    const setting = requested.toLowerCase() === 'random' ? 'random' : requested
    if (setting !== 'random' && !isSingleEmoji(setting)) {
      return sock.sendMessage(from, { text: 'Please provide one emoji, or use `.reaction random`.' }, { quoted: msg })
    }

    try {
      await updateRuntimeSettings(CONFIG, { STATUS_LIKE_EMOJI: setting })
      return sock.sendMessage(from, {
        text: `✅ *STATUS REACTION UPDATED*\n${describe(setting)} is now active and saved.`
      }, { quoted: msg })
    } catch (error) {
      return sock.sendMessage(from, {
        text: `❌ Could not save the status reaction setting: ${error.message}`
      }, { quoted: msg })
    }
  }
}]
