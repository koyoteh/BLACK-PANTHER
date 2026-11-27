import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ping from '../plugins/General/ping.js';
import { MENU_LINKS, MENU_REPOSITORY_BUTTON } from '../lib/menuNavigation.js';

test('ping reply shows greeting and speed with a single repository button and bot thumbnail', async () => {
  const sent = [];
  const relayed = [];
  const botThumbnail = readFileSync(new URL('../ultra-guru.jpg', import.meta.url));
  const client = {
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: async (...args) => {
      sent.push(args);
      return { key: { id: `ping-${sent.length}` } };
    },
    relayMessage: async (...args) => { relayed.push(args); }
  };
  const m = { chat: 'ping-test@s.whatsapp.net', pushName: "Mr's GuruTech" };

  await ping.run({ client, m, commandLatency: 0.0003 });

  assert.equal(sent.length + relayed.length, 1);
  const text = sent.length
    ? sent[0][1].text
    : relayed[0][1].interactiveMessage.body.text;
  assert.match(text, /Good (morning|afternoon|evening|night), Mr's GuruTech/);
  assert.match(text, /Bot speed:\* 0\.0003 ms/);
  assert.doesNotMatch(text, /https?:\/\/|Prefix|Latency|Server Time|Uptime|Memory|NodeJS|Platform|Powered by/i);

  assert.equal(MENU_REPOSITORY_BUTTON.name, 'cta_url');
  assert.deepEqual(JSON.parse(MENU_REPOSITORY_BUTTON.buttonParamsJson), {
    display_text: 'GitHub Repository',
    url: MENU_LINKS.repository,
    merchant_url: MENU_LINKS.repository
  });

  if (sent.length) {
    const preview = sent[0][1].contextInfo.externalAdReply;
    assert.equal(preview.sourceUrl, MENU_LINKS.repository);
    assert.deepEqual(preview.thumbnail, botThumbnail);
  } else {
    const interactive = relayed[0][1].interactiveMessage;
    const buttons = interactive.nativeFlowMessage.buttons;
    assert.equal(buttons.length, 1);
    assert.equal(JSON.parse(buttons[0].buttonParamsJson).url, MENU_LINKS.repository);
    assert.deepEqual(interactive.contextInfo.externalAdReply.thumbnail, botThumbnail);
  }
});
