import test from 'node:test';
import assert from 'node:assert/strict';
import { executeModeCommand } from '../plugins/Settings/mode.js';
import { MENU_LINKS, MENU_REPOSITORY_BUTTON } from '../lib/menuNavigation.js';

function harness({ mode = 'public', args = [] } = {}) {
  const cards = [];
  const saved = [];
  const client = {
    sendMessage: async () => ({ key: { id: 'mode-reaction' } })
  };
  const context = {
    client,
    m: { chat: 'mode-test@s.whatsapp.net', reactKey: {} },
    args,
    prefix: '.'
  };
  const dependencies = {
    getSettings: async () => ({ mode }),
    updateSetting: async (...values) => saved.push(values),
    sendRepositoryLinkButton: async (...values) => {
      cards.push(values);
      return { key: { id: 'mode-card' } };
    }
  };
  return { context, dependencies, cards, saved };
}

test('mode change sends one compact card with only the repository CTA', async () => {
  const { context, dependencies, cards, saved } = harness({ mode: 'public', args: ['private'] });

  await executeModeCommand(context, dependencies);

  assert.equal(cards.length, 1);
  assert.deepEqual(saved, [['mode', 'private']]);
  assert.equal(cards[0][0], context.client);
  assert.equal(cards[0][1], context.m.chat);
  assert.match(cards[0][2], /Mode updated: 🔒 \*PRIVATE\*/);
  assert.doesNotMatch(cards[0][2], /PUBLIC\s+—|PRIVATE\s+—|GROUP\s+—|INBOX\s+—|Powered by/i);
  assert.equal(MENU_REPOSITORY_BUTTON.name, 'cta_url');
  assert.equal(JSON.parse(MENU_REPOSITORY_BUTTON.buttonParamsJson).url, MENU_LINKS.repository);
});

test('mode status and invalid-mode replies also remain a single compact card', async (t) => {
  await t.test('status', async () => {
    const { context, dependencies, cards, saved } = harness({ mode: 'group' });
    await executeModeCommand(context, dependencies);
    assert.equal(cards.length, 1);
    assert.match(cards[0][2], /Active: 👥 \*GROUP\*/);
    assert.match(cards[0][2], /Use \.mode <public\/private\/group\/inbox>/);
    assert.deepEqual(saved, []);
  });

  await t.test('invalid mode', async () => {
    const { context, dependencies, cards, saved } = harness({ mode: 'public', args: ['unknown'] });
    await executeModeCommand(context, dependencies);
    assert.equal(cards.length, 1);
    assert.match(cards[0][2], /Use: \.mode public\/private\/group\/inbox/);
    assert.deepEqual(saved, []);
  });
});
