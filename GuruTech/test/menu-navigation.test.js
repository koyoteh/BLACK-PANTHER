import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MENU_CATEGORIES,
  buildCategorySelectorButton,
  renderMainMenu,
  renderCategoryMenu,
  resolveCategorySelection,
  handleCategoryMenuReply,
  sendMainMenu,
  MENU_CATEGORY_BUTTON_ID,
  MENU_READ_MORE_BUTTON_ID,
  buildReadMoreButton,
  isMenuNavigationReply,
  sendOfficialLinkButtons,
  sendRepositoryInfoCard,
  buildRepositoryInfoText,
  MENU_LINKS,
  MENU_LINK_BUTTONS
} from '../lib/menuNavigation.js';
import {
  decorateOutgoingContent,
  formatResponseTable,
  getRudeResponseTag,
  withRudeResponseTag
} from '../lib/rudeResponses.js';

test('numbered main menu exposes 15 stable category choices in the chain-and-cube style', () => {
  assert.equal(MENU_CATEGORIES.length, 15);
  assert.equal(resolveCategorySelection('01')?.id, 'general');
  assert.equal(resolveCategorySelection('15')?.id, 'user');
  assert.equal(resolveCategorySelection('16'), null);
  const menu = renderMainMenu({ m: { pushName: 'Test User' }, prefix: '.', mode: 'private', totalCommands: 348 }, new Date('2026-11-17T08:04:00.000Z'));
  assert.match(menu, /╭┈┈┈⟡ \*BLACK PANTHER\*/);
  assert.doesNotMatch(menu, /𝙎𝙔𝙎𝙏𝙀𝙈 𝙋𝘼𝙉𝙀𝙇|v3\.0\.0/i);
  assert.match(menu, /NAVIGATION/);
  assert.match(menu, /\.all menu/);
  assert.match(menu, /01  ›  GENERAL/);
  assert.match(menu, /15  ›  USER/);
  assert.doesNotMatch(menu, /Commands\s+·/);
  assert.doesNotMatch(menu, /Uptime\s+·/);
  assert.doesNotMatch(menu, /RAM\s+·/);
  assert.match(menu, /├─ ◈/);
  assert.doesNotMatch(menu, /▣|⛓/);
  assert.doesNotMatch(menu, />\s*_BLACK PANTHER_/i);
  assert.doesNotMatch(menu, /Powered by/i);
  assert.doesNotMatch(menu, /\x1b/);
});

test('category command table uses the requested chain-and-cube frame and readable command names', () => {
  const table = renderCategoryMenu(
    { label: 'GROUP', emoji: '👥' },
    [{ name: 'kick', description: 'Remove a member from the group' }],
    '.'
  );
  assert.match(table, /╭┈┈┈⟡ \*BLACK PANTHER\*/);
  assert.match(table, /\.kick\*/);
  assert.match(table, /Remove a member/);
  assert.match(table, /╰┈┈┈⟡/);
  assert.doesNotMatch(table, />\s*_BLACK PANTHER_/i);
  assert.doesNotMatch(table, /Powered by/i);
});

test('numbers route from a quoted or active dashboard but unrelated quoted numbers are ignored', async () => {
  const sent = [];
  const client = { sendMessage: async (...args) => { sent.push(args); } };
  const quotedMenu = {
    id: 'menu-message-id',
    chat: 'chat@s.whatsapp.net',
    text: 'BLACK PANTHER\n📋 CATEGORIES · reply 01–15 to this message'
  };

  const ignored = await handleCategoryMenuReply({
    client,
    m: { chat: 'chat@s.whatsapp.net', quoted: { id: 'unrelated', chat: 'chat@s.whatsapp.net', text: 'Count to 15.' } },
    body: '1'
  });
  assert.equal(ignored, false);

  const handled = await handleCategoryMenuReply({
    client,
    m: { chat: 'chat@s.whatsapp.net', key: { id: 'reply-id' }, quoted: quotedMenu },
    body: '16'
  });
  assert.equal(handled, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0][1].text, /01–15/);
  assert.match(sent[0][1].text, /(?:📋 It’s all there|🧭 Pick a lane|😏 Menu served|🗂️ Options laid out)/);

  const listed = await handleCategoryMenuReply({
    client,
    m: { chat: 'chat@s.whatsapp.net', key: { id: 'reply-id-2' }, quoted: quotedMenu },
    body: '10'
  });
  assert.equal(listed, true);
  assert.equal(sent.length, 2);
  assert.match(sent[1][1].text, /╭┈┈┈⟡ \*BLACK PANTHER\*/);
  assert.match(sent[1][1].text, /\.coinflip\*/);

  const activeSent = [];
  const activeClient = {
    sendMessage: async (...args) => {
      activeSent.push(args);
      return { key: { id: `active-message-${activeSent.length}` } };
    }
  };
  await sendMainMenu({
    client: activeClient,
    m: { chat: 'active-chat@s.whatsapp.net', pushName: 'Test' },
    prefix: '.',
    mode: 'public',
    totalCommands: 10
  });
  assert.equal(activeSent.length, 1, 'the regular menu should no longer send the official-links card');
  const unquoted = await handleCategoryMenuReply({
    client: activeClient,
    m: { chat: 'active-chat@s.whatsapp.net' },
    body: '10'
  });
  assert.equal(unquoted, true);
  assert.ok(activeSent.some(([, content]) => /\.coinflip\*/.test(content?.text || '')));
});

