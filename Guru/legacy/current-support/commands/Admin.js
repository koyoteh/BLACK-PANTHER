import CONFIG from '../../Guru Tech/config.js'
import { updateRuntimeSettings } from '../../Guru Tech/runtimeSettings.js'
import { getSettingsStorageStatus } from '../../Guru Tech/persistentSettings.js'

const FEATURE_FLAGS = {
  antidelete: { label: 'Anti-delete', key: 'ANTIDELETE' },
  antiedit: { label: 'Anti-edit', key: 'ANTIEDIT' },
  antiviewonce: { label: 'Anti-view-once', key: 'ANTIVIEWONCE' },
  autoview: { label: 'Auto-view status', key: 'AUTO_VIEW' },
  autolike: { label: 'Auto-like status', key: 'AUTO_LIKE' }
}

let updateInProgress = false
let lastUpdateTriggeredAt = 0

function ownerOnlyReply(sock, from, msg, isOwner) {
  if (isOwner) return false
  void sock.sendMessage(from, { text: '❌ This command is restricted to the bot owner.' }, { quoted: msg })
  return true
}

function getRepository(config) {
  return String(process.env.UPDATE_REPOSITORY || config?.UPDATE_REPOSITORY || 'cleanplata/BLACK-PANTHER')
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
}

