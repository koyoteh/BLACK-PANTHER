import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { deflateSync } from 'node:zlib'

const storePath = path.join(os.tmpdir(), `ultra-guru-viewonce-${process.pid}-${Date.now()}.json`)
process.env.VIEW_ONCE_SENT_FILE = storePath

const { commands: whatsappCommands } = await import('../commands/WhatsApp.js')
const { commands: converterCommands } = await import('../commands/Convertor.js')
const { getSentViewOnce, saveSentViewOnce } = await import('../../Guru Tech/viewOnceSentStore.js')
const { getViewOnceBuffer, recoverViewOnceMediaMessage } = await import('../../Guru Tech/viewOnceAutoSave.js')
const { messageStore } = await import('../../Guru Tech/anti.js')

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

const vv = whatsappCommands.find(command => command.name === 'vv')
const vv2 = whatsappCommands.find(command => command.name === 'vv2')
const vvSave = whatsappCommands.find(command => command.name === 'vvsave')
const toViewOnce = whatsappCommands.find(command => command.name === 'toviewonce')
const toSticker = converterCommands.find(command => command.name === 'sticker')

after(() => {
  try { fs.unlinkSync(storePath) } catch {}
})

test('proactively requests reupload when the media key exists but URL and directPath are absent', async () => {
  const id = `proactive-${Date.now()}`
  const media = { mediaKey: Buffer.from('media-key'), mimetype: 'image/png' }
  const message = { key: { id, remoteJid: '120363000000000001@g.us' }, message: { viewOnceMessageV2: { message: { imageMessage: media } } } }
  let updates = 0
  let downloads = 0
  const recovered = await recoverViewOnceMediaMessage(message, {
    updateMediaMessage: async original => {
      updates++
      original.message.viewOnceMessageV2.message.imageMessage.directPath = '/refreshed-media-path'
      return original
    }
  }, {
    downloadMediaMessage: async original => {
      downloads++
      assert.equal(original.message.viewOnceMessageV2.message.imageMessage.directPath, '/refreshed-media-path')
      return samplePng
    }
  })
  assert.equal(updates, 1)
  assert.equal(downloads, 1)
  assert.deepEqual(recovered.buffer, samplePng)
})

test('retries once through updateMediaMessage after a 404 media URL', async () => {
  const id = `expired-url-${Date.now()}`
  const media = { mediaKey: Buffer.from('media-key'), directPath: '/expired-path', mimetype: 'image/png' }
  const message = { key: { id, remoteJid: '120363000000000001@g.us' }, message: { viewOnceMessageV2: { message: { imageMessage: media } } } }
  let updates = 0
  let downloads = 0
  const recovered = await recoverViewOnceMediaMessage(message, {
    updateMediaMessage: async original => {
      updates++
      original.message.viewOnceMessageV2.message.imageMessage.directPath = '/fresh-path'
      return original
    }
  }, {
    downloadMediaMessage: async original => {
      downloads++
      if (downloads === 1) throw Object.assign(new Error('media expired'), { status: 404 })
      assert.equal(original.message.viewOnceMessageV2.message.imageMessage.directPath, '/fresh-path')
      return samplePng
    }
  })
  assert.equal(updates, 1)
  assert.equal(downloads, 2)
  assert.deepEqual(recovered.buffer, samplePng)
})

test('.vv recovers a quoted view-once image and sends the recovered media', async () => {
  const id = `vv-command-${Date.now()}`
  const chat = '120363000000000001@g.us'
  const original = {
    key: { id, remoteJid: chat, participant: '254700000011@s.whatsapp.net' },
    message: { viewOnceMessageV2: { message: { imageMessage: { mediaKey: Buffer.from('vv-key'), directPath: '/vv-path', mimetype: 'image/png' } } } }
  }
  messageStore.set(id, original)
  const sent = []
  const sock = { sendMessage: async (...args) => { sent.push(args); return { key: { id: `vv-output-${sent.length}` } } } }
  const command = {
    key: { id: 'vv-command-message', remoteJid: chat, participant: '254700000099@s.whatsapp.net' },
    message: { extendedTextMessage: { text: '.vv', contextInfo: { stanzaId: id, quotedMessage: original.message, participant: original.key.participant } } }
  }
  try {
    await vv.execute({ sock, from: chat, msg: command, downloaders: { downloadMediaMessage: async () => samplePng } })
    assert.equal(sent[0][0], chat)
    assert.deepEqual(sent[0][1].image, samplePng)
    assert.equal(sent[1][1].react.text, '😍')
  } finally {
    messageStore.delete(id)
  }
})