test('Menu button opens all category rows and a tapped category routes to its command list', async () => {
  const sent = [];
  const client = {
    sendMessage: async (...args) => {
      sent.push(args);
      return { key: { id: `menu-flow-${sent.length}` } };
    }
  };
  const chat = 'button-menu@s.whatsapp.net';

  const opened = await handleCategoryMenuReply({
    client,
    m: { chat, key: { id: 'menu-button-reply' } },
    body: MENU_CATEGORY_BUTTON_ID
  });
  assert.equal(opened, true);
  const picker = sent.find(([, content]) => Array.isArray(content?.sections));
  assert.ok(picker, 'tapping Menu should open a category list');
  assert.equal(picker[1].sections[0].rows.length, MENU_CATEGORIES.length);
  assert.equal(picker[1].sections[0].rows[9].rowId, 'ultraguru:category:economy');

  const selected = await handleCategoryMenuReply({
    client,
    m: { chat, key: { id: 'category-row-reply' } },
    body: picker[1].sections[0].rows[9].rowId
  });
  assert.equal(selected, true);
  assert.ok(sent.some(([, content]) => /╭┈┈┈⟡ \*BLACK PANTHER\*/.test(content?.text || '')));
  assert.ok(sent.some(([, content]) => /\.coinflip\*/.test(content?.text || '')));
});

test('main menu restores the native category selector while .all menu remains the full directory', async () => {
  const sent = [];
  const client = {
    sendMessage: async (...args) => {
      sent.push(args);
      return { key: { id: `native-menu-${sent.length}` } };
    }
  };
  const chat = 'native-menu@s.whatsapp.net';
  await sendMainMenu({ client, m: { chat, pushName: 'Test' }, prefix: '.', totalCommands: 20 });

  assert.equal(sent.length, 1);
  assert.match(sent[0][1].text, /╭┈┈┈⟡/);
  const menuButton = buildCategorySelectorButton();
  assert.equal(menuButton.name, 'single_select');
  const selector = JSON.parse(menuButton.buttonParamsJson);
  assert.equal(selector.sections[0].rows.length, MENU_CATEGORIES.length);

  const selected = await handleCategoryMenuReply({
    client,
    m: { chat, key: { id: 'native-menu-selection' } },
    body: selector.sections[0].rows[4].id
  });
  assert.equal(selected, true);
  assert.equal(sent.length, 2);
  assert.match(sent[1][1].text, /GROUP/);
});

test('self-chat allowlist accepts menu buttons and numeric category replies', () => {
  assert.equal(isMenuNavigationReply(MENU_CATEGORY_BUTTON_ID), true);
  assert.equal(isMenuNavigationReply(MENU_READ_MORE_BUTTON_ID), true);
  assert.equal(isMenuNavigationReply('ultraguru:category:economy'), true);
  assert.equal(isMenuNavigationReply('01'), true);
  assert.equal(isMenuNavigationReply('15'), true);
  assert.equal(isMenuNavigationReply('16'), true, 'out-of-range numbers reach the handler for its guidance response');
  assert.equal(isMenuNavigationReply('ultraguru:category:../../remove'), false);
  assert.equal(isMenuNavigationReply('ordinary-button-id'), false);
  assert.equal(isMenuNavigationReply('1 please'), false);
});

