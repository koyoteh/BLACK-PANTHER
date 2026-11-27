import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCompleteMp3, durationSeconds, mp3DurationSeconds } from '../lib/audioIntegrity.js';

function makeMp3FrameCount(count, withId3 = false) {
  const frameSize = 417; // MPEG-1 Layer III, 128 kbps, 44.1 kHz
  const prefix = withId3 ? Buffer.from('ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000', 'binary') : Buffer.alloc(0);
  const audio = Buffer.alloc(frameSize * count);
  for (let offset = 0; offset < audio.length; offset += frameSize) {
    audio.set([0xff, 0xfb, 0x90, 0x64], offset);
  }
  return Buffer.concat([prefix, audio]);
}

test('MP3 duration parser skips ID3 metadata and accepts a complete track', () => {
  const complete = makeMp3FrameCount(1600, true);
  const expectedSeconds = 1600 * 1152 / 44100;
  const result = assertCompleteMp3(complete, expectedSeconds);

  assert.ok(Math.abs(mp3DurationSeconds(complete) - expectedSeconds) < 0.001);
  assert.equal(result.checked, true);
  assert.ok(Math.abs(result.duration - expectedSeconds) < 0.001);
});

test('MP3 duration guard rejects a buffer that ends before the expected track duration', () => {
  const complete = makeMp3FrameCount(1600);
  const missingFrames = 400;
  const truncated = complete.subarray(0, complete.length - missingFrames * 417);
  const expectedSeconds = 1600 * 1152 / 44100;

  assert.throws(() => assertCompleteMp3(truncated, expectedSeconds), /incomplete/);
});

test('duration parser supports seconds and minute-second metadata', () => {
  assert.equal(durationSeconds(214), 214);
  assert.equal(durationSeconds('3:34'), 214);
  assert.equal(durationSeconds('0:03:34'), 214);
  assert.equal(durationSeconds('unknown'), null);
});

test('malformed ID3-only payload is not sent as a playable MP3', () => {
  const invalid = Buffer.from('ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000', 'binary');
  assert.throws(() => assertCompleteMp3(invalid, 214), /no complete MPEG audio frames/);
});
