import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const _jsonPath  = path.resolve(__dirname, '../../whatsasena.json');

const _DEFAULTS = () => ({
    settings:             {},
    group_settings:       {},
    conversation_history: [],
    sudo_users:           [],
    banned_users:         [],
    allowed_users:        [],
    warn_data:            {},
    msg_store:            {},
    lid_phone:            {},
});

let _data      = null;
let _saveTimer = null;
const _settingsListeners = [];
const _sudoListeners     = [];
const _bannedListeners   = [];

function _flush() {
    try { fs.writeFileSync(_jsonPath, JSON.stringify(_data, null, 2)); } catch {}
}
function _save() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_flush, 400);
}
function _init() {
    if (_data) return;
    try {
        if (fs.existsSync(_jsonPath)) {
            const raw = fs.readFileSync(_jsonPath, 'utf-8');
            _data = Object.assign(_DEFAULTS(), JSON.parse(raw));
        } else {
            _data = _DEFAULTS();
        }
        console.log('✅ [DB] Using JSON database (whatsasena.json)');
    } catch {
        _data = _DEFAULTS();
    }
}

_init();

export function registerSettingsListener(fn) { _settingsListeners.push(fn); }
export function registerSudoListener(fn)     { _sudoListeners.push(fn); }
export function registerBannedListener(fn)   { _bannedListeners.push(fn); }

export async function getSettings() {
    _init();
    return Object.assign({ device: 'default', prefix: '.', mode: 'public', warn_limit: 3 }, _data.settings || {});
}

export async function updateSetting(key, value) {
    _init();
    if (!_data.settings) _data.settings = {};
    _data.settings[key] = value;
    _save();
    _settingsListeners.forEach(fn => fn());
}

export async function getSudoUsers() {
    _init();
    return (_data.sudo_users || []).map(num => ({ num }));
}

export async function addSudoUser(num) {
    _init();
    if (!_data.sudo_users.includes(num)) { _data.sudo_users.push(num); _save(); }
    _sudoListeners.forEach(fn => fn());
}

export async function removeSudoUser(num) {
    _init();
    const i = _data.sudo_users.indexOf(num);
    if (i > -1) { _data.sudo_users.splice(i, 1); _save(); }
    _sudoListeners.forEach(fn => fn());
}

export async function getBannedUsers() {
    _init();
    return (_data.banned_users || []).map(num => ({ num }));
}

export async function banUser(num) {
    _init();
    if (!_data.banned_users.includes(num)) { _data.banned_users.push(num); _save(); }
    _bannedListeners.forEach(fn => fn());
}

export async function unbanUser(num) {
    _init();
    const i = _data.banned_users.indexOf(num);
    if (i > -1) { _data.banned_users.splice(i, 1); _save(); }
    _bannedListeners.forEach(fn => fn());
}

export async function getAllowedUsers() {
    _init();
    return (_data.allowed_users || []).map(num => ({ num }));
}

export async function addAllowedUser(num) {
    _init();
    if (!_data.allowed_users.includes(num)) { _data.allowed_users.push(num); _save(); }
}

export async function removeAllowedUser(num) {
    _init();
    const i = _data.allowed_users.indexOf(num);
    if (i > -1) { _data.allowed_users.splice(i, 1); _save(); }
}

export async function getGroupSettings(jid) {
    _init();
    return _data.group_settings?.[jid] || {};
}

export async function updateGroupSetting(jid, key, value) {
    _init();
    if (!_data.group_settings) _data.group_settings = {};
    if (!_data.group_settings[jid]) _data.group_settings[jid] = {};
    _data.group_settings[jid][key] = value;
    _save();
}

export async function getWarnLimit() {
    _init();
    return (_data.settings?.warn_limit) || 3;
}

export async function addWarning(jid, num) {
    _init();
    if (!_data.warn_data) _data.warn_data = {};
    const key = `${jid}:${num}`;
    _data.warn_data[key] = (_data.warn_data[key] || 0) + 1;
    _save();
    return _data.warn_data[key];
}

export async function getWarnings(jid, num) {
    _init();
    return _data.warn_data?.[`${jid}:${num}`] || 0;
}

export async function resetWarnings(jid, num) {
    _init();
    if (_data.warn_data) { delete _data.warn_data[`${jid}:${num}`]; _save(); }
}

// ── Warn aliases (BLACK PANTHER MD naming) ───────────────────────────────────────────

export async function getWarnCount(jid, user) {
    _init();
    return _data.warn_data?.[`${jid}|${user}`] || 0;
}

export async function addWarn(jid, user) {
    _init();
    if (!_data.warn_data) _data.warn_data = {};
    const key = `${jid}|${user}`;
    _data.warn_data[key] = (_data.warn_data[key] || 0) + 1;
    _save();
    return _data.warn_data[key];
}

export async function resetWarn(jid, user) {
    _init();
    if (_data.warn_data) { delete _data.warn_data[`${jid}|${user}`]; _save(); }
}

export async function setWarnLimit(jid, limit) {
    return updateGroupSetting(jid, 'warn_limit', parseInt(limit) || 3);
}

// ── Conversation history ──────────────────────────────────────────────────────

export async function getConversationHistory(num) {
    _init();
    return (_data.conversation_history || []).filter(r => r.num === num);
}

export async function addConversationMessage(num, role, message) {
    _init();
    if (!_data.conversation_history) _data.conversation_history = [];
    _data.conversation_history.push({ num, role, message, timestamp: Math.floor(Date.now() / 1000) });
    const msgs = _data.conversation_history.filter(r => r.num === num);
    if (msgs.length > 50) {
        const toRemove = msgs.slice(0, msgs.length - 50);
        _data.conversation_history = _data.conversation_history.filter(r => !toRemove.includes(r));
    }
    _save();
}

export async function clearConversationHistory(num) {
    _init();
    if (_data.conversation_history) {
        _data.conversation_history = _data.conversation_history.filter(r => r.num !== num);
        _save();
    }
}

export function clearOldConversationHistory(hoursOld = 5) {
    _init();
    if (_data.conversation_history) {
        const cutoff = Math.floor(Date.now() / 1000) - hoursOld * 3600;
        _data.conversation_history = _data.conversation_history.filter(r => (r.timestamp || 0) > cutoff);
        _save();
    }
}
