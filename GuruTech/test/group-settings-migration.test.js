import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateGroupSettingsJid } from '../database/groupSettingsMigration.js';

function fakePool(initialColumns, initialRows) {
  const columns = new Set(initialColumns);
  const rows = initialRows.map(row => ({ ...row }));
  const calls = [];

  return {
    columns,
    rows,
    calls,
    async query(sql) {
      calls.push(sql);
      if (sql.includes('FROM information_schema.columns')) {
        return { rows: [...columns].map(column_name => ({ column_name })) };
      }
      if (sql.includes('ALTER TABLE group_settings ADD COLUMN')) {
        columns.add('jid');
        rows.forEach(row => { if (!Object.hasOwn(row, 'jid')) row.jid = null; });
        return { rows: [] };
      }
      if (sql.includes('AS group_jids')) {
        const column = sql.match(/WHERE "([a-z_]+)" IS NOT NULL/)?.[1];
        const values = rows.map(row => row[column]).filter(value => value !== null && value !== undefined);
        return { rows: [{
          total: values.length,
          group_jids: values.filter(value => /^[0-9]+@g\.us$/.test(String(value))).length,
          distinct_total: new Set(values.map(String)).size
        }] };
      }
      if (sql.startsWith('UPDATE group_settings SET jid =')) {
        const column = sql.match(/SET jid = "([a-z_]+)"::text/)?.[1];
        rows.forEach(row => {
          if ((row.jid === null || row.jid === undefined) && row[column] !== null && row[column] !== undefined) {
            row.jid = String(row[column]);
          }
        });
        return { rows: [] };
      }
      if (sql.includes('HAVING COUNT(*) > 1')) {
        const counts = new Map();
        rows.filter(row => row.jid !== null && row.jid !== undefined).forEach(row => {
          counts.set(row.jid, (counts.get(row.jid) || 0) + 1);
        });
        return { rows: [...counts].filter(([, count]) => count > 1).slice(0, 1).map(([jid]) => ({ jid })) };
      }
      if (sql.includes('AS unmapped')) {
        return { rows: [{
          total: rows.length,
          unmapped: rows.filter(row => row.jid === null || row.jid === undefined).length
        }] };
      }
      if (sql.startsWith('CREATE UNIQUE INDEX')) return { rows: [] };
      throw new Error(`Unexpected SQL in fake pool: ${sql}`);
    }
  };
}

test('group settings migration adds jid, safely maps verified unique WhatsApp group IDs, and preserves settings', async () => {
  const pool = fakePool(['group_jid', 'antilink'], [
    { group_jid: '120363000000001@g.us', antilink: 'warn' },
    { group_jid: '120363000000002@g.us', antilink: 'off' }
  ]);

  const result = await migrateGroupSettingsJid(pool);
  assert.equal(result.addedJid, true);
  assert.equal(result.mappedFrom, 'group_jid');
  assert.equal(result.unmappedRows, 0);
  assert.deepEqual(pool.rows.map(row => row.jid), [
    '120363000000001@g.us', '120363000000002@g.us'
  ]);
  assert.deepEqual(pool.rows.map(row => row.antilink), ['warn', 'off']);
  assert.equal(pool.rows.length, 2);
  assert.ok(pool.calls.some(sql => sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS group_settings_jid_uq')));

  const secondRun = await migrateGroupSettingsJid(pool);
  assert.equal(secondRun.addedJid, false);
  assert.equal(secondRun.unmappedRows, 0);
  assert.equal(pool.rows.length, 2);
});

test('unverifiable or duplicate legacy identifiers are left untouched while the new key column is added', async () => {
  const pool = fakePool(['group_id', 'antilink'], [
    { group_id: '120363000000001@g.us', antilink: 'warn' },
    { group_id: '120363000000001@g.us', antilink: 'kick' }
  ]);

  const result = await migrateGroupSettingsJid(pool);
  assert.equal(result.mappedFrom, null);
  assert.equal(result.unmappedRows, 2);
  assert.deepEqual(pool.rows.map(row => row.group_id), [
    '120363000000001@g.us', '120363000000001@g.us'
  ]);
  assert.deepEqual(pool.rows.map(row => row.antilink), ['warn', 'kick']);
  assert.deepEqual(pool.rows.map(row => row.jid), [null, null]);
});

test('group settings migration refuses duplicate existing jid values without dropping or changing rows', async () => {
  const pool = fakePool(['jid', 'antilink'], [
    { jid: '120363000000001@g.us', antilink: 'warn' },
    { jid: '120363000000001@g.us', antilink: 'kick' }
  ]);
  const before = structuredClone(pool.rows);

  await assert.rejects(migrateGroupSettingsJid(pool), /duplicate non-null jid/);
  assert.deepEqual(pool.rows, before);
  assert.equal(pool.calls.some(sql => sql.startsWith('CREATE UNIQUE INDEX')), false);
});
