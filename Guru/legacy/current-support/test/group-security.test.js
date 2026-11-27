import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const testDir = mkdtempSync(path.join(tmpdir(), 'ultra-guru-group-security-'))
process.env.GROUP_SECURITY_FILE = path.join(testDir, 'group-security.json')

const security = await import('../../Guru Tech/groupSecurity.js')
const { commands: moderationCommands } = await import('../commands/Moderation.js')

after(() => rmSync(testDir, { recursive: true, force: true }))

let nextId = 0
const botJid = '254700000099@s.whatsapp.net'
const memberJid = '254700000001@s.whatsapp.net'
const adminJid = '254700000002@s.whatsapp.net'

function newGroup() {
  return `12036300000000${String(++nextId).padStart(3, '0')}@g.us`
}

function makeSock({ senderJid = memberJid, senderIsAdmin = false, botIsAdmin = true } = {}) {
  const sent = []
  const participantUpdates = []
  return {
    sent,
    participantUpdates,
    user: { id: botJid },
    groupMetadata: async () => ({
      participants: [
        { id: botJid, admin: botIsAdmin ? 'admin' : null },
        { id: memberJid, admin: senderJid === memberJid && senderIsAdmin ? 'admin' : null },
        { id: adminJid, admin: senderJid === adminJid && senderIsAdmin ? 'admin' : null }
      ]
    }),
    sendMessage: async (jid, content, options) => {
      sent.push({ jid, content, options })
      return {}
    },
    groupParticipantsUpdate: async (...args) => {
      participantUpdates.push(args)
      return []
    }
  }
}

function groupMessage(groupJid, sender = memberJid, id = `security-${nextId}-${Date.now()}`) {
  return {
    key: { id, remoteJid: groupJid, participant: sender, fromMe: false },
    message: { conversation: '' }
  }
}

test('detects bare domains with uncommon TLDs without flagging email addresses', () => {
  assert.equal(security.containsLink('Try this short link: bit.ly/abc123'), true)
  assert.equal(security.containsLink('Visit a shop: example.shop'), true)
  assert.equal(security.containsLink('Contact person@example.shop for details'), false)
})

test('honors trusted domains without allowing lookalike hostnames', () => {
  assert.equal(security.containsLink('https://docs.trusted.com/page', 'high', ['trusted.com']), false)
  assert.equal(security.containsLink('https://nottrusted.com/page', 'high', ['trusted.com']), true)
})

test('detects a link inside a WhatsApp ephemeral-message wrapper', async () => {
  const groupJid = newGroup()
  const sock = makeSock()
  security.updateGroupSecurity(groupJid, state => {
    state.antiLink.enabled = true
    state.antiLink.action = 'warn'
    state.antiLink.sensitivity = 'high'
  })
  const msg = groupMessage(groupJid)
  msg.message = { ephemeralMessage: { message: { conversation: 'Check example.shop now' } } }

  const handled = await security.handleGroupSecurityMessage({
    sock, msg, groupJid, senderJid: memberJid, body: '', prefixes: ['.']
  })

  assert.equal(handled, true)
  assert.ok(sock.sent.some(({ content }) => content.text?.includes('links are not allowed')))
})

test('anti-link falls back to warn when the bot is not a group admin', async () => {
  const groupJid = newGroup()
  const sock = makeSock({ senderJid: adminJid, senderIsAdmin: true, botIsAdmin: false })
  const command = moderationCommands.find(entry => entry.name === 'antilink')

  await command.execute({
    sock, from: groupJid, msg: groupMessage(groupJid, adminJid), sender: adminJid,
    isOwner: false, text: 'on'
  })

  const state = security.getGroupSecurity(groupJid)
  assert.equal(state.antiLink.enabled, true)
  assert.equal(state.antiLink.action, 'warn')
  assert.ok(sock.sent.some(({ content }) => content.text?.includes('can warn but cannot remove links')))
})

test('the antibot command enables kick mode by default', async () => {
  const groupJid = newGroup()
  const sock = makeSock({ senderJid: adminJid, senderIsAdmin: true })
  const command = moderationCommands.find(entry => entry.name === 'antibot')

  await command.execute({
    sock, from: groupJid, msg: groupMessage(groupJid, adminJid), sender: adminJid,
    isOwner: false, text: 'on'
  })

  const state = security.getGroupSecurity(groupJid)
  assert.equal(state.antiBot.enabled, true)
  assert.equal(state.antiBot.action, 'kick')
})

test('antibot kick mode removes a non-admin who sends a bot command', async () => {
  const groupJid = newGroup()
  const sock = makeSock()
  security.updateGroupSecurity(groupJid, state => {
    state.antiBot.enabled = true
    state.antiBot.action = 'kick'
  })
  const msg = groupMessage(groupJid)
  msg.message = { conversation: '.menu' }

  const handled = await security.handleGroupSecurityMessage({
    sock, msg, groupJid, senderJid: memberJid, body: '.menu', prefixes: ['.'],
    isOwnCommandText: () => true
  })

  assert.equal(handled, true)
  assert.deepEqual(sock.participantUpdates, [[groupJid, [memberJid], 'remove']])
  assert.ok(sock.sent.some(({ content }) => content.delete))
  assert.ok(sock.sent.some(({ content }) => content.text?.includes('removed by anti-bot moderation')))
})

test('antibot never kicks a group admin for a bot command', async () => {
  const groupJid = newGroup()
  const sock = makeSock({ senderJid: adminJid, senderIsAdmin: true })
  security.updateGroupSecurity(groupJid, state => {
    state.antiBot.enabled = true
    state.antiBot.action = 'kick'
  })
  const msg = groupMessage(groupJid, adminJid)
  msg.message = { conversation: '!play song' }

  const handled = await security.handleGroupSecurityMessage({
    sock, msg, groupJid, senderJid: adminJid, body: '!play song', prefixes: ['.']
  })

  assert.equal(handled, false)
  assert.deepEqual(sock.participantUpdates, [])
})

test('antibot never blocks or kicks the configured bot owner for a command', async () => {
  const groupJid = newGroup()
  const sock = makeSock()
  await security.updateGroupSecurity(groupJid, state => {
    state.antiBot.enabled = true
    state.antiBot.action = 'kick'
  })
  const msg = groupMessage(groupJid)
  msg.message = { conversation: '.settings' }

  const handled = await security.handleGroupSecurityMessage({
    sock, msg, groupJid, senderJid: memberJid, body: '.settings', prefixes: ['.'],
    isOwnCommandText: () => true, isOwner: true
  })

  assert.equal(handled, false)
  assert.deepEqual(sock.participantUpdates, [])
  assert.equal(sock.sent.length, 0)
})