test('`.all menu` sends the complete command list grouped under category headings', async () => {
  const sent = [];
  const client = { sendMessage: async (...args) => { sent.push(args); return { key: { id: 'full-menu' } }; } };
  const handled = await handleCategoryMenuReply({
    client,
    m: { chat: 'all-menu@s.whatsapp.net', key: { id: 'all-menu-command' } },
    body: '.all menu',
    prefix: '.'
  });
  assert.equal(handled, true);
  assert.match(sent[0][1].text, /╭┈┈┈⟡ \*BLACK PANTHER\*/);
  assert.doesNotMatch(sent[0][1].text, /▣|⛓/);
  assert.match(sent[0][1].text, /GENERAL/);
  assert.match(sent[0][1].text, /ECONOMY/);
  assert.match(sent[0][1].text, /\.coinflip/);
  assert.match(sent[0][1].text, /\.remove/);
});

test('menu fallback uses the bot image or bundled artwork when image-header cards are unavailable', async () => {
  const botImage = readFileSync(new URL('../ultra-guru.jpg', import.meta.url));
  const senderImage = Buffer.concat([
    botImage.subarray(0, 2),
    Buffer.from([0xff, 0xfe, 0x00, 0x04, 0x55, 0x53]),
    botImage.subarray(2)
  ]);
  const originalFetch = globalThis.fetch;
  const scenarios = [
    { senderAvailable: true, botAvailable: true, expected: botImage },
    { senderAvailable: false, botAvailable: true, expected: botImage },
    { senderAvailable: false, botAvailable: false, expected: botImage }
  ];

  try {
    for (const [index, scenario] of scenarios.entries()) {
      const sent = [];
      const relayed = [];
      const profileLookups = [];
      const fetchLookups = [];
      globalThis.fetch = async (url) => {
        fetchLookups.push(url);
        const isSender = String(url).includes('sender.jpg');
        const isAvailable = isSender ? scenario.senderAvailable : scenario.botAvailable;
        const image = isSender ? senderImage : botImage;
        return {
          ok: isAvailable,
          headers: { get: () => isAvailable ? 'image/jpeg' : 'text/html' },
          arrayBuffer: async () => image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength)
        };
      };
      const client = {
        user: { id: 'bot@s.whatsapp.net' },
        decodeJid: (jid) => jid,
        profilePictureUrl: async (jid) => {
          profileLookups.push(jid);
          if (jid === 'bot@s.whatsapp.net' && !scenario.botAvailable && index === 2) throw new Error('No bot avatar');
          return jid === 'sender@s.whatsapp.net' ? 'https://img.test/sender.jpg' : 'https://img.test/bot.jpg';
        },
        sendMessage: async (...args) => {
          sent.push(args);
          return { key: { id: `avatar-message-${sent.length}` } };
        },
        relayMessage: async (...args) => {
          relayed.push(args);
          return { key: { id: `avatar-relay-${relayed.length}` } };
        }
      };

      await sendMainMenu({
        client,
        m: { chat: `avatar-chat-${index}`, sender: 'sender@s.whatsapp.net', pushName: 'Test' },
        prefix: '.',
        totalCommands: 1
      });

      assert.ok(sent.length + relayed.length > 0, 'dashboard should be delivered');
      const dashboard = [...sent, ...relayed].find(([, content]) => JSON.stringify(content).includes('official.gurutechlab.co.ke'));
      if (dashboard) assert.ok(JSON.stringify(dashboard[1]).includes('official.gurutechlab.co.ke'));
      assert.deepEqual(profileLookups, ['bot@s.whatsapp.net', 'sender@s.whatsapp.net']);
      assert.deepEqual(fetchLookups, scenario.botAvailable
        ? ['https://img.test/bot.jpg', 'https://img.test/sender.jpg']
        : ['https://img.test/sender.jpg']);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('menu quick links point to the official repo, website and WhatsApp channel', () => {
  assert.equal(MENU_LINKS.repository, 'https://github.com/cleanplata/BLACK-PANTHER');
  assert.equal(MENU_LINKS.website, 'https://cheap.bothosting.gurutech.top');
  assert.equal(MENU_LINKS.channel, 'https://whatsapp.com/channel/0029VbDh88NCMY0Fartkxm1g');
  const buttons = MENU_LINK_BUTTONS.map(({ name, buttonParamsJson }) => ({ name, ...JSON.parse(buttonParamsJson) }));
  assert.deepEqual(buttons.map(({ display_text }) => display_text), [
    'GitHub Repository', 'Official Website', 'WhatsApp Channel'
  ]);
  assert.deepEqual(buttons.map(({ url }) => url), [
    MENU_LINKS.repository, MENU_LINKS.website, MENU_LINKS.channel
  ]);
  assert.ok(buttons.every(({ name, merchant_url, url }) => name === 'cta_url' && merchant_url === url));
});

test('official links can be attached to the connected card as its only buttons', async () => {
  const sent = [];
  const relayed = [];
  const botThumbnail = readFileSync(new URL('../ultra-guru.jpg', import.meta.url));
  const client = {
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: async (...args) => { sent.push(args); return { key: { id: 'links-fallback' } }; },
    relayMessage: async (...args) => { relayed.push(args); return { key: { id: 'links-card' } }; }
  };
  const connectedTable = '╭━━━━❲〘  *BLACK PANTHER* 〙❳━━━━╮\n> ╭────━❮ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 ❯━────';
  await sendOfficialLinkButtons(client, 'connected-chat@s.whatsapp.net', connectedTable);
  assert.equal(sent.length + relayed.length, 1);
  if (sent.length) {
    assert.ok(sent[0][1].text.startsWith(connectedTable));
    assert.ok(Object.values(MENU_LINKS).every((url) => !sent[0][1].text.includes(url)));
    assert.deepEqual(sent[0][1].contextInfo.externalAdReply.thumbnail, botThumbnail);
  } else {
    const interactive = relayed[0][1].interactiveMessage;
    assert.equal(interactive.body.text, connectedTable);
    assert.ok(Object.values(MENU_LINKS).every((url) => !interactive.body.text.includes(url)));
    assert.equal(interactive.footer?.text || '', '');
    assert.deepEqual(interactive.contextInfo.externalAdReply.thumbnail, botThumbnail);
    const buttons = interactive.nativeFlowMessage.buttons;
    const urls = buttons.map(({ buttonParamsJson }) => JSON.parse(buttonParamsJson).url);
    assert.deepEqual(urls, Object.values(MENU_LINKS));
  }
});

test('.repo card includes the bundled bot thumbnail preview', async () => {
  const sent = [];
  const relayed = [];
  const botThumbnail = readFileSync(new URL('../ultra-guru.jpg', import.meta.url));
  const client = {
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: async (...args) => { sent.push(args); return { key: { id: 'repo-fallback' } }; },
    relayMessage: async (...args) => { relayed.push(args); return { key: { id: 'repo-card' } }; }
  };
  const repoText = `╭─⛓ *BLACK PANTHER · REPOSITORY* ⛓─╮\n⛓ ▣ Source details\n${MENU_LINKS.repository}\n${MENU_LINKS.channel}`;

  await sendRepositoryInfoCard(client, 'repo-chat@s.whatsapp.net', repoText);

  assert.equal(sent.length + relayed.length, 1);
  const card = sent.length ? sent[0][1] : relayed[0][1].interactiveMessage;
  assert.deepEqual(card.contextInfo.externalAdReply.thumbnail, botThumbnail);
  const displayedText = sent.length ? card.text : card.body.text;
  assert.ok(Object.values(MENU_LINKS).every((url) => !displayedText.includes(url)));
  if (relayed.length) {
    assert.equal(card.header.hasMediaAttachment, true);
    assert.ok(card.header.imageMessage);
    const urls = card.nativeFlowMessage.buttons.map(({ buttonParamsJson }) => JSON.parse(buttonParamsJson).url);
    assert.deepEqual(urls, [MENU_LINKS.repository, MENU_LINKS.channel]);
  }
});

test('repository details show stats in the card body while official destinations remain buttons', () => {
  const text = buildRepositoryInfoText({
    stars: 58,
    forks: 248,
    createdAt: '2026-03-26T00:00:00Z',
    lastUpdate: '2026-11-11T00:00:00Z',
    owner: 'GuruhTech'
  });
  assert.match(text, /Stars\s+⟶\s+\*58\*/);
  assert.match(text, /Forks\s+⟶\s+\*248\*/);
  assert.match(text, /Owner\s+⟶\s+\*GuruhTech\*/);
  assert.doesNotMatch(text, /https?:\/\//i);
  assert.doesNotMatch(text, /Powered by|>\s*_BLACK PANTHER_/i);
});

test('response tags rotate through action-specific moods and react to failed outcomes', () => {
  const removeTags = [0, 0.25, 0.5, 0.75].map((sample) =>
    getRudeResponseTag('remove', 'Member removed successfully.', () => sample)
  );
  assert.equal(new Set(removeTags).size, 4);
  assert.match(removeTags[0], /😈/);
  assert.match(removeTags[3], /🥶/);
  assert.match(getRudeResponseTag('anticall', 'Call action completed.', () => 0), /📵/);
  assert.match(getRudeResponseTag('vvx', 'View-once opened.', () => 0), /👁️/);
  assert.match(getRudeResponseTag('fullmenu', 'Menu rendered.', () => 0), /🗺️/);
  assert.match(getRudeResponseTag('weather', 'Done.', () => 0), /😏 Done/);
  assert.match(getRudeResponseTag('remove', 'Could not remove member: permission denied.', () => 0), /😮‍💨/);
});

test('response decorator tags text and media captions only once', () => {
  const taggedText = decorateOutgoingContent({ text: 'Removed.' }, 'remove');
  assert.match(taggedText.text, /╭┈┈┈⟡ \*BLACK PANTHER\*/);
  assert.match(taggedText.text, /🗑️ \*𝗞𝗶𝗰𝗸\*/);
  assert.match(taggedText.text, /(?:😈 Removed\.|🕶️ Gone\.|💼 Access revoked\.|🥶 Out\.)/);
  assert.doesNotMatch(taggedText.text, />\s*_BLACK PANTHER_/i);
  assert.doesNotMatch(taggedText.text, /Powered by/i);
  assert.equal(decorateOutgoingContent(taggedText, 'remove').text, taggedText.text);
  const failedText = decorateOutgoingContent({ text: 'Could not remove member: permission denied.' }, 'remove');
  assert.match(failedText.text, /(?:😮‍💨|🫠|🚧|😑|🥀)/);
  assert.doesNotMatch(failedText.text, /(?:😈 Removed\.|🕶️ Gone\.|💼 Access revoked\.|🥶 Out\.)/);
  const taggedCaption = decorateOutgoingContent({ image: Buffer.from('x'), caption: 'Here is the result.' }, 'anticall');
  assert.match(taggedCaption.caption, /╭┈┈┈⟡ \*BLACK PANTHER\*/);
  assert.match(taggedCaption.caption, /(?:📵 Call declined|😎 Not taking calls|🧊 Line blocked|☎️ Rejected)/);

  const interactive = decorateOutgoingContent({ interactiveMessage: { body: { text: 'Anticall is now enabled.' } } }, 'anticall');
  assert.match(interactive.interactiveMessage.body.text, /╭┈┈┈⟡/);
  assert.match(interactive.interactiveMessage.body.text, /(?:📵 Call declined|😎 Not taking calls|🧊 Line blocked|☎️ Rejected)/);

  const existing = decorateOutgoingContent({ text: '> ╭─⌈ 🔥 *BLACK PANTHER* ⌋\n> │ Dashboard' }, 'menu');
  assert.equal((existing.text.match(/╭┈┈┈⟡/g) || []).length, 1);
  assert.match(existing.text, /(?:📋 It’s all there|🧭 Pick a lane|😏 Menu served|🗂️ Options laid out)/);
  assert.match(formatResponseTable('Usage: reply to a message.', 'kick'), /Usage:/);

  const legacy = decorateOutgoingContent({
    text: '╭─❏ 「 ANTICALL 」\n│ Status: ON\n│ Usage: .anticall on/off\n╰───────────────\n> ©Powered By BLACK PANTHER'
  }, 'anticall');
  assert.match(legacy.text, /╭┈┈┈⟡ \*BLACK PANTHER\*/);
  assert.doesNotMatch(legacy.text, /╭─❏/);
  assert.match(legacy.text, /Status: ON/);
  assert.match(legacy.text, /Usage:/);
});

test('long responses drop the metallic cubes and use the simpler chain frame', () => {
  const longText = ['Download complete', 'Format: MP4', 'Resolution: 720p', 'Size: 18 MB', 'Duration: 02:36', 'File attached below'].join('\n');
  const formatted = decorateOutgoingContent({ text: longText }, 'download').text;
  assert.match(formatted, /╭┈┈┈⟡ \*BLACK PANTHER/);
  assert.doesNotMatch(formatted, /╭•─|▣|⛓/);
  assert.match(formatted, /Download complete/);
  assert.match(formatted, /╰┈┈┈⟡/);
  assert.doesNotMatch(formatted, />\s*_BLACK PANTHER_/i);
});

test('command-scoped tags survive asynchronous work', async () => {
  const tagged = await withRudeResponseTag('remove', async () => {
    await Promise.resolve();
    return decorateOutgoingContent({ text: 'Member removed.' });
  });
  assert.match(tagged.text, /(?:😈 Removed\.|🕶️ Gone\.|💼 Access revoked\.|🥶 Out\.)/);
});