test('.vv2 sends recovered media and attribution to the bot owner inbox', async () => {
  const id = `vv2-command-${Date.now()}`
  const chat = '120363000000000001@g.us'
  const sender = '254700000011@s.whatsapp.net'
  const owner = '254700000099@s.whatsapp.net'
  const original = {
    key: { id, remoteJid: chat, participant: sender },
    message: { viewOnceMessageV2: { message: { imageMessage: { mediaKey: Buffer.from('vv2-key'), directPath: '/vv2-path', mimetype: 'image/png' } } } }
  }
  messageStore.set(id, original)
  const sent = []
  const sock = {
    user: { id: owner },
    sendMessage: async (...args) => {
      sent.push(args)
      return { key: { id: `vv2-output-${sent.length}` } }
    },
    groupMetadata: async () => ({ subject: 'VV2 regression group' })
  }
  const command = {
    key: { id: 'vv2-command-message', remoteJid: chat, participant: owner },
    message: { extendedTextMessage: { text: '.vv2', contextInfo: { stanzaId: id, quotedMessage: original.message, participant: sender } } }
  }
  try {
    await vv2.execute({ sock, from: chat, msg: command, downloaders: { downloadMediaMessage: async () => samplePng } })
    assert.equal(sent[0][0], owner)
    assert.deepEqual(sent[0][1].image, samplePng)
    assert.match(sent[0][1].caption, /VIEW ONCE RETRIEVED/)
    assert.match(sent[0][1].caption, /Chat: Group/)
    assert.match(sent[0][1].caption, /Sender: @254700000011/)
    assert.deepEqual(sent[0][1].mentions, [sender])
    assert.equal(sent[1][1].react.text, '✅')
    assert.match(sent[2][1].text, /saved to your owner inbox/i)
    assert.equal(sent.length, 3)
  } finally {
    messageStore.delete(id)
  }
})

test('sends .vvsave media and sender/group attribution to the owner inbox', async () => {
  const id = `vvsave-${Date.now()}`
  const group = '120363000000000001@g.us'
  const sender = '254700000011@s.whatsapp.net'
  const owner = '254700000099@s.whatsapp.net'
  const media = { mediaKey: Buffer.from('source-key'), directPath: '/source-path', mimetype: 'image/png' }
  const original = { key: { id, remoteJid: group, participant: sender }, message: { viewOnceMessageV2: { message: { imageMessage: media } } } }
  messageStore.set(id, original)
  const sent = []
  const sock = {
    user: { id: owner },
    sendMessage: async (...args) => { sent.push(args); return { key: { id: `sent-${sent.length}` } } },
    groupMetadata: async () => ({ subject: 'Recovery test group' })
  }
  const trigger = {
    key: { id: `${id}-command`, remoteJid: group, participant: owner, fromMe: false },
    message: { extendedTextMessage: { text: '.vvsave', contextInfo: { stanzaId: id, quotedMessage: original.message, participant: sender } } }
  }
  try {
    await vvSave.execute({ sock, from: group, msg: trigger, isOwner: true, downloaders: { downloadMediaMessage: async () => samplePng } })
    assert.equal(sent[0][0], owner)
    assert.deepEqual(sent[0][1].image, samplePng)
    assert.match(sent[0][1].caption, /VIEW ONCE RETRIEVED/)
    assert.match(sent[0][1].caption, /Chat: Group/)
    assert.match(sent[0][1].caption, /Sender: @254700000011/)
    assert.deepEqual(sent[0][1].mentions, [sender])
    assert.equal(sent[1][1].react.text, '✅')
    assert.match(sent[2][1].text, /saved to your owner inbox/i)
    assert.equal(sent.length, 3)
  } finally {
    messageStore.delete(id)
  }
})

test('.vvsave denies non-owners and keeps failed sticker recovery private', async () => {
  const group = '120363000000000001@g.us'
  const owner = '254700000099@s.whatsapp.net'
  const denied = []
  const sock = { user: { id: owner }, sendMessage: async (...args) => denied.push(args) }
  await vvSave.execute({ sock, from: group, msg: { key: { remoteJid: group }, message: {} }, isOwner: false })
  assert.equal(denied.length, 1)
  assert.equal(denied[0][0], group)
  assert.match(denied[0][1].text, /restricted to the bot owner/)

  const id = `vvsave-sticker-${Date.now()}`
  const media = { mediaKey: Buffer.from('sticker-key'), directPath: '/sticker-path', mimetype: 'image/webp' }
  const original = { key: { id, remoteJid: group, participant: '254700000011@s.whatsapp.net' }, message: { viewOnceMessageV2: { message: { stickerMessage: media } } } }
  messageStore.set(id, original)
  const sends = []
  const stickerSock = { user: { id: owner }, sendMessage: async (...args) => sends.push(args) }
  const trigger = { key: { remoteJid: group, participant: owner }, message: { extendedTextMessage: { text: '.vvsave', contextInfo: { stanzaId: id, quotedMessage: original.message } } } }
  try {
    await vvSave.execute({
      sock: stickerSock,
      from: group,
      msg: trigger,
      isOwner: true,
      downloaders: {
        downloadMediaMessage: async () => { throw new Error('expired') },
        downloadContentFromMessage: async () => { throw new Error('expired') }
      }
    })
    assert.equal(sends.length, 1)
    assert.equal(sends[0][0], owner)
    assert.match(sends[0][1].text, /could not be recovered/i)
  } finally {
    messageStore.delete(id)
  }
})

