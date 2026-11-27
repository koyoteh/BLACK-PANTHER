import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ultra-guru-settings-'))
const runtimePath = path.join(testDir, 'runtime-settings.json')
const groupPath = path.join(testDir, 'group-security.json')
const controlPath = path.join(testDir, 'process-control.json')
process.env.RUNTIME_SETTINGS_FILE = runtimePath
process.env.GROUP_SECURITY_FILE = groupPath
process.env.PROCESS_CONTROL_FILE = controlPath
delete process.env.DATABASE_URL
delete process.env.ALWAYS_ONLINE
delete process.env.AUTO_VIEW
delete process.env.AUTO_READ_STATUS
delete process.env.AUTO_LIKE
delete process.env.AUTO_LIKE_STATUS
delete process.env.AUTO_REPLY_STATUS
delete process.env.PREFIXES

const { default: CONFIG } = await import('../../Guru Tech/config.js')
const { bindSettingsToSession, initializePersistentSettings, writeSettingsNamespace } = await import('../../Guru Tech/persistentSettings.js')
const { applyRuntimeSettings } = await import('../../Guru Tech/runtimeSettings.js')
const { commands: settingsCommands } = await import('../commands/Settings.js')
const { commands: userCommands } = await import('../commands/User.js')
const groupSecurity = await import('../../Guru Tech/groupSecurity.js')

await initializePersistentSettings()
await bindSettingsToSession('test-session-a')
after(() => fs.rmSync(testDir, { recursive: true, force: true }))

function fakeCommandContext() {
  const messages = []
  const sock = {
    sendMessage: async (jid, content, options) => {
      messages.push({ jid, content, options })
      return {}
    }
  }
  return { messages, sock }
}

