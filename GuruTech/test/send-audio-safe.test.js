import test from 'node:test';
import assert from 'node:assert/strict';
import { sendAudioSafe } from '../lib/sendAudioSafe.js';

test('sends song artwork with its caption before the audio', async () => {
  const calls = [];
  const client = {
    sendMessage: async (...args) => {
      calls.push(args);
      return { key: { id: String(calls.length) } };
    }
  };
  const quoted = { key: { id: 'request' } };
  const audio = Buffer.from('mock audio');

  await sendAudioSafe(client, 'group@g.us', audio, {
    title: 'Song title',
    quoted,
    caption: 'Track info',
    mimetype: 'audio/mpeg',
    thumbnail: 'https://images.example/song.jpg'
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'group@g.us');
  assert.deepEqual(calls[0][1], {
    image: { url: 'https://images.example/song.jpg' },
    caption: 'Track info'
  });
  assert.deepEqual(calls[0][2], { quoted });
  assert.deepEqual(calls[1][1], {
    audio,
    mimetype: 'audio/mpeg',
    ptt: false,
    fileName: 'Song title.mp3'
  });
  assert.deepEqual(calls[1][2], { quoted });
});

test('still sends the audio when the artwork cannot be sent', async () => {
  const calls = [];
  let firstImageAttempt = true;
  const client = {
    sendMessage: async (...args) => {
      calls.push(args);
      if (args[1]?.image && firstImageAttempt) {
        firstImageAttempt = false;
        throw new Error('thumbnail unavailable');
      }
      return { key: { id: String(calls.length) } };
    }
  };
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    await sendAudioSafe(client, 'group@g.us', Buffer.from('mock audio'), {
      caption: 'Track info',
      thumbnail: 'https://images.example/song.jpg'
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(calls.length, 3);
  assert.ok(calls[0][1].image);
  assert.deepEqual(calls[1][1], { text: 'Track info' });
  assert.ok(Buffer.isBuffer(calls[2][1].audio));
});
