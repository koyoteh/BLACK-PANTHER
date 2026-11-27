import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCommandAllowedByMode,
  isLinkedOwnerOnlyPlugin,
  isLinkedOwnerSender,
  markLinkedOwnerOnly
} from '../lib/accessControl.js';
import ownerMiddleware from '../utils/botUtil/Ownermiddleware.js';

test('only the session-linked account is the owner, with OWNER_NUMBER as fallback', () => {
  const ownerNumber = '254712345678';

  assert.equal(isLinkedOwnerSender('254712345678@s.whatsapp.net', ownerNumber), true);
  assert.equal(isLinkedOwnerSender('254712345679@s.whatsapp.net', ownerNumber), false);
  assert.equal(isLinkedOwnerSender('254712345679@s.whatsapp.net', ownerNumber, {
    fromMe: true,
    botNumber: '254712345679'
  }), true);
  assert.equal(isLinkedOwnerSender('254712345679@s.whatsapp.net', ownerNumber, {
    botNumber: ownerNumber
  }), false);
  assert.equal(isLinkedOwnerSender(`${ownerNumber}@s.whatsapp.net`, '254799999999', {
    botNumber: ownerNumber
  }), true);
  assert.equal(isLinkedOwnerSender('254799999999@s.whatsapp.net', '254799999999', {
    botNumber: ownerNumber
  }), false);
  assert.equal(isLinkedOwnerSender('254712345678@lid', ownerNumber), false);
  assert.equal(isLinkedOwnerSender('254712345678@lid', ownerNumber, {
    fromMe: true,
    botNumber: '254712345678@s.whatsapp.net'
  }), true);
  assert.equal(isLinkedOwnerSender('254712345678@s.whatsapp.net', '', {
    botNumber: '254712345678'
  }), true);
});

test('private mode allows only the linked owner, not a sudo/privileged user', () => {
  assert.equal(isCommandAllowedByMode('private', { isLinkedOwner: true }), true);
  assert.equal(isCommandAllowedByMode('private', { isPrivileged: true }), false);
  assert.equal(isCommandAllowedByMode('private'), false);
});

test('group and inbox modes retain their existing audience restrictions', () => {
  assert.equal(isCommandAllowedByMode('group', { isGroup: true }), true);
  assert.equal(isCommandAllowedByMode('group', { isGroup: false }), false);
  assert.equal(isCommandAllowedByMode('inbox', { isGroup: false }), true);
  assert.equal(isCommandAllowedByMode('inbox', { isGroup: true }), false);
});

test('Owner-category plugins are marked linked-owner-only, including nested paths', () => {
  assert.equal(isLinkedOwnerOnlyPlugin('Owner/eval.js'), true);
  assert.equal(isLinkedOwnerOnlyPlugin('Owner/nested/secret.js'), true);
  assert.equal(isLinkedOwnerOnlyPlugin('Settings/mode.js'), false);

  const ownerCommand = async () => {};
  const publicCommand = async () => {};
  assert.equal(markLinkedOwnerOnly(ownerCommand, 'Owner/eval.js').linkedOwnerOnly, true);
  assert.equal(markLinkedOwnerOnly(publicCommand, 'General/ping.js').linkedOwnerOnly, undefined);
});

test('owner middleware rejects sudo privilege without linked-owner identity', async () => {
  let reply = '';
  let continued = false;
  await ownerMiddleware({
    Owner: true,
    isSudo: true,
    isLinkedOwner: false,
    m: { reply: async (text) => { reply = text; } }
  }, async () => { continued = true; });

  assert.equal(continued, false);
  assert.match(reply, /linked bot owner/i);
});

test('owner middleware allows the linked owner', async () => {
  let continued = false;
  await ownerMiddleware({
    Owner: true,
    isLinkedOwner: true,
    m: { reply: async () => {} }
  }, async () => { continued = true; });

  assert.equal(continued, true);
});
