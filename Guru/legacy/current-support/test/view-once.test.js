import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { deflateSync } from 'node:zlib'
import { getViewOnceBuffer, getViewOnceMedia, getViewOnceMediaById, installViewOnceAutoSave, recoverViewOnceMediaMessage } from '../../Guru Tech/viewOnceAutoSave.js'
import { messageStore } from '../../Guru Tech/anti.js'

const image = { url: 'https://example.invalid/media', mediaKey: Buffer.from('key'), mimetype: 'image/jpeg' }
const video = { url: 'https://example.invalid/video', mediaKey: Buffer.from('key'), mimetype: 'video/mp4' }
const audio = { url: 'https://example.invalid/audio', mediaKey: Buffer.from('key'), mimetype: 'audio/ogg' }

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
  return Buffer.concat([length, typeBytes, data, checksum])
}

const samplePng = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
  pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
  pngChunk('IEND', Buffer.alloc(0))
])

async function waitFor(condition, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs
  while (!condition() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2))
  }
}

test('recognizes the v1 view-once wrapper', () => {
  const found = getViewOnceMedia({ viewOnceMessage: { message: { imageMessage: image } } })
  assert.equal(found.type, 'imageMessage')
  assert.equal(found.media, image)
})

test('recognizes v2 view-once nested under ephemeral messages', () => {
  const found = getViewOnceMedia({
    ephemeralMessage: {
      message: {
        viewOnceMessageV2: { message: { videoMessage: video } }
      }
    }
  })
  assert.equal(found.type, 'videoMessage')
  assert.equal(found.media, video)
})

test('recognizes the v2 extension wrapper with audio', () => {
  const found = getViewOnceMedia({
    viewOnceMessageV2Extension: { message: { audioMessage: audio } }
  })
  assert.equal(found.type, 'audioMessage')
  assert.equal(found.media, audio)
})

test('recognizes view-once documents and stickers nested under caption wrappers', () => {
  const document = { mediaKey: Buffer.from('document-key'), directPath: '/document', mimetype: 'application/pdf' }
  const sticker = { mediaKey: Buffer.from('sticker-key'), directPath: '/sticker', mimetype: 'image/webp' }
  const documentFound = getViewOnceMedia({ documentWithCaptionMessage: { message: { viewOnceMessageV2: { message: { documentMessage: document } } } } })
  const stickerFound = getViewOnceMedia({ viewOnceMessageV2: { message: { stickerMessage: sticker } } })
  assert.equal(documentFound.type, 'documentMessage')
  assert.equal(documentFound.media, document)
  assert.equal(stickerFound.type, 'stickerMessage')
  assert.equal(stickerFound.media, sticker)
})

test('recognizes media-level viewOnce flag without a wrapper', () => {
  const flagged = { ...image, viewOnce: true }
  assert.equal(getViewOnceMedia({ imageMessage: flagged }).media, flagged)
})

test('does not treat ordinary media as view-once', () => {
  assert.equal(getViewOnceMedia({ imageMessage: image }), null)
  assert.equal(getViewOnceMedia({ videoMessage: video }), null)
  assert.equal(getViewOnceMedia({ audioMessage: audio }), null)
})

test('looks up quoted view-once media by its original message id', () => {
  const id = `view-once-test-${Date.now()}`
  const original = {
    key: { id, remoteJid: '254700000001@s.whatsapp.net' },
    message: { viewOnceMessageV2: { message: { imageMessage: image } } },
    timestamp: Date.now()
  }
  messageStore.set(id, original)
  try {
    assert.equal(getViewOnceMediaById(id, null).media, image)
  } finally {
    messageStore.delete(id)
  }
})

