import CONFIG from '../../Guru Tech/config.js'
import axios from 'axios'

export const commands = [
  {
    name: 'repo',
    aliases: ['sc', 'script'],
    description: 'Show the BLACK PANTHER GitHub repository and its current stats.',
    execute: async ({ sock, from, config, msg }) => {
      const currentConfig = config || CONFIG
      const botName = currentConfig.BOT_NAME || 'BLACK PANTHER'
      const botVersion = currentConfig.BOT_VERSION || '3.0.0'
      const ownerName = currentConfig.OWNER_NAME || 'GuruTech'
      const repository = String(currentConfig.GITHUB_REPO || 'cleanplata/BLACK-PANTHER')
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/\/+$/, '')
      const repoApiUrl = `https://api.github.com/repos/${repository}`
      const repoUrl = `https://github.com/${repository}`

      try {
        const { data } = await axios.get(repoApiUrl)
        const stars = (data.stargazers_count || 0).toLocaleString()
        const forks = (data.forks_count || 0).toLocaleString()
        const watchers = (data.subscribers_count || data.watchers_count || 0).toLocaleString()
        const createdAt = data.created_at ? new Date(data.created_at).toLocaleDateString('en-GB') : 'N/A'
        const lastUpdated = data.pushed_at ? new Date(data.pushed_at).toLocaleDateString('en-GB') : 'N/A'

        const repoInfo = `*🤖 ${botName.toUpperCase()}* · _v${botVersion}_

*📂 GitHub Repository:*
${repoUrl}

*📊 Repository Stats:*
⭐ *Stars:* ${stars}
🍴 *Forks:* ${forks}
👀 *Watchers:* ${watchers}
📅 *Created:* ${createdAt}
♻️ *Last Updated:* ${lastUpdated}

⚡ *Powered by ${ownerName}*`

        await sock.sendMessage(from, {
          text: repoInfo,
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: CONFIG.CHANNEL_JID,
              newsletterName: botName,
              serverMessageId: -1
            }
          }
        }, { quoted: msg })
      } catch (error) {
        console.error('Repository stats error:', error.message)
        const errorMsg = `❌ *${botName} repository stats are unavailable right now.*\n\nRepository: ${repoUrl}\n\n⚡ *Powered by ${ownerName}*`
        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg })
      }
    }
  }
]
