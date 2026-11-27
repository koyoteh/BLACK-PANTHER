import test from 'node:test'
import assert from 'node:assert/strict'
import { commands } from '../commands/WhatsApp.js'

test('`.vvx` uses BLACK PANTHER in-chat view-once recovery', () => {
  const command = commands.find(entry => entry.name === 'vv')
  assert.ok(command)
  assert.ok(command.aliases.includes('vvx'))
})

test('`.retrieve` uses BLACK PANTHER owner-inbox view-once recovery', () => {
  const command = commands.find(entry => entry.name === 'vv2')
  assert.ok(command)
  assert.ok(command.aliases.includes('retrieve'))
})