test('always-online, auto-view, and auto-like default to on; .settings changes save globally', async () => {
  assert.equal(CONFIG.ALWAYS_ONLINE, true)
  assert.equal(CONFIG.AUTO_VIEW, true)
  assert.equal(CONFIG.AUTO_LIKE, true)

  const command = settingsCommands.find(item => item.name === 'settings')
  const { messages, sock } = fakeCommandContext()
  const msg = { key: {}, message: {} }
  await command.execute({ sock, from: '254700000001@s.whatsapp.net', msg, text: '', isOwner: true })
  assert.match(messages.at(-1).content.text, /Always online: \*ON\*/)
  assert.match(messages.at(-1).content.text, /Auto-view status: \*ON\*/)
  assert.match(messages.at(-1).content.text, /Auto-like status: \*ON\*/)

  for (const change of ['autoview off', 'autolike off', 'alwaysonline off', 'autoread on', 'autoreply on', 'mode public', 'reaction 🔥']) {
    await command.execute({ sock, from: '254700000001@s.whatsapp.net', msg, text: change, isOwner: true })
  }
  const prefixCommand = settingsCommands.find(item => item.name === 'prefix')
  await prefixCommand.execute({ sock, from: '254700000001@s.whatsapp.net', msg, text: '!', isOwner: true })
  await command.execute({ sock, from: '254700000001@s.whatsapp.net', msg, text: 'prefix #', isOwner: true })
  assert.match(messages.at(-1).content.text, /prefix changed to \*#\*/i)
  await prefixCommand.execute({ sock, from: '254700000001@s.whatsapp.net', msg, text: '$', isOwner: true })
  assert.match(messages.at(-1).content.text, /\$ prefix is reserved/i)
  assert.deepEqual(CONFIG.PREFIXES, ['#'])
  const botNameCommand = settingsCommands.find(item => item.name === 'botname')
  await botNameCommand.execute({ sock, from: '254700000001@s.whatsapp.net', msg, text: 'Guru Test Name', isOwner: true })

  const restartedConfig = {
    MODE: 'private', PREFIXES: ['.'], AUTO_VIEW: true, AUTO_LIKE: true, AUTO_READ: false, AUTO_REPLY_STATUS: false,
    ALWAYS_ONLINE: true, STATUS_LIKE_EMOJI: 'random', BOT_NAME: 'BLACK PANTHER'
  }
  applyRuntimeSettings(restartedConfig)
  assert.deepEqual(restartedConfig, {
      MODE: 'public', PREFIXES: ['#'], AUTO_VIEW: false, AUTO_LIKE: false, AUTO_READ: true, AUTO_REPLY_STATUS: true,
    ALWAYS_ONLINE: false, STATUS_LIKE_EMOJI: '🔥', BOT_NAME: 'Guru Test Name'
  })
})

test('group settings persist with their full moderation policy across a real process restart', async () => {
  const groupJid = '120363000000001@g.us'
  await groupSecurity.updateGroupSecurity(groupJid, state => {
    state.antiBot.enabled = true
    state.antiBot.action = 'kick'
    state.antiLink.enabled = true
    state.antiLink.action = 'delete'
    state.antiLink.sensitivity = 'strict'
    state.antiLink.allowedDomains = ['example.com']
    state.slowmodeSeconds = 30
    state.rules = 'Be respectful.'
  })

  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const childEnv = { ...process.env, RUNTIME_SETTINGS_FILE: runtimePath, GROUP_SECURITY_FILE: groupPath }
  delete childEnv.DATABASE_URL
  const script = `
    import { initializePersistentSettings } from './Guru Tech/persistentSettings.js';
    import { bindSettingsToSession } from './Guru Tech/persistentSettings.js';
    import CONFIG from './Guru Tech/config.js';
    import { applyRuntimeSettings } from './Guru Tech/runtimeSettings.js';
    import { getGroupSecurity } from './Guru Tech/groupSecurity.js';
    await initializePersistentSettings();
    await bindSettingsToSession('test-session-a');
    applyRuntimeSettings(CONFIG);
    console.log(JSON.stringify({ config: {
      MODE: CONFIG.MODE, PREFIXES: CONFIG.PREFIXES, AUTO_VIEW: CONFIG.AUTO_VIEW, AUTO_LIKE: CONFIG.AUTO_LIKE,
      AUTO_READ: CONFIG.AUTO_READ, AUTO_REPLY_STATUS: CONFIG.AUTO_REPLY_STATUS, ALWAYS_ONLINE: CONFIG.ALWAYS_ONLINE,
      STATUS_LIKE_EMOJI: CONFIG.STATUS_LIKE_EMOJI, BOT_NAME: CONFIG.BOT_NAME
    }, group: getGroupSecurity('${groupJid}') }));
  `
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: projectRoot, env: childEnv, encoding: 'utf8'
  })
  const restored = JSON.parse(output.trim().split('\n').at(-1))
  assert.equal(restored.config.BOT_NAME, 'Guru Test Name')
  assert.deepEqual(restored.config.PREFIXES, ['#'])
  assert.equal(restored.config.AUTO_VIEW, false)
  assert.equal(restored.config.AUTO_LIKE, false)
  assert.equal(restored.config.AUTO_REPLY_STATUS, true)
  assert.equal(restored.config.ALWAYS_ONLINE, false)
  assert.equal(restored.group.antiBot.enabled, true)
  assert.equal(restored.group.antiBot.action, 'kick')
  assert.equal(restored.group.antiLink.enabled, true)
  assert.equal(restored.group.antiLink.sensitivity, 'strict')
  assert.deepEqual(restored.group.antiLink.allowedDomains, ['example.com'])
  assert.equal(restored.group.slowmodeSeconds, 30)
  assert.equal(restored.group.rules, 'Be respectful.')
})

test('Heroku deploy form exposes only session ID and owner number', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  assert.deepEqual(Object.keys(manifest.env).sort(), ['OWNER_NUMBER', 'SESSION_ID'])
})

test('manual restart cooldown blocks a second restart inside the 24-hour window', async () => {
  const previousDyno = process.env.DYNO
  delete process.env.DYNO
  try {
    await writeSettingsNamespace('process-control', {
      lastManualRestartAt: Date.now() - 60 * 60 * 1000,
      sessionFingerprint: JSON.parse(fs.readFileSync(controlPath, 'utf8')).sessionFingerprint
    })
    const restart = userCommands.find(item => item.name === 'restart')
    const { messages, sock } = fakeCommandContext()
    await restart.execute({ sock, from: '254700000001@s.whatsapp.net', msg: { key: {} } })
    assert.match(messages.at(-1).content.text, /limited to once every 24 hours/i)
  } finally {
    if (previousDyno === undefined) delete process.env.DYNO
    else process.env.DYNO = previousDyno
  }
})

test('changing the bound session ID clears prior account settings', async () => {
  const result = await bindSettingsToSession('test-session-b')
  assert.equal(result.changed, true)
  const restoredConfig = { MODE: 'private', AUTO_VIEW: true, BOT_NAME: 'BLACK PANTHER' }
  applyRuntimeSettings(restoredConfig)
  assert.deepEqual(restoredConfig, { MODE: 'private', AUTO_VIEW: true, BOT_NAME: 'BLACK PANTHER' })
  assert.equal(groupSecurity.getGroupSecurity('120363000000001@g.us').antiBot.enabled, false)
})
