import test from 'node:test'
import assert from 'node:assert/strict'
import { handleDeletedMessage, messageStore } from '../../Guru Tech/anti.js'

function makeDeleteEvent(id, chatJid, deleterJid = '254700000001@s.whatsapp.net') {
  return {
    key: { id: `revoke-${id}`, remoteJid: chatJid, participant: deleterJid, fromMe: false },
    message: { protocolMessage: { type: 0, key: { id } } }
  }
}

function makeSock() {
  const sent = []
  return {
    sent,
    user: { id: '254700000099:7@s.whatsapp.net' },
    onWhatsApp: async () => [],
    sendMessage: async (...args) => { sent.push(args); return {} }
  }
}

test('anti-delete does not forward a same-ID cache entry from a different chat', async () => {
  const id = `cross-chat-${Date.now()}`
  const chatA = '254700000001@s.whatsapp.net'
  const chatB = '254700000002@s.whatsapp.net'
  const sock = makeSock()
  messageStore.set(id, {
    key: { id, remoteJid: chatA },
    message: { conversation: 'belongs to another chat' },
    timestamp: Date.now()
  })

  try {
    await handleDeletedMessage(makeDeleteEvent(id, chatB), sock, msg => msg.key.participant, () => null, new Map())
    assert.equal(sock.sent.length, 0)
    assert.ok(messageStore.has(id))
  } finally {
    messageStore.delete(id)
  }
})

test('anti-delete forwards to the normalized linked bot JID when no owner JID is configured', async () => {
  const id = `owner-fallback-${Date.now()}`
  const chatJid = '254700000001@s.whatsapp.net'
  const sock = makeSock()
  messageStore.set(id, {
    key: { id, remoteJid: chatJid },
    message: { conversation: 'sample deleted text' },
    timestamp: Date.now()
  })

  try {
    await handleDeletedMessage(makeDeleteEvent(id, chatJid), sock, msg => msg.key.participant, () => null, new Map())
    assert.equal(sock.sent.length, 2)
    assert.equal(sock.sent[0][0], '254700000099@s.whatsapp.net')
    assert.ok(sock.sent[0][1].text.includes('BLACK PANTHER ANTI-DELETE'))
    assert.equal(sock.sent[1][0], '254700000099@s.whatsapp.net')
    assert.equal(sock.sent[1][1].forward.key.id, id)
    assert.equal(messageStore.has(id), false)
  } finally {
    messageStore.delete(id)
  }
})
