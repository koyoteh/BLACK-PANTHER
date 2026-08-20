'use strict';
const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_DIR  = path.join(__dirname, '../Koyoteh/sessions');
const DB_PATH = path.join(DB_DIR, 'panther.db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous  = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('cache_size   = -8000');
db.pragma('temp_store   = MEMORY');
db.pragma('mmap_size    = 67108864');
db.pragma('busy_timeout = 5000');

db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sudo (
        jid      TEXT PRIMARY KEY,
        added_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_settings (
        jid          TEXT PRIMARY KEY,
        antilink     INTEGER DEFAULT 0,
        antispam     INTEGER DEFAULT 0,
        antibadword  INTEGER DEFAULT 0,
        anticall     INTEGER DEFAULT 0,
        welcome      INTEGER DEFAULT 0,
        goodbye      INTEGER DEFAULT 0,
        antidelete   INTEGER DEFAULT 0,
        mute         INTEGER DEFAULT 0,
        antimention  INTEGER DEFAULT 0,
        antiviewonce INTEGER DEFAULT 0,
        antiforeign  INTEGER DEFAULT 0,
        antisticker  INTEGER DEFAULT 0,
        antiflood    INTEGER DEFAULT 0,
        welcomeMsg   TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS warnings (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        jid       TEXT NOT NULL,
        group_jid TEXT NOT NULL,
        reason    TEXT,
        issued_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        group_jid TEXT NOT NULL,
        name      TEXT NOT NULL,
        content   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cmd_stats (
        command    TEXT PRIMARY KEY,
        uses       INTEGER DEFAULT 0,
        last_used  TEXT DEFAULT (datetime('now'))
    );
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_warnings_jid_group ON warnings(jid, group_jid);
    CREATE INDEX IF NOT EXISTS idx_notes_group        ON notes(group_jid, name);
`);

const newCols = ['antimention', 'antiviewonce', 'antiforeign', 'antisticker', 'antiflood', 'antiedit', 'antibot INTEGER DEFAULT 0', 'welcomeMsg TEXT DEFAULT \'\''];
for (const col of newCols) {
    try { db.exec(`ALTER TABLE group_settings ADD COLUMN ${col}`); } catch {}
}

const stmts = {
    getSetting:        db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting:        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'),
    seedOne:           db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'),
    addSudo:           db.prepare('INSERT OR IGNORE INTO sudo (jid) VALUES (?)'),
    removeSudo:        db.prepare('DELETE FROM sudo WHERE jid = ?'),
    getSudoList:       db.prepare('SELECT jid FROM sudo'),
    isSudo:            db.prepare('SELECT 1 FROM sudo WHERE jid = ?'),
    getGroupSettings:  db.prepare('SELECT * FROM group_settings WHERE jid = ?'),
    insertGroupRow:    db.prepare('INSERT OR IGNORE INTO group_settings (jid) VALUES (?)'),
    addWarning:        db.prepare('INSERT INTO warnings (jid, group_jid, reason) VALUES (?, ?, ?)'),
    countWarnings:     db.prepare('SELECT COUNT(*) as c FROM warnings WHERE jid = ? AND group_jid = ?'),
    clearWarnings:     db.prepare('DELETE FROM warnings WHERE jid = ? AND group_jid = ?'),
    allGroupWarnings:  db.prepare('SELECT jid, reason, issued_at FROM warnings WHERE group_jid = ? ORDER BY issued_at DESC'),
    saveNote:          db.prepare('INSERT OR REPLACE INTO notes (group_jid, name, content) VALUES (?, ?, ?)'),
    getNote:           db.prepare('SELECT * FROM notes WHERE group_jid = ? AND name = ?'),
    getAllNotes:        db.prepare('SELECT * FROM notes WHERE group_jid = ?'),
    deleteNote:        db.prepare('DELETE FROM notes WHERE group_jid = ? AND name = ?'),
    trackCmd:          db.prepare(`
        INSERT INTO cmd_stats (command, uses, last_used)
        VALUES (?, 1, datetime('now'))
        ON CONFLICT(command) DO UPDATE SET
            uses      = uses + 1,
            last_used = datetime('now')
    `),
    getTopCmds:        db.prepare('SELECT command, uses, last_used FROM cmd_stats ORDER BY uses DESC LIMIT ?'),
    getCmdStat:        db.prepare('SELECT uses, last_used FROM cmd_stats WHERE command = ?'),
    getTotalUses:      db.prepare('SELECT SUM(uses) as total FROM cmd_stats'),
    resetCmdStats:     db.prepare('DELETE FROM cmd_stats'),
};

const groupSettingStmtCache = new Map();

function getSetting(key, fallback = null) {
    const row = stmts.getSetting.get(key);
    return row ? row.value : fallback;
}

function setSetting(key, value) {
    stmts.setSetting.run(key, String(value));
}

function seedDefaults(defaults = {}) {
    const many = db.transaction((rows) => {
        for (const [k, v] of rows) stmts.seedOne.run(k, String(v));
    });
    many(Object.entries(defaults));
}

function addSudo(jid)    { stmts.addSudo.run(jid); }
function removeSudo(jid) { stmts.removeSudo.run(jid); }
function getSudoList()   { return stmts.getSudoList.all().map(r => r.jid); }
function isSudo(jid)     { return !!stmts.isSudo.get(jid); }

function getGroupSettings(jid) {
    let row = stmts.getGroupSettings.get(jid);
    if (!row) {
        stmts.insertGroupRow.run(jid);
        row = stmts.getGroupSettings.get(jid);
    }
    return row;
}

function setGroupSetting(jid, key, value) {
    if (!groupSettingStmtCache.has(key)) {
        groupSettingStmtCache.set(key, db.prepare(`UPDATE group_settings SET ${key} = ? WHERE jid = ?`));
    }
    groupSettingStmtCache.get(key).run(value ? 1 : 0, jid);
}

function addWarning(jid, groupJid, reason = '') {
    stmts.addWarning.run(jid, groupJid, reason);
    return stmts.countWarnings.get(jid, groupJid).c;
}
function getWarnings(jid, groupJid) {
    return stmts.countWarnings.get(jid, groupJid).c;
}
function getAllWarnings(groupJid) {
    return stmts.allGroupWarnings.all(groupJid);
}
function clearWarnings(jid, groupJid) {
    stmts.clearWarnings.run(jid, groupJid);
}

function saveNote(groupJid, name, content) {
    stmts.saveNote.run(groupJid, name, content);
}
function getNote(groupJid, name) {
    return stmts.getNote.get(groupJid, name);
}
function getAllNotes(groupJid) {
    return stmts.getAllNotes.all(groupJid);
}
function deleteNote(groupJid, name) {
    stmts.deleteNote.run(groupJid, name);
}

function trackCmd(command)          { try { stmts.trackCmd.run(command); } catch {} }
function getTopCmds(limit = 10)    { return stmts.getTopCmds.all(limit); }
function getCmdStat(command)       { return stmts.getCmdStat.get(command); }
function getTotalUses()            { return stmts.getTotalUses.get()?.total || 0; }
function resetCmdStats()           { stmts.resetCmdStats.run(); }

function getConfigSync(key, defaultValue = {}) {
    const row = stmts.getSetting.get(key);
    if (!row) return { ...defaultValue };
    try { return JSON.parse(row.value); } catch { return { ...defaultValue }; }
}

async function setConfig(key, value) {
    stmts.setSetting.run(key, JSON.stringify(value));
}

function checkpoint() {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
}
process.on('exit',    checkpoint);
process.on('SIGTERM', () => { checkpoint(); process.exit(0); });
process.on('SIGINT',  () => { checkpoint(); process.exit(0); });

module.exports = {
    db,
    getSetting, setSetting, seedDefaults,
    getConfigSync, setConfig,
    addSudo, removeSudo, getSudoList, isSudo,
    getGroupSettings, setGroupSetting,
    addWarning, getWarnings, getAllWarnings, clearWarnings,
    saveNote, getNote, getAllNotes, deleteNote,
    trackCmd, getTopCmds, getCmdStat, getTotalUses, resetCmdStats,
};
