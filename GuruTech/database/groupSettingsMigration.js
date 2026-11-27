const LEGACY_GROUP_ID_COLUMNS = [
  'group_jid',
  'whatsapp_jid',
  'chat_jid',
  'group_id',
  'groupid',
  'chat_id',
  'chatid'
];

export async function migrateGroupSettingsJid(pool) {
  const { rows: columnRows } = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'group_settings'`
  );
  const columns = new Set(columnRows.map(row => String(row.column_name).toLowerCase()));
  const addedJid = !columns.has('jid');

  if (addedJid) {
    await pool.query('ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS jid TEXT');
  }

  let mappedFrom = null;
  for (const candidate of LEGACY_GROUP_ID_COLUMNS) {
    if (!columns.has(candidate)) continue;
    const quoted = `"${candidate}"`;
    const { rows } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE ${quoted} IS NOT NULL)::int AS total,
              COUNT(*) FILTER (WHERE ${quoted}::text ~ '^[0-9]+@g\\.us$')::int AS group_jids,
              COUNT(DISTINCT ${quoted}::text)::int AS distinct_total
         FROM group_settings`
    );
    const total = Number(rows[0]?.total || 0);
    const groupJids = Number(rows[0]?.group_jids || 0);
    const distinctTotal = Number(rows[0]?.distinct_total || 0);
    if (total === 0 || groupJids !== total || distinctTotal !== total) continue;

    await pool.query(
      `UPDATE group_settings SET jid = ${quoted}::text WHERE jid IS NULL`
    );
    mappedFrom = candidate;
    break;
  }

  const { rows: duplicateRows } = await pool.query(
    `SELECT jid
       FROM group_settings
      WHERE jid IS NOT NULL
      GROUP BY jid
     HAVING COUNT(*) > 1
      LIMIT 1`
  );
  if (duplicateRows.length) {
    throw new Error('group_settings contains duplicate non-null jid values; refusing to create a unique index');
  }

  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS group_settings_jid_uq ON group_settings (jid)'
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE jid IS NULL)::int AS unmapped
       FROM group_settings`
  );

  return {
    addedJid,
    mappedFrom,
    totalRows: Number(countRows[0]?.total || 0),
    unmappedRows: Number(countRows[0]?.unmapped || 0),
    columns: [...columns]
  };
}
