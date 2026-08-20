import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const _cfg = require('../../guru/config/settings.js');

const _DEFAULTS = {
    device:        'default',
    prefix:        _cfg.BOT_PREFIX    || '.',
    mode:          _cfg.MODE          || 'public',
    gcpresence:    false,
    antitag:       false,
    antidelete:    true,
    antilink:      'off',
    antibot:       false,
    chatbotpm:     false,
    packname:      _cfg.BOT_NAME      || 'BLACK PANTHER MD',
    author:        _cfg.OWNER_NAME    || 'Koyoteh',
    multiprefix:   false,
    stealth:       false,
    startmessage:  true,
    autoview:      false,
    autoai:        false,
    warn_limit:    3,
    autobio:       false,
    presence:      'off',
    autoread:      false,
    autolike:      false,
    anticall:      false,
    antiviewonce:  false,
};

let _cache = null;
let _listeners = [];
let _sudoListeners = [];
let _bannedListeners = [];

export function registerSettingsListener(fn) { _listeners.push(fn); }
export function registerSudoListener(fn)     { _sudoListeners.push(fn); }
export function registerBannedListener(fn)   { _bannedListeners.push(fn); }

export async function getCachedSettings()      { return _cache || _DEFAULTS; }
export function getCachedSettingsSync()        { return _cache || _DEFAULTS; }
export async function getCachedSudo()          { return []; }
export function getCachedSudoSync()            { return []; }
export async function getCachedBanned()        { return []; }
export function getCachedBannedSync()          { return []; }
export async function getCachedAllowed()       { return []; }
export function invalidateSettings()           { _cache = null; }
export function invalidateSudo()               {}
export function invalidateBanned()             {}
export function invalidateAllowed()            {}
