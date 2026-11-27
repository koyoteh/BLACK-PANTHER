import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayAudioCaption, sendPlayAudio } from '../lib/playAudio.js';

const song = {
  title: 'Gamble',
  artist: 'Sauti Sol',
  duration: '245',
  videoId: 'abcdefghijk',
  videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk'
};

test('`.play <song>` sends a compact thumbnail preview and then audio as a separate message', async () => {
  const sent = [];
  const thumbnail = Buffer.from('small song thumbnail');
  const audio = Buffer.from('complete mp3 content');
  const message = { chat: 'chat@s.whatsapp.net', sender: 'sender@s.whatsapp.net', key: { id: 'quoted-message' } };
  const client = {
    sendMessage: async (...args) => {
      sent.push(args);
      return { key: { id: `sent-${sent.length}` } };
    }
  };

  const result = await sendPlayAudio(client, message, song, { buffer: audio, format: 'mp3' }, {
    thumbnailBuffer: thumbnail
  });

  assert.equal(sent.length, 2);
  const [previewChat, preview, previewOptions] = sent[0];
  assert.equal(previewChat, message.chat);
  assert.match(preview.text, /\*Gamble\*/);
  assert.match(preview.text, /Sauti Sol · 4:05/);
  assert.deepEqual(preview.contextInfo.externalAdReply.thumbnail, thumbnail);
  assert.equal(preview.contextInfo.externalAdReply.renderLargerThumbnail, false);
  assert.equal(preview.contextInfo.externalAdReply.sourceUrl, song.videoUrl);
  assert.equal(previewOptions.quoted, message);
  assert.equal(preview.interactiveMessage, undefined);
  assert.equal(preview.buttons, undefined);
  assert.equal(preview.audio, undefined);

  const [audioChat, audioMessage, audioOptions] = sent[1];
  assert.equal(audioChat, message.chat);
  assert.deepEqual(audioMessage.audio, audio);
  assert.equal(audioMessage.mimetype, 'audio/mpeg');
  assert.equal(audioMessage.ptt, false);
  assert.equal(audioMessage.fileName, 'Gamble.mp3');
  assert.equal(audioOptions.quoted, message);
  assert.equal(result.buffer, audio);
  assert.equal(result.thumbnail, thumbnail);
});

test('play preview remains readable when artist or duration metadata is missing', () => {
  const caption = buildPlayAudioCaption({ title: 'Track without metadata' });
  assert.match(caption, /\*Track without metadata\*/);
  assert.doesNotMatch(caption, /undefined|null/);
});
