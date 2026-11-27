import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const testDir = mkdtempSync(path.join(tmpdir(), 'ultra-guru-command-permissions-'))
process.env.GROUP_SECURITY_FILE = path.join(testDir, 'group-security.json')

const { getCommandPermissionFailure } = await import('../../Guru Tech/commandPermissions.js')
const { MESSAGES } = await import('../france/config.js')

after(() => rmSync(testDir, { recursive: true, force: true }))

const groupJid = '120363000000009999@g.us'
const adminJid = '254700000002@s.whatsapp.net'
const memberJid = '254700000001@s.whatsapp.net'
const botJid = '254700000099@s.whatsapp.net'

function makeSock({ admin = false, botAdmin = true, fail = false } = {}) {
  return {
    user: { id: botJid },
    groupMetadata: async () => {
      if (fail) throw new Error('metadata unavailable')
      return { participants: [
        { id: botJid, admin: botAdmin ? 'admin' : null },
        { id: adminJid, admin: admin ? 'admin' : null },
        { id: memberJid, admin: null }
      ] }
    }
  }
}

test('blocks non-admin use of an admin-only group command with BLACK PANTHER wording', async () => {
  const failure = await getCommandPermissionFailure({
    command: { adminOnly: true }, sock: makeSock(), from: groupJid,
    senderJid: memberJid, isGroup: true, isOwner: false
  })
  assert.equal(failure, MESSAGES.adminOnly)
})

test('defers to command-local permission checks when explicitly marked', async () => {
  const failure = await getCommandPermissionFailure({
    command: { adminOnly: true, permissionHandled: true }, sock: makeSock(), from: groupJid,
    senderJid: memberJid, isGroup: true, isOwner: false
  })
  assert.equal(failure, null)
})

test('allows a current group admin and refreshes roles on each permission decision', async () => {
  let admin = true
  const sock = {
    ...makeSock(),
    groupMetadata: async () => ({ participants: [
      { id: botJid, admin: 'admin' },
      { id: adminJid, admin: admin ? 'admin' : null }
    ] })
  }
  const command = { adminOnly: true }
  assert.equal(await getCommandPermissionFailure({ command, sock, from: groupJid, senderJid: adminJid, isGroup: true, isOwner: false }), null)
  admin = false
  assert.equal(await getCommandPermissionFailure({ command, sock, from: groupJid, senderJid: adminJid, isGroup: true, isOwner: false }), MESSAGES.adminOnly)
})

test('blocks non-owner use of owner-only commands and lets the bot owner continue', async () => {
  const command = { ownerOnly: true }
  assert.equal(await getCommandPermissionFailure({ command, sock: makeSock(), from: '254700000001@s.whatsapp.net', isGroup: false, isOwner: false }), '❌ This command is restricted to the bot owner.')
  assert.equal(await getCommandPermissionFailure({ command, sock: makeSock(), from: '254700000001@s.whatsapp.net', isGroup: false, isOwner: true }), null)
})

test('requires the bot to be an admin for group commands marked botAdminOnly', async () => {
  const failure = await getCommandPermissionFailure({
    command: { botAdminOnly: true }, sock: makeSock({ botAdmin: false }), from: groupJid,
    senderJid: adminJid, isGroup: true, isOwner: false
  })
  assert.equal(failure, MESSAGES.botAdminOnly)
})

test('fails closed when group roles cannot be fetched', async () => {
  const failure = await getCommandPermissionFailure({
    command: { adminOnly: true }, sock: makeSock({ fail: true }), from: `${groupJid}-unavailable`,
    senderJid: memberJid, isGroup: true, isOwner: false
  })
  assert.equal(failure, '❌ Could not read group permissions. Try again later.')
})