test('.toviewonce wraps outgoing media and stores a bounded recovery copy', async () => {
  const chat = '120363000000000001@g.us'
  const sent = []
  const sock = {
    sendMessage: async (...args) => {
      sent.push(args)
      return sent.length === 1 ? { key: { id: 'outgoing-view-once-image' } } : { key: { id: `notice-${sent.length}` } }
    }
  }
  const input = {
    key: { id: 'source-image', remoteJid: chat },
    message: { imageMessage: { mimetype: 'image/png', caption: 'original caption' } },
    pushName: 'Owner'
  }
  await toViewOnce.execute({ sock, from: chat, text: 'new caption', msg: input, downloaders: { downloadMediaMessage: async () => samplePng } })
  assert.equal(sent[0][1].viewOnce, true)
  assert.deepEqual(sent[0][1].image, samplePng)
  assert.equal(sent[0][1].caption, 'new caption')
  const stored = getSentViewOnce('outgoing-view-once-image', chat)
  assert.deepEqual(stored.buffer, samplePng)
  assert.equal(stored.type, 'imageMessage')
  const recovered = await getViewOnceBuffer('outgoing-view-once-image', 'imageMessage', { viewOnce: true }, sock)
  assert.deepEqual(recovered, samplePng)
})

test('.toviewonce wraps text in a V2 view-once stanza', async () => {
  const chat = '120363000000000001@g.us'
  let relayed
  const sent = []
  const sock = {
    user: { id: '254700000099@s.whatsapp.net' },
    relayMessage: async (...args) => { relayed = args },
    sendMessage: async (...args) => sent.push(args)
  }
  await toViewOnce.execute({ sock, from: chat, text: 'hello @254700000011', msg: { key: { id: 'text-command', remoteJid: chat }, message: {} } })
  assert.equal(relayed[0], chat)
  assert.ok(relayed[1].viewOnceMessageV2)
  const textMessage = relayed[1].viewOnceMessageV2.message
  assert.equal(textMessage.extendedTextMessage.text, 'hello @254700000011')
  assert.deepEqual(textMessage.extendedTextMessage.contextInfo.mentionedJid, ['254700000011@s.whatsapp.net'])
  assert.equal(sent.length, 1)
})

test('.tosticker converts a cached view-once image using the common recovery helper', async () => {
  const id = `tosticker-${Date.now()}`
  const group = '120363000000000001@g.us'
  const media = { mediaKey: Buffer.from('sticker-image-key'), directPath: '/sticker-image', mimetype: 'image/png' }
  const original = { key: { id, remoteJid: group, participant: '254700000011@s.whatsapp.net' }, message: { viewOnceMessageV2: { message: { imageMessage: media } } } }
  messageStore.set(id, original)
  const sent = []
  const sock = { sendMessage: async (...args) => sent.push(args) }
  const command = {
    key: { id: 'tosticker-command', remoteJid: group, participant: '254700000099@s.whatsapp.net' },
    message: { extendedTextMessage: { text: '.tosticker', contextInfo: { stanzaId: id, quotedMessage: original.message } } },
    pushName: 'Owner'
  }
  try {
    await toSticker.execute({ sock, from: group, text: '', msg: command, downloaders: { downloadMediaMessage: async () => samplePng } })
    assert.equal(sent.length, 1)
    assert.ok(sent[0][1].sticker?.length)
  } finally {
    messageStore.delete(id)
  }
})

test('outgoing recovery store expires after three hours and evicts oldest data above 16 MB', () => {
  const clock = Date.now
  const savedAt = clock()
  try {
    Date.now = () => savedAt
    assert.equal(saveSentViewOnce({ chatId: 'chat-expiry', messageId: 'expiring-item', type: 'imageMessage', buffer: Buffer.from('expiry') }).stored, true)
    Date.now = () => savedAt + 4 * 60 * 60 * 1000
    assert.equal(getSentViewOnce('expiring-item', 'chat-expiry'), null)
    Date.now = clock

    const largeBuffer = Buffer.alloc(9 * 1024 * 1024, 0x61)
    assert.equal(saveSentViewOnce({ chatId: 'chat-cap', messageId: 'old-large-item', type: 'imageMessage', buffer: largeBuffer }).stored, true)
    assert.equal(saveSentViewOnce({ chatId: 'chat-cap', messageId: 'new-large-item', type: 'imageMessage', buffer: largeBuffer }).stored, true)
    assert.equal(getSentViewOnce('old-large-item', 'chat-cap'), null)
    assert.equal(getSentViewOnce('new-large-item', 'chat-cap').buffer.length, largeBuffer.length)
  } finally {
    Date.now = clock
  }
})
