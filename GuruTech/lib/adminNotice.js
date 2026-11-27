/**
 * Shared gate for the "Make me admin so I can actually do something about it" notice.
 *
 * Why this exists:
 * Group security features (antilink, antisticker, antibadword, ...) used to reply
 * with a nag on *every* offending message whenever the bot was not a group admin.
 * A single link (or the same message delivered several times by Baileys) produced
 * a wall of identical messages. This module makes that impossible:
 *
 *  - the notice is OFF by default, so a bot without admin rights stays completely
 *    silent;
 *  - when explicitly enabled, it is sent at most once per chat per cooldown window
 *    (default 6 hours) instead of once per message;
 *  - a message id is only ever handled once per chat, which kills duplicate
 *    deliveries/retry receipts and stops two features from both nagging about the
 *    same message.
 *
 * Configuration (all optional):
 *   ADMIN_NOTICE_ENABLED=true        enable the notice (default: false = silent)
 *   ADMIN_NOTICE_COOLDOWN_MS=21600000  per-chat cooldown, default 6 hours
 */

const DEFAULT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const MESSAGE_TTL_MS = 10 * 60 * 1000;
const MAX_TRACKED_ENTRIES = 5000;

const _truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());

const NOTICE_ENABLED = _truthy(process.env.ADMIN_NOTICE_ENABLED);

const COOLDOWN_MS = (() => {
    const raw = Number(process.env.ADMIN_NOTICE_COOLDOWN_MS);
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return DEFAULT_COOLDOWN_MS;
})();

const lastNoticeAt = new Map();
const handledMessages = new Map();

function pruneStale(map, ttl, now) {
    if (map.size <= MAX_TRACKED_ENTRIES) return;
    for (const [key, timestamp] of map) {
        if (now - timestamp >= ttl) map.delete(key);
    }
    if (map.size <= MAX_TRACKED_ENTRIES) return;
    const overflow = map.size - MAX_TRACKED_ENTRIES;
    let removed = 0;
    for (const key of map.keys()) {
        map.delete(key);
        if (++removed >= overflow) break;
    }
}

/**
 * Returns true the first time a given message is seen in a chat, false for
 * duplicate deliveries (retry receipts, history sync, multi-feature matches).
 */
export function isFirstDelivery(chatId, messageId, now = Date.now()) {
    if (!chatId || !messageId) return true;
    const key = `${chatId}:${messageId}`;
    const seenAt = handledMessages.get(key);
    if (seenAt && now - seenAt < MESSAGE_TTL_MS) return false;
    handledMessages.set(key, now);
    pruneStale(handledMessages, MESSAGE_TTL_MS, now);
    return true;
}

/** Returns true when the per-chat cooldown allows another notice. */
export function canSendAdminNotice(chatId, now = Date.now()) {
    if (!chatId) return false;
    const last = lastNoticeAt.get(chatId) || 0;
    if (now - last < COOLDOWN_MS) return false;
    lastNoticeAt.set(chatId, now);
    pruneStale(lastNoticeAt, COOLDOWN_MS, now);
    return true;
}

/**
 * Sends the "promote me" notice, subject to the dedupe + cooldown gates.
 * Returns true when a message was actually sent.
 */
export async function notifyMissingAdmin(client, m, sender, text) {
    const chatId = m?.chat;
    if (!chatId || !text) return false;

    if (!isFirstDelivery(chatId, m?.key?.id)) return false;

    if (!NOTICE_ENABLED) {
        return false;
    }

    if (!canSendAdminNotice(chatId)) return false;

    try {
        await client.sendMessage(chatId, {
            text,
            mentions: sender ? [sender] : []
        });
        return true;
    } catch (err) {
        console.error('[ADMIN NOTICE] Failed to send notice:', err.message);
        return false;
    }
}

/** Exposed for tests and for logging config at startup. */
export const adminNoticeConfig = {
    enabled: NOTICE_ENABLED,
    cooldownMs: COOLDOWN_MS
};

export default notifyMissingAdmin;
