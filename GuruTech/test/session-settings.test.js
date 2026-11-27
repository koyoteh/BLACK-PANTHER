import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { decodeSessionPayload, getSessionDataFromEnv } from '../auth/auth.js';
import { DEFAULT_SETTINGS, mergeSettings } from '../config/defaults.js';

const syntheticCreds = {
  me: { id: '15551234567:1@s.whatsapp.net' },
  registered: true,
  signedIdentityKey: { private: { type: 'Buffer', data: [1, 2, 3] } }
};
const credsJson = JSON.stringify(syntheticCreds);
const base64 = (value) => Buffer.from(value).toString('base64');
const compressed = base64(gzipSync(Buffer.from(credsJson)));

function assertSyntheticCreds(parsed) {
  assert.equal(parsed.me.id, syntheticCreds.me.id);
  assert.deepEqual(parsed.signedIdentityKey, syntheticCreds.signedIdentityKey);
}

test('accepts the current GURU~ + base64(gzip(creds.json)) session ID', () => {
  const { parsed } = decodeSessionPayload(`GURU~${compressed}`);
  assertSyntheticCreds(parsed);
});

test('retains plain JSON and legacy base64 JSON session formats', () => {
  assertSyntheticCreds(decodeSessionPayload(credsJson).parsed);
  assertSyntheticCreds(decodeSessionPayload(base64(credsJson)).parsed);
});

test('retains gzip/base64 credentials without the GURU~ prefix', () => {
  assertSyntheticCreds(decodeSessionPayload(compressed).parsed);
});

test('retains multi-file bundle payloads', () => {
  const bundle = JSON.stringify({ files: { 'creds.json': base64(credsJson), 'app-state-sync-key-1.json': base64('{}') } });
  const { parsed } = decodeSessionPayload(base64(bundle));
  assert.equal(parsed.files['creds.json'], base64(credsJson));
  assert.equal(parsed.files['app-state-sync-key-1.json'], base64('{}'));
});

test('prefers SESSION_ID and keeps SESSION as a local compatibility fallback', () => {
  assert.equal(getSessionDataFromEnv({ SESSION_ID: 'GURU~current', SESSION: 'legacy' }), 'GURU~current');
  assert.equal(getSessionDataFromEnv({ SESSION: 'legacy' }), 'legacy');
  assert.equal(getSessionDataFromEnv({}), '');
});

test('rejects malformed session payloads', () => {
  assert.throws(() => decodeSessionPayload('not-a-session'), SyntaxError);
});

test('new-install defaults enable auto-view, auto-like, and online presence', () => {
  assert.equal(DEFAULT_SETTINGS.autoview, true);
  assert.equal(DEFAULT_SETTINGS.autolike, true);
  assert.equal(DEFAULT_SETTINGS.presence, 'online');
});

test('saved false values override defaults while unspecified settings still receive defaults', () => {
  const saved = mergeSettings({ autoview: false, autolike: false, presence: 'offline', prefix: '!' });
  assert.equal(saved.autoview, false);
  assert.equal(saved.autolike, false);
  assert.equal(saved.presence, 'offline');
  assert.equal(saved.prefix, '!');
  assert.equal(saved.mode, 'public');
});

test('saved ULTRA AI state respects explicit values', () => {
  assert.equal(mergeSettings({ ultraai: true }).ultraai, true);
  assert.equal(mergeSettings({ ultraai: false }).ultraai, false);
});