export const commands = [
  {
    name: 'update',
    aliases: ['checkupdate', 'updatecheck'],
    description: 'Owner-only: build and deploy the latest main-branch code from GitHub to the configured Heroku app.',
    category: 'Owner',
    ownerOnly: true,
    execute: async ({ sock, from, msg, isOwner, config }) => {
      if (ownerOnlyReply(sock, from, msg, isOwner)) return
      const repository = getRepository(config)
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
        return sock.sendMessage(from, { text: '❌ The configured GitHub repository is invalid.' }, { quoted: msg })
      }

      const repoUrl = `https://github.com/${repository}`
      const apiKey = process.env.HEROKU_API_KEY
      const appName = process.env.HEROKU_APP_NAME
      if (!apiKey || !appName) {
        return sock.sendMessage(from, {
          text: `❌ Automatic deployment is not configured. Add HEROKU_API_KEY and HEROKU_APP_NAME as private host Config Vars, then restart the bot. Never put the API key in source code or share it in chat.\n\nRepository: ${repoUrl}`
        }, { quoted: msg })
      }
      if (updateInProgress) {
        return sock.sendMessage(from, { text: '⏳ An update build is already being requested.' }, { quoted: msg })
      }
      const cooldownRemaining = 5 * 60 * 1000 - (Date.now() - lastUpdateTriggeredAt)
      if (cooldownRemaining > 0) {
        const minutes = Math.ceil(cooldownRemaining / 60000)
        return sock.sendMessage(from, { text: `⏳ An update was just requested. Try again in about ${minutes} minute(s).` }, { quoted: msg })
      }

      updateInProgress = true
      try {
        const response = await fetch(`https://api.github.com/repos/${repository}/commits/main`, {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'BLACK-PANTHER-update-check' },
          signal: AbortSignal.timeout(8000)
        })
        if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`)
        const commit = await response.json()
        const latestSha = String(commit.sha || '')
        if (!/^[a-f0-9]{40}$/i.test(latestSha)) throw new Error('GitHub did not return a valid commit SHA.')

        const treeResponse = await fetch(`https://api.github.com/repos/${repository}/git/trees/${latestSha}?recursive=1`, {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'BLACK-PANTHER-update-check' },
          signal: AbortSignal.timeout(8000)
        })
        if (!treeResponse.ok) throw new Error(`Could not verify the primary repository source tree (GitHub HTTP ${treeResponse.status}).`)
        const sourceTree = await treeResponse.json()
        const sourcePaths = new Set((sourceTree.tree || []).map(item => item.path))
        const requiredPaths = ['package.json', 'Guru Tech/index.js', 'Guru Tech/config.js', 'Guru/commands/Admin.js']
        const missingPaths = requiredPaths.filter(file => !sourcePaths.has(file))
        if (missingPaths.length) {
          return sock.sendMessage(from, {
            text: `⚠️ Update not started. The configured primary repository (${repository}) is missing required BLACK PANTHER files: ${missingPaths.join(', ')}. It appears behind this bot's current source, so deploying it could replace the running code with an older version. Sync the current BLACK PANTHER source to the primary repository, then run .update again.`
          }, { quoted: msg })
        }

        const deployedSha = process.env.HEROKU_SLUG_COMMIT || process.env.SOURCE_VERSION || process.env.GITHUB_SHA || ''
        if (deployedSha && deployedSha.toLowerCase() === latestSha.toLowerCase()) {
          return sock.sendMessage(from, {
            text: `✅ BLACK PANTHER is already running the latest commit (${latestSha.slice(0, 7)}).\nRepository: ${repoUrl}`
          }, { quoted: msg })
        }

        const buildResponse = await fetch(`https://api.heroku.com/apps/${encodeURIComponent(appName)}/builds`, {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.heroku+json; version=3',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            source_blob: {
              url: `https://github.com/${repository}/archive/${latestSha}.tar.gz`,
              version: latestSha,
              version_description: commit.commit?.message?.split('\n')[0] || 'BLACK PANTHER update'
            }
          }),
          signal: AbortSignal.timeout(15000)
        })
        if (!buildResponse.ok) {
          throw new Error(`Heroku returned HTTP ${buildResponse.status}. Check the app name, token permissions, and deployment logs.`)
        }
        const build = await buildResponse.json()
        lastUpdateTriggeredAt = Date.now()
        return sock.sendMessage(from, {
          text: `🚀 *BLACK PANTHER UPDATE STARTED*\n\nRepository: ${repoUrl}\nCommit: ${latestSha.slice(0, 7)}\nBuild: ${build.id || 'accepted'}\nStatus: *${String(build.status || 'pending').toUpperCase()}*\n\nHeroku is building this pinned GitHub commit. If the build succeeds, Heroku releases it and restarts the app automatically. Check Heroku build logs if it fails.`
        }, { quoted: msg })
      } catch (error) {
        return sock.sendMessage(from, {
          text: `❌ Could not start the Heroku update: ${error.message}\n\nRepository: ${repoUrl}\nCheck HEROKU_APP_NAME and HEROKU_API_KEY in the host Config Vars. The API key was not included in this message.`
        }, { quoted: msg })
      } finally {
        updateInProgress = false
      }
    }
  },
  {
    name: 'security',
    aliases: ['securitycheck', 'securestatus'],
    description: 'Owner-only: show the active security and status feature settings.',
    category: 'Settings',
    ownerOnly: true,
    execute: async ({ sock, from, msg, isOwner }) => {
      if (ownerOnlyReply(sock, from, msg, isOwner)) return
      const rows = [
        `• Mode: *${String(CONFIG.MODE || 'private').toUpperCase()}*`,
        `• Anti-call: *${CONFIG.ANTICALL ? 'ON' : 'OFF'}*`,
        `• Auto-block callers: *${CONFIG.AUTOBLOCK ? 'ON' : 'OFF'}*`,
        ...Object.values(FEATURE_FLAGS).map(({ label, key }) => `• ${label}: *${CONFIG[key] ? 'ON' : 'OFF'}*`),
        `• Auto-read chats: *${CONFIG.AUTO_READ ? 'ON' : 'OFF'}*`,
        `• Settings storage: *${getSettingsStorageStatus().durable ? 'PostgreSQL (durable)' : 'Local JSON (not durable on Heroku)'}*`
      ]
      return sock.sendMessage(from, {
        text: `*🛡️ BLACK PANTHER SECURITY STATUS*\n\n${rows.join('\n')}\n\nUse .antidelete, .antiedit, .antiviewonce, .autoview, .autolike, .anticall, or .autoblock with on|off to change settings. For durable settings on Heroku, the app must have a working DATABASE_URL.`
      }, { quoted: msg })
    }
  },
  ...Object.entries(FEATURE_FLAGS).map(([name, { label, key }]) => ({
    name,
    aliases: name === 'antidelete' ? ['antidel'] : name === 'antiviewonce' ? ['antivv', 'autovv'] : name === 'autoview' ? ['autoviewstatus'] : name === 'autolike' ? ['statuslike'] : [],
    description: `Owner-only: show or change ${label.toLowerCase()} and save it across restarts.`,
    category: 'Settings',
    ownerOnly: true,
    execute: async ({ sock, from, msg, text, isOwner }) => {
      if (ownerOnlyReply(sock, from, msg, isOwner)) return
      const requested = String(text || '').trim().toLowerCase()
      if (!requested || requested === 'status') {
        return sock.sendMessage(from, {
          text: `${label}: *${CONFIG[key] ? 'ON' : 'OFF'}*\nUsage: .${name} on | off\n\nSettings are saved through the configured settings backend.`
        }, { quoted: msg })
      }
      if (!['on', 'off'].includes(requested)) {
        return sock.sendMessage(from, { text: `Use .${name} on or .${name} off.` }, { quoted: msg })
      }
      await updateRuntimeSettings(CONFIG, { [key]: requested === 'on' })
      return sock.sendMessage(from, {
        text: `✅ ${label} is now *${requested.toUpperCase()}* and saved to the settings backend.`
      }, { quoted: msg })
    }
  })),
  {
    name: 'anticall',
    aliases: ['rejectcalls', 'callguard'],
    description: 'Owner-only: reject calls from non-owner numbers.',
    category: 'Settings', ownerOnly: true,
    execute: async ({ sock, from, msg, text, isOwner }) => {
      if (ownerOnlyReply(sock, from, msg, isOwner)) return
      const requested = String(text || '').trim().toLowerCase()
      if (!requested || requested === 'status') {
        return sock.sendMessage(from, { text: `Anti-call: *${CONFIG.ANTICALL ? 'ON' : 'OFF'}*\nAuto-block: *${CONFIG.AUTOBLOCK ? 'ON' : 'OFF'}*\nUsage: .anticall on | off\nOwner numbers are allowlisted. Turning anti-call off also turns auto-block off.` }, { quoted: msg })
      }
      if (!['on', 'off'].includes(requested)) return sock.sendMessage(from, { text: 'Use .anticall on or .anticall off.' }, { quoted: msg })
      const patch = requested === 'off' ? { ANTICALL: false, AUTOBLOCK: false } : { ANTICALL: true }
      await updateRuntimeSettings(CONFIG, patch)
      return sock.sendMessage(from, { text: `✅ Anti-call is *${requested.toUpperCase()}*. Calls from non-owner numbers will ${requested === 'on' ? 'be rejected' : 'ring normally'}${requested === 'off' ? ' and auto-block has also been disabled' : ''}. Setting saved.` }, { quoted: msg })
    }
  },
  {
    name: 'autoblock',
    aliases: ['blockcallers', 'autoblockcall'],
    description: 'Owner-only: automatically block non-owner numbers after they call the bot.',
    category: 'Settings', ownerOnly: true,
    execute: async ({ sock, from, msg, text, isOwner }) => {
      if (ownerOnlyReply(sock, from, msg, isOwner)) return
      const requested = String(text || '').trim().toLowerCase()
      if (!requested || requested === 'status') {
        return sock.sendMessage(from, { text: `Auto-block callers: *${CONFIG.AUTOBLOCK ? 'ON' : 'OFF'}*\nAnti-call: *${CONFIG.ANTICALL ? 'ON' : 'OFF'}*\nUsage: .autoblock on | off\nWhen on, non-owner callers are rejected and their number is blocked. Owner numbers are allowlisted. This may block legitimate contacts; use .autoblock off to disable.` }, { quoted: msg })
      }
      if (!['on', 'off'].includes(requested)) return sock.sendMessage(from, { text: 'Use .autoblock on or .autoblock off.' }, { quoted: msg })
      const patch = requested === 'on'
        ? { ANTICALL: true, AUTOBLOCK: true }
        : { AUTOBLOCK: false }
      await updateRuntimeSettings(CONFIG, patch)
      return sock.sendMessage(from, { text: requested === 'on'
        ? '⚠️ Auto-block is ON. Non-owner callers will be rejected and blocked automatically. Owner numbers are allowlisted. Use .autoblock off to stop blocking callers.'
        : `✅ Auto-block is OFF. Anti-call remains ${CONFIG.ANTICALL ? 'ON (calls are rejected but not blocked)' : 'OFF'}.`, quoted: msg })
    }
  }
]