test('prefers the original media key when the quoted copy has been stripped', () => {
  const id = `view-once-key-test-${Date.now()}`
  const originalMedia = { ...image, mediaKey: Buffer.from('original-key') }
  const strippedQuote = { ...image, mediaKey: undefined, directPath: undefined, url: undefined }
  messageStore.set(id, {
    key: { id, remoteJid: '254700000001@s.whatsapp.net' },
    message: { viewOnceMessageV2: { message: { imageMessage: originalMedia } } },
    timestamp: Date.now()
  })
  try {
    const result = getViewOnceMediaById(id, {
      viewOnceMessageV2: { message: { imageMessage: strippedQuote } }
    })
    assert.equal(result.media, originalMedia)
    assert.equal(result.media.mediaKey.toString(), 'original-key')
  } finally {
    messageStore.delete(id)
  }
})

test('recovers a sample view-once PNG when the full-message downloader returns empty', async () => {
  const id = `view-once-recovery-test-${Date.now()}`
  const media = { mediaKey: Buffer.from('sample-media-key'), directPath: '/sample', mimetype: 'image/png' }
  messageStore.set(id, {
    key: { id, remoteJid: '120363000000000001@g.us', fromMe: false },
    message: { viewOnceMessageV2: { message: { imageMessage: media } } },
    timestamp: Date.now()
  })

  let innerDownloadCalls = 0
  const recovered = await getViewOnceBuffer(id, 'imageMessage', media, {}, {
    downloadMediaMessage: async () => Buffer.alloc(0),
    downloadContentFromMessage: async (candidate, kind) => {
      innerDownloadCalls++
      assert.equal(candidate, media)
      assert.equal(kind, 'image')
      return Readable.from([samplePng])
    }
  })
  assert.deepEqual(recovered, samplePng)
  assert.equal(innerDownloadCalls, 1)

  // The successful fallback is cached for subsequent `.vv` / `.vv2` requests.
  const secondRead = await getViewOnceBuffer(id, 'imageMessage', media, {})
  assert.deepEqual(secondRead, samplePng)
  messageStore.delete(id)
})

test('uses the view-once-specific downloader and passes a reupload callback', async () => {
  const source = {
    key: { id: `view-once-helper-${Date.now()}`, remoteJid: '254700000001@s.whatsapp.net' },
    message: { viewOnceMessageV2: { message: { imageMessage: image } } }
  }
  let called = false
  const recovered = await recoverViewOnceMediaMessage(source, {}, {
    downloadViewOnceMessage: async (message, type, options, context) => {
      called = true
      assert.equal(message, source)
      assert.equal(type, 'buffer')
      assert.deepEqual(options, {})
      assert.equal(typeof context.reuploadRequest, 'function')
      assert.equal(typeof context.logger.info, 'function')
      return samplePng
    }
  })
  assert.equal(called, true)
  assert.deepEqual(recovered.buffer, samplePng)
})

