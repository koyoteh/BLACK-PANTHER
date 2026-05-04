'use strict';
// ═══════════════════════════════════════════════════════════════
//  Group Metadata Cache
//  Avoids a live WhatsApp round-trip on every group message.
//  TTL = 10 minutes (was 5 — groups rarely change that fast).
//  Invalidated immediately on group-participants.update events.
//  Stampede guard: concurrent fetches for the same JID share one
//  pending promise instead of hammering the WA server N times.
// ═══════════════════════════════════════════════════════════════

const TTL = 10 * 60 * 1000;  // 10 minutes

const cache   = new Map(); // jid → { meta, ts }
const pending = new Map(); // jid → Promise  (stampede guard)

function getCached(jid) {
    const entry = cache.get(jid);
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL) { cache.delete(jid); return null; }
    return entry.meta;
}

function setCached(jid, meta) {
    cache.set(jid, { meta, ts: Date.now() });
}

function invalidate(jid) {
    if (jid) cache.delete(jid);
    else cache.clear();
}

async function getGroupMeta(sock, jid) {
    // 1. Cache hit
    const hit = getCached(jid);
    if (hit) return hit;

    // 2. Stampede guard — if a fetch is already in-flight, reuse it
    if (pending.has(jid)) return pending.get(jid);

    // 3. Fresh fetch
    const p = sock.groupMetadata(jid).then(meta => {
        setCached(jid, meta);
        pending.delete(jid);
        return meta;
    }).catch(err => {
        pending.delete(jid);
        throw err;
    });

    pending.set(jid, p);
    return p;
}

module.exports = { getCached, setCached, invalidate, getGroupMeta };
