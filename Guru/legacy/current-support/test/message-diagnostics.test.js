import test from 'node:test'
import assert from 'node:assert/strict'
import { createMessageDiagnostics, recordMessageUpsert } from '../../Guru Tech/messageDiagnostics.js'

test('records upsert batches and message counts without storing message content', () => {
  const diagnostics = createMessageDiagnostics()
  const at = '2026-11-26T00:00:00.000Z'
  const messages = recordMessageUpsert(diagnostics, {
    type: 'notify',
    messages: [
      { key: { id: 'visible-id' }, message: { conversation: 'private text' } },
      { key: { id: 'stub-id' }, messageStubType: 2 }
    ]
  }, at)

  assert.equal(messages.length, 2)
  assert.deepEqual(diagnostics, {
    upsertBatches: 1,
    messagesSeen: 2,
    messagesWithoutPayload: 1,
    lastUpsertAt: at,
    lastUpsertType: 'notify',
    lastMessageAt: at
  })
  assert.equal(JSON.stringify(diagnostics).includes('private text'), false)
})

test('safely counts empty or malformed upsert events', () => {
  const diagnostics = createMessageDiagnostics()
  assert.deepEqual(recordMessageUpsert(diagnostics, undefined, '2026-11-26T00:00:01.000Z'), [])
  assert.deepEqual(recordMessageUpsert(diagnostics, { type: 'append', messages: null }, '2026-11-26T00:00:02.000Z'), [])
  assert.equal(diagnostics.upsertBatches, 2)
  assert.equal(diagnostics.messagesSeen, 0)
  assert.equal(diagnostics.lastUpsertType, 'append')
  assert.equal(diagnostics.lastMessageAt, null)
})