test('automatically forwards a newly received view-once to the owner inbox without a command', async () => {
  const id = `view-once-auto-inbox-test-${Date.now()}`
  const sender = '254700000001@s.whatsapp.net'
  const owner = '254700000099@s.whatsapp.net'
  const original = {
    key: { id, remoteJid: sender, fromMe: false },
    message: { viewOnceMessageV2: { message: { imageMessage: { mediaKey: Buffer.from('auto-inbox-key'), directPath: '/auto-inbox', mimetype: 'image/png' } } } },
    messageTimestamp: Math.floor(Date.now() / 1000)
  }
  const sock = {
    ev: new EventEmitter(),
    user: { id: owner },
    sendMessage: async (...args) => sent.push(args)
  }
  const sent = []
  installViewOnceAutoSave(sock, { downloadMediaMessage: async () => samplePng })
  sock.ev.emit('messages.upsert', { type: 'notify', messages: [original] })
  await waitFor(() => sent.length > 0)

  // One-message format with sender, chat, and time carried in the caption.
  assert.equal(sent.length, 1)
  assert.equal(sent[0][0], owner)
  assert.deepEqual(sent[0][1].image, samplePng)
  assert.match(sent[0][1].caption, /VIEW ONCE RETRIEVED/)
  assert.match(sent[0][1].caption, /Sender: @254700000001/)

  // Once forwarded automatically, a later owner reaction is not a duplicate.
  sock.ev.emit('messages.upsert', {
    type: 'notify',
    messages: [{
      key: { id: `${id}-reaction`, remoteJid: sender, fromMe: true, participant: owner },
      message: { reactionMessage: { key: original.key, text: '👍' } }
    }]
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(sent.length, 1)
})

test('does not pretend to save an unavailable view-once stub with no message payload', async () => {
  const id = `view-once-unavailable-stub-${Date.now()}`
  const listeners = new Map()
  const sent = []
  const sock = {
    ev: new EventEmitter(),
    ws: { on: (event, handler) => listeners.set(event, handler) },
    user: { id: '254700000099@s.whatsapp.net' },
    sendMessage: async (...args) => sent.push(args)
  }
  installViewOnceAutoSave(sock)
  listeners.get('CB:message')({
    attrs: { id, from: '254700000001@s.whatsapp.net', type: 'media' },
    content: [{ tag: 'unavailable', attrs: { type: 'view_once' } }]
  })
  sock.ev.emit('messages.upsert', {
    type: 'notify',
    messages: [{
      key: { id, remoteJid: '254700000001@s.whatsapp.net', fromMe: false },
      messageStubType: 2,
      messageStubParameters: []
    }]
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(sent.length, 0)
})

test('only owner reactions/replies trigger auto-save; others are ignored and commands are not duplicated', async () => {
  const id = `view-once-group-trigger-test-${Date.now()}`
  const media = { mediaKey: Buffer.from('group-sample-key'), directPath: '/group-sample', mimetype: 'image/png' }
  const original = {
    key: { id, remoteJid: '120363000000000001@g.us', participant: '254700000001@s.whatsapp.net', fromMe: false },
    message: { viewOnceMessageV2: { message: { imageMessage: media } } },
    messageTimestamp: Math.floor(Date.now() / 1000)
  }
  const sock = {
    ev: new EventEmitter(),
    user: { id: '254700000099@s.whatsapp.net' },
    sendMessage: async (...args) => sent.push(args)
  }
  const sent = []
  messageStore.set(id, original)
  installViewOnceAutoSave(sock, { downloadMediaMessage: async () => samplePng })
  sock.ev.emit('messages.upsert', { type: 'notify', messages: [original] })
  await waitFor(() => sent.length > 0)

  sock.ev.emit('messages.upsert', {
    messages: [{
      key: { id: `${id}-reaction`, remoteJid: original.key.remoteJid, participant: '254700000002@s.whatsapp.net', fromMe: false },
      message: { reactionMessage: { key: original.key, text: '👍' } }
    }]
  })
  sock.ev.emit('messages.upsert', {
    messages: [{
      key: { id: `${id}-reply`, remoteJid: original.key.remoteJid, participant: '254700000003@s.whatsapp.net', fromMe: false },
      message: { extendedTextMessage: { text: 'nice', contextInfo: { stanzaId: id, quotedMessage: original.message } } }
    }]
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(sent.length, 1)

  const ownerKey = { remoteJid: original.key.remoteJid, participant: sock.user.id, fromMe: true }
  sock.ev.emit('messages.upsert', {
    messages: [{ key: { ...ownerKey, id: `${id}-owner-reaction` }, message: { reactionMessage: { key: original.key, text: '👍' } } }]
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(sent.length, 1)
  assert.equal(sent[0][0], sock.user.id)
  assert.match(sent[0][1].caption, /VIEW ONCE RETRIEVED/)
  assert.match(sent[0][1].caption, /Chat: Group/)

  sock.ev.emit('messages.upsert', {
    messages: [{
      key: { ...ownerKey, id: `${id}-owner-reply` },
      message: { extendedTextMessage: { text: 'save this', contextInfo: { stanzaId: id, quotedMessage: original.message } } }
    }]
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(sent.length, 1)

  for (const command of ['.vv', '.vv2']) {
    sock.ev.emit('messages.upsert', {
      messages: [{
        key: { ...ownerKey, id: `${id}-command-${command.slice(1)}` },
        message: { extendedTextMessage: { text: command, contextInfo: { stanzaId: id, quotedMessage: original.message } } }
      }]
    })
  }
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(sent.length, 1)
  messageStore.delete(id)
})
