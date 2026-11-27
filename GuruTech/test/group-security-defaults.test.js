import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGroupSecurityDefaults,
  parseGroupSecurityOverrides,
  resolveGroupSecurityMode
} from '../lib/groupSecurityDefaults.js';

test('deployment mode variables are validated and default to off', () => {
  assert.deepEqual(getGroupSecurityDefaults({}), {
    antilink: 'off', antibot: 'off', antipromo: 'off'
  });
  assert.deepEqual(getGroupSecurityDefaults({
    DEFAULT_ANTILINK_MODE: 'warn',
    DEFAULT_ANTIBOT_MODE: 'remove',
    DEFAULT_ANTIPROMO_MODE: 'kick'
  }), {
    antilink: 'warn', antibot: 'remove', antipromo: 'kick'
  });
  assert.equal(getGroupSecurityDefaults({ DEFAULT_ANTILINK_MODE: 'invalid' }).antilink, 'off');
});

test('a saved non-off group mode wins over deployment defaults', () => {
  const defaults = getGroupSecurityDefaults({ DEFAULT_ANTILINK_MODE: 'warn' });
  assert.equal(resolveGroupSecurityMode('antilink', 'kick', {}, defaults), 'kick');
});

test('a deployment default fills legacy off values until an admin explicitly overrides it', () => {
  const defaults = getGroupSecurityDefaults({ DEFAULT_ANTIBOT_MODE: 'warn' });
  assert.equal(resolveGroupSecurityMode('antibot', 'off', {}, defaults), 'warn');
  assert.equal(resolveGroupSecurityMode('antibot', 'off', { antibot: true }, defaults), 'off');
  assert.equal(resolveGroupSecurityMode('antibot', true, {}, defaults), 'warn');
});

test('security override metadata accepts JSON text or objects and ignores unknown keys', () => {
  assert.deepEqual(parseGroupSecurityOverrides('{"antilink":true,"badkey":true}'), { antilink: true });
  assert.deepEqual(parseGroupSecurityOverrides({ antibot: 1, antipromo: 'true', antilink: false }), {
    antibot: true, antipromo: true
  });
});
