import now from 'performance-now'
import CONFIG from '../../Guru Tech/config.js'

if (!global.botStartTime) global.botStartTime = Date.now()

export const commands = [
  {
    name: 'ping',
    aliases: ['latency', 'speed'],
    description: "Checks the bot's response time",
    category: 'General',

    execute: async ({ sock, from, msg }) => {
      const start = now()
      const botName = CONFIG.BOT_NAME || 'BLACK PANTHER'
      await sock.sendMessage(
        from,
        { text: 'Pinging...' },
        { quoted: msg }
      )

      const latency = Math.round(now() - start)
      await sock.sendMessage(
        from,
        { text: `🏓 Pong!\n⏱️ *_${botName} Speed: ${latency} ms_*` },
        { quoted: msg }
      )
    }
  },
  {
    name: 'uptime',
    aliases: ['runtime'],
    description: 'Displays the bot uptime',
    category: 'General',

    execute: async ({ sock, from, msg }) => {
      const uptime = Date.now() - global.botStartTime
      const formatted = formatUptime(uptime)
      const botName = CONFIG.BOT_NAME || 'BLACK PANTHER'
      await sock.sendMessage(
        from,
        { text: `*_${botName} UPTIME: ${formatted}_*` },
        { quoted: msg }
      )
    }
  }
]

function formatUptime(ms) {
  const sec = Math.floor(ms / 1000) % 60
  const min = Math.floor(ms / (1000 * 60)) % 60
  const hr = Math.floor(ms / (1000 * 60 * 60)) % 24
  const day = Math.floor(ms / (1000 * 60 * 60 * 24))

  const parts = []
  if (day) parts.push(`${day} day${day > 1 ? 's' : ''}`)
  if (hr) parts.push(`${hr} h`)
  if (min) parts.push(`${min} m`)
  parts.push(`${sec} s`)
  return parts.join(', ')
}
