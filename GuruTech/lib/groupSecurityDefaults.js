export const GROUP_SECURITY_MODES = Object.freeze({
    antilink: ['off', 'delete', 'warn', 'kick'],
    antibot: ['off', 'warn', 'remove'],
    antipromo: ['off', 'delete', 'warn', 'kick']
});

const ENV_KEYS = Object.freeze({
    antilink: 'DEFAULT_ANTILINK_MODE',
    antibot: 'DEFAULT_ANTIBOT_MODE',
    antipromo: 'DEFAULT_ANTIPROMO_MODE'
});

function normalizeMode(key, value, { env = false } = {}) {
    if (value === undefined || value === null || value === '') return null;
    if (value === true || value === 1 || value === '1') return key === 'antilink' && !env ? 'delete' : 'warn';
    if (value === false || value === 0 || value === '0') return 'off';

    const mode = String(value).trim().toLowerCase();
    if (['on', 'enable', 'enabled', 'true', 'yes'].includes(mode)) return 'warn';
    if (['disable', 'disabled', 'false', 'no'].includes(mode)) return 'off';
    if (key === 'antibot' && mode === 'kick') return 'remove';
    return GROUP_SECURITY_MODES[key]?.includes(mode) ? mode : null;
}

export function getGroupSecurityDefaults(env = process.env) {
    return Object.fromEntries(Object.entries(ENV_KEYS).map(([key, envKey]) => [
        key,
        normalizeMode(key, env?.[envKey], { env: true }) || 'off'
    ]));
}

export function parseGroupSecurityOverrides(raw) {
    let parsed = raw;
    if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { parsed = {}; }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const result = {};
    for (const key of Object.keys(GROUP_SECURITY_MODES)) {
        const value = parsed[key];
        if (value === true || value === 1 || value === '1' || value === 'true') result[key] = true;
    }
    return result;
}

export function resolveGroupSecurityMode(key, savedMode, overrides = {}, defaults = getGroupSecurityDefaults()) {
    if (!GROUP_SECURITY_MODES[key]) return 'off';
    const normalized = normalizeMode(key, savedMode) || 'off';
    if (overrides?.[key] === true) return normalized;
    if (normalized !== 'off') return normalized;
    return defaults?.[key] || 'off';
}
