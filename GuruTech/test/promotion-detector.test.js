import test from 'node:test';
import assert from 'node:assert/strict';
import { detectBusinessPromotion } from '../lib/promotionDetector.js';

test('detects high-confidence money-making pitches with a call to action', () => {
  assert.ok(detectBusinessPromotion('Earn KSh 5,000 per day with no experience. DM me to join!'));
  assert.ok(detectBusinessPromotion('Pata pesa kila siku! Inbox me now for details.'));
});

test('detects business offers paired with recruitment or urgency cues', () => {
  assert.ok(detectBusinessPromotion('Investment opportunity: register now and message me for details.'));
  assert.ok(detectBusinessPromotion('Limited slots for forex trading — click here https://example.com'));
});

test('does not flag ordinary mentions of business, jobs, or crypto', () => {
  for (const text of [
    'We are discussing business studies tomorrow.',
    'I have a job interview next week, wish me luck.',
    'Crypto prices were volatile this month.',
    'Please join the school WhatsApp group to discuss homework.',
    'I need help writing a business plan; message me if you can help.'
  ]) assert.equal(detectBusinessPromotion(text), null, text);
});
