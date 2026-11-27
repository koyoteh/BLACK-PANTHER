import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLinkDomains, extractMessageText, hasAnyLink, hasWhatsAppInviteLink, hasForwardedContentMetadata, isStickerMessage } from '../lib/linkDetection.js';

test('anti-link recognizes common and long-TLD URLs with or without a scheme', () => {
  assert.equal(hasAnyLink('Visit example.com'), true);
  assert.equal(hasAnyLink('https://files.example.photography/gallery?id=2'), true);
  assert.equal(hasAnyLink('www.example.technology/path'), true);
  assert.equal(hasAnyLink('例子.中国/页面'), true);
  assert.equal(hasAnyLink('192.0.2.1:8080/path'), true);
  assert.equal(hasAnyLink('ordinary words and 254712345678'), false);
});

test('anti-link recognizes WhatsApp group and channel URLs as links', () => {
  assert.equal(hasAnyLink('chat.whatsapp.com/AbCd1234'), true);
  assert.equal(hasWhatsAppInviteLink('chat.whatsapp.com/AbCd1234'), true);
  assert.equal(hasWhatsAppInviteLink('whatsapp.com/channel/0029VbExample'), true);
  assert.equal(hasWhatsAppInviteLink('https://whatsapp.com/invite/AbCd1234'), true);
  assert.equal(hasWhatsAppInviteLink('https://example.com/'), false);
});

test('anti-link finds obfuscated links and URLs embedded in message metadata', () => {
  assert.equal(hasAnyLink('example[.]com/path'), true);
  assert.equal(hasAnyLink('hxxps://example.com/path'), true);
  const message = {
    imageMessage: {
      caption: 'Check this out',
      contextInfo: { externalAdReply: { sourceUrl: 'https://example.photography/post' } }
    }
  };
  assert.match(extractMessageText(message), /example\.photography/);
  assert.equal(hasAnyLink(message), true);
});

test('forwarded channel images are recognized through direct and wrapped metadata', () => {
  assert.equal(hasForwardedContentMetadata({ imageMessage: { contextInfo: { isForwarded: true, forwardingScore: 1 } } }), true);
  assert.equal(hasForwardedContentMetadata({
    ephemeralMessage: {
      message: {
        viewOnceMessageV2: {
          message: { imageMessage: { contextInfo: { isForwarded: true, forwardingScore: 2 } } }
        }
      }
    }
  }), true);
  assert.equal(hasForwardedContentMetadata({
    imageMessage: { contextInfo: { forwardedNewsletterMessageInfo: { newsletterJid: '120363000000000000@newsletter' } } }
  }), true);
  assert.equal(hasForwardedContentMetadata({ imageMessage: { caption: 'just an image' } }), false);
  assert.equal(hasForwardedContentMetadata({
    extendedTextMessage: {
      text: 'replying to this post',
      contextInfo: { quotedMessage: { imageMessage: { contextInfo: { isForwarded: true, forwardingScore: 1 } } } }
    }
  }), false);
});

test('anti-link identifies stickers so sticker transport URLs cannot trigger deletion', () => {
  assert.equal(isStickerMessage({ stickerMessage: { mimetype: 'image/webp', url: 'https://mmg.whatsapp.net/sticker' } }), true);
  assert.equal(isStickerMessage({ ephemeralMessage: { message: { stickerMessage: { mimetype: 'image/webp' } } } }), true);
  assert.equal(isStickerMessage({ imageMessage: { caption: 'https://example.com' } }), false);
});

test('link-domain extraction supports long-TLDs and normalized subdomains', () => {
  assert.deepEqual(extractLinkDomains('See https://www.sub.example.photography/gallery.'), ['sub.example.photography']);
  assert.deepEqual(extractLinkDomains('t.me/channel'), ['t.me']);
});

test('link detection is stable when the same regexes are used repeatedly', () => {
  for (let i = 0; i < 4; i += 1) {
    assert.equal(hasAnyLink('example.net'), true);
    assert.equal(hasAnyLink('not a link'), false);
  }
});
