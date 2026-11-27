import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const openBlockStart = source.indexOf('if (connection === "open") {');
const openBlockEnd = source.indexOf('global._ultraGuruConnectTime', openBlockStart);
const connectionBanner = source.slice(openBlockStart, openBlockEnd);

test('connection startup log uses the BLACK PANTHER Panther Slate banner', () => {
  assert.notEqual(openBlockStart, -1);
  assert.notEqual(openBlockEnd, -1);
  assert.match(connectionBanner, /pantherConnectedTable\(/u);
  assert.match(connectionBanner, /settingss\.mode/u);
});

test('message-processing error logs use BLACK PANTHER labels', () => {
  assert.match(source, /\[BLACK PANTHER INTERACTIVE\]/u);
  assert.match(source, /\[BLACK PANTHER LIST\]/u);
  assert.match(source, /\[BLACK PANTHER ASYNC\]/u);
});
