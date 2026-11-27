import test from 'node:test';
import assert from 'node:assert/strict';
import { canEnforceBotCommand, extractCommandText, isPrefixedBotCommand } from '../lib/botSignature.js';

const knownCommands = new Set(['menu', 'ping', 'retrieve', 'vv', 'vvx', 'antibot']);

test('antibot recognizes known bot commands with arbitrary supported prefixes', () => {
  for (const message of ['.menu', '!ping now', '/vv', '$retrieve', '~ antibot warn', '+vvx']) {
    assert.equal(isPrefixedBotCommand(message, knownCommands), true, `${message} should be detected`);
  }
});

test('antibot ignores plain conversation and unknown prefixed words', () => {
  for (const message of ['menu', 'vv', 'hey', 'I like the menu', 'we should ping them', 'hello .menu', '!not-a-command', '!sticker']) {
    assert.equal(isPrefixedBotCommand(message, knownCommands), false, `${message} should not be detected`);
  }
});

test('antibot checks the command word, not the bot configured prefix', () => {
  assert.equal(isPrefixedBotCommand('!menu', knownCommands), true);
  assert.equal(isPrefixedBotCommand('.menu', knownCommands), true);
});

test('only textual messages and captions are examined for prefixed commands', () => {
  assert.equal(extractCommandText({ conversation: 'hey' }), 'hey');
  assert.equal(extractCommandText({ extendedTextMessage: { text: '!menu' } }), '!menu');
  assert.equal(extractCommandText({ imageMessage: { caption: '.ping' } }), '.ping');
  assert.equal(extractCommandText({ ephemeralMessage: { message: { conversation: '.menu' } } }), '.menu');
  assert.equal(extractCommandText({ stickerMessage: { mimetype: 'image/webp', fileLength: 12345 } }), '');
  assert.equal(extractCommandText({ audioMessage: { mimetype: 'audio/ogg', seconds: 4 } }), '');
  assert.equal(extractCommandText({ conversation: 'hey', pushName: '.menu' }), 'hey');
  assert.equal(isPrefixedBotCommand(extractCommandText({ stickerMessage: { mimetype: 'image/webp' } }), knownCommands), false);
});

test('Anti Bot can only respond or punish when it is an admin and the sender is not', () => {
  assert.equal(canEnforceBotCommand(false, false), false);
  assert.equal(canEnforceBotCommand(true, true), false);
  assert.equal(canEnforceBotCommand(true, false), true);
});
