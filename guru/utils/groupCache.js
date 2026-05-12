'use strict';
// ═══════════════════════════════════════════════════════════════
//  Group Metadata Cache — 10min TTL, stampede guard
// ═══════════════════════════════════════════════════════════════

const TTL = 10 * 60 * 1000;

const cache   = new Map();
const pending = new Map();

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
    const hit = getCached(jid);
    if (hit) return hit;

    if (pending.has(jid)) return pending.get(jid);

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
