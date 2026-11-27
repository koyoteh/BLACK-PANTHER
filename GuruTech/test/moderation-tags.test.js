import test from 'node:test';
import assert from 'node:assert/strict';
import { isKenyanPhoneNumber, getKenyanModerationTag, getKenyanModerationTagForResponse } from '../lib/moderationTags.js';
import { decorateOutgoingContent, installOutgoingResponseDecorator } from '../lib/rudeResponses.js';

test('Kenyan phone numbers are recognized in country-code and local forms', () => {
  for (const number of ['+254712345678', '254712345678@s.whatsapp.net', '0712345678', '0201234567', '712345678', '+254112345678']) {
    assert.equal(isKenyanPhoneNumber(number), true, `${number} should be recognized as Kenyan`);
  }
  assert.equal(isKenyanPhoneNumber('+14155550123'), false);
  assert.equal(isKenyanPhoneNumber('25471234567'), false);
});

test('moderation tags use the exact requested text for Kenyan kick and warning actions', () => {
  assert.equal(getKenyanModerationTag('+254712345678', 'kick'), 'Manyoya wewe 😎');
  assert.equal(getKenyanModerationTag('0712345678', 'warn'), "usikue nyan'ganya mkuu🫴😅");
  assert.equal(getKenyanModerationTag('254712345678@s.whatsapp.net', 'owner'), "usikue nyan'ganya mkuu🫴😅");
  assert.equal(getKenyanModerationTag('+14155550123', 'kick'), null);
});

test('decorator applies Kenya-specific tags to kick and warning cards based on their target mentions', () => {
  const kicked = decorateOutgoingContent({
    text: '╭─❏ 「 KICKED 」\n│ @254712345678 was kicked from the group.\n╰───────────────',
    mentions: ['254712345678@s.whatsapp.net']
  });
  assert.match(kicked.text, /Manyoya wewe 😎/);
  assert.doesNotMatch(kicked.text, /BLACK PANTHER\s*$/i);

  const warned = decorateOutgoingContent({
    text: '╭─❏ 「 WARNED 」\n│ @254112345678 warned.\n╰───────────────',
    mentions: ['254112345678@s.whatsapp.net']
  });
  assert.match(warned.text, /usikue nyan'ganya mkuu🫴😅/);

  const ownerNotice = getKenyanModerationTagForResponse({
    text: 'Owner only: report from @254712345678',
    mentions: ['254712345678@s.whatsapp.net']
  });
  assert.equal(ownerNotice.tag, "usikue nyan'ganya mkuu🫴😅");
});

test('group warning countdown and Kenyan tag are emphasized in already-framed cards', () => {
  const warning = decorateOutgoingContent({
    text: [
      '╭─⛓ *BLACK PANTHER · 𝘄𝗮𝗿𝗻* ⛓─╮',
      '⛓ _⚠️ @Mr Guru, warned!_',
      '⛓ _Reason: links are not allowed here_',
      '⛓ _Warns: 1/3_',
      "⛓ _2 more and you're GONE. 😈_",
      "⛓ _usikue nyan'ganya mkuu🫴😅_",
      '╰─⛓──────────────⛓─╯'
    ].join('\n'),
    mentions: ['254712345678@s.whatsapp.net']
  });
  assert.match(warning.text, /⚠️ \*2 more and you're GONE\. 😈\*/);
  assert.match(warning.text, /\*usikue nyan'ganya mkuu🫴😅\*/);
});

test('BLACK PANTHER footer text and footer fields are removed even outside command responses', () => {
  const cleaned = decorateOutgoingContent({
    text: 'Reply body\n> _BLACK PANTHER_\n©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER',
    footer: 'BLACK PANTHER Bot',
    interactiveMessage: {
      body: { text: 'Card body' },
      footer: { text: 'BLACK PANTHER' }
    }
  });
  assert.equal(cleaned.text, 'Reply body');
  assert.equal('footer' in cleaned, false);
  assert.equal(cleaned.interactiveMessage.footer.text, '');
});

test('shared outgoing sanitizer wraps send and relay methods once and removes footer fields', async () => {
  const sent = [];
  const relayed = [];
  const client = {
    sendMessage: async (...args) => sent.push(args),
    relayMessage: async (...args) => relayed.push(args)
  };
  installOutgoingResponseDecorator(client);
  const wrappedSend = client.sendMessage;
  installOutgoingResponseDecorator(client);
  assert.equal(client.sendMessage, wrappedSend);
  await client.sendMessage('chat', { text: 'hello', footer: 'BLACK PANTHER' });
  await client.relayMessage('chat', { text: 'hello', interactiveMessage: { footer: { text: 'BLACK PANTHER' } } });
  assert.equal('footer' in sent[0][1], false);
  assert.equal(relayed[0][1].interactiveMessage.footer.text, '');
});

test('standalone legacy captions and notes are converted to Panther Slate', () => {
  const converted = decorateOutgoingContent({
    caption: '╭─❏ 「 VIEW ONCE 」\n│ Retrieved successfully.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER'
  });
  assert.match(converted.caption, /╭┈┈┈⟡ \*BLACK PANTHER\*/);
  assert.doesNotMatch(converted.caption, /╭─❏|╰────────|Powered by/i);
});

test('anti-delete recovery cards are reformatted with chain and cube markers', () => {
  const recovered = decorateOutgoingContent({
    text: '╭─❏ 「 DELETED MSG 」\n│ Time: 11/26/2026\n│ Chat: Test group\n│ Type: text\n│ Deleted by: @254712345678\n│ Sender: @254112345678\n╰───────────────\n\n📝 Deleted Content: hello\n> Powered by BLACK PANTHER'
  });
  assert.match(recovered.text, /╭┈┈┈⟡ \*BLACK PANTHER\*/);
  assert.match(recovered.text, /Time:/);
  assert.match(recovered.text, /Deleted Content: hello/);
  assert.match(recovered.text, /╰┈┈┈⟡/);
  assert.doesNotMatch(recovered.text, /Powered by/i);
});
