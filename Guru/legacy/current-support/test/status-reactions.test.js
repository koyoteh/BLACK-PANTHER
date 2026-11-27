import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import CONFIG from '../../Guru Tech/config.js'
import { processStatusMessage, seenStatusIds } from '../../Guru Tech/bc.js'
import { chooseStatusReactionEmoji, DEFAULT_STATUS_REACTIONS, isSingleEmoji, normalizeStatusReaction } from '../../Guru Tech/statusReactions.js'

test('default random pool has 25 status emojis', () => {
  assert.deepEqual(DEFAULT_STATUS_REACTIONS, [
    '❤️', '🔥', '😂', '😍', '👏', '🥰', '💯', '😭', '🤣', '🙏', '👌', '💪',
    '🤩', '😎', '🥳', '✨', '💀', '🤯', '😤', '💅', '👀', '🎉', '😈', '🤫', '🫶'
  ])
})

test('fixed emoji is used for every status reaction', () => {
  assert.equal(chooseStatusReactionEmoji('🔥', () => 0), '🔥')
})

test('random mode uses the default pool or the legacy custom pool', () => {
  assert.equal(chooseStatusReactionEmoji('random', () => 0), '❤️')
  assert.equal(chooseStatusReactionEmoji('random', () => 0.999999), '🫶')
  assert.equal(chooseStatusReactionEmoji('random', () => 0.99, ['🌿', '🐾']), '🐾')
})

test('one-emoji validation accepts graphemes and rejects text or multiple emojis', () => {
  assert.equal(isSingleEmoji('❤️'), true)
  assert.equal(isSingleEmoji('👨‍👩‍👧‍👦'), true)
  assert.equal(isSingleEmoji('🔥😂'), false)
  assert.equal(isSingleEmoji('hello'), false)
  assert.equal(normalizeStatusReaction('random'), 'random')
  assert.equal(normalizeStatusReaction('several words'), 'random')
})

test('status viewing prefers sendReceipt and keeps the LID participant for the receipt', async () => {
  const oldView = CONFIG.AUTO_VIEW
  const oldLike = CONFIG.AUTO_LIKE
  const receiptCalls = []
  const readCalls = []
  const id = `status-send-receipt-${Date.now()}`
  CONFIG.AUTO_VIEW = true
  CONFIG.AUTO_LIKE = false
  try {
    await processStatusMessage({
      key: { id, remoteJid: 'status@broadcast', participant: '12345@lid', participantPn: '254700123456@s.whatsapp.net', fromMe: false },
      message: { conversation: 'status' }
    }, {
      sendReceipt: async (...args) => receiptCalls.push(args),
      readMessages: async (...args) => readCalls.push(args)
    })
    assert.deepEqual(receiptCalls, [['status@broadcast', '12345@lid', [id], 'read']])
    assert.equal(readCalls.length, 0)
  } finally {
    CONFIG.AUTO_VIEW = oldView
    CONFIG.AUTO_LIKE = oldLike
    seenStatusIds.delete(id)
  }
})

test('status viewing falls back to readMessages when sendReceipt fails', async () => {
  const oldView = CONFIG.AUTO_VIEW
  const oldLike = CONFIG.AUTO_LIKE
  const readCalls = []
  const id = `status-read-fallback-${Date.now()}`
  CONFIG.AUTO_VIEW = true
  CONFIG.AUTO_LIKE = false
  try {
    await processStatusMessage({
      key: { id, remoteJid: 'status@broadcast', participant: '12345@lid', participantPn: '254700123456@s.whatsapp.net', fromMe: false },
      message: { conversation: 'status' }
    }, {
      sendReceipt: async () => { throw new Error('unsupported') },
      readMessages: async (...args) => readCalls.push(args)
    })
    assert.equal(readCalls.length, 1)
    assert.equal(readCalls[0][0][0].remoteJid, 'status@broadcast')
    assert.equal(readCalls[0][0][0].participant, '254700123456@s.whatsapp.net')
  } finally {
    CONFIG.AUTO_VIEW = oldView
    CONFIG.AUTO_LIKE = oldLike
    seenStatusIds.delete(id)
  }
})

test('owner runtime settings persist emoji and status auto-like switches', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ultra-guru-status-'))
  const settingsPath = path.join(directory, 'runtime-settings.json')
  const previousPath = process.env.RUNTIME_SETTINGS_FILE
  process.env.RUNTIME_SETTINGS_FILE = settingsPath
  try {
    const { applyRuntimeSettings, updateRuntimeSettings } = await import(`../../Guru Tech/runtimeSettings.js?test=${Date.now()}`)
    const config = { AUTO_VIEW: false, AUTO_LIKE: false, STATUS_LIKE_EMOJI: 'random' }
    await updateRuntimeSettings(config, { AUTO_VIEW: true, AUTO_LIKE: true, STATUS_LIKE_EMOJI: '🔥' })
    assert.deepEqual(config, { AUTO_VIEW: true, AUTO_LIKE: true, STATUS_LIKE_EMOJI: '🔥' })

    const restartedConfig = { AUTO_VIEW: false, AUTO_LIKE: false, STATUS_LIKE_EMOJI: 'random' }
    applyRuntimeSettings(restartedConfig)
    assert.deepEqual(restartedConfig, config)
    assert.equal(JSON.parse(fs.readFileSync(settingsPath, 'utf8')).STATUS_LIKE_EMOJI, '🔥')
    await assert.rejects(updateRuntimeSettings(config, { STATUS_LIKE_EMOJI: 'not an emoji' }), /Unsupported runtime setting/)
  } finally {
    if (previousPath === undefined) delete process.env.RUNTIME_SETTINGS_FILE
    else process.env.RUNTIME_SETTINGS_FILE = previousPath
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
