'use strict';
const clients = new Set();
function broadcast(payload) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
        try { res.write(data); } catch { clients.delete(res); }
    }
}
function patchLogger(logger) {
    const LEVELS = ['info', 'warn', 'error', 'success', 'debug'];
    for (const level of LEVELS) {
        const orig = logger[level].bind(logger);
        logger[level] = (tag, msg) => {
            orig(tag, msg);
            broadcast({ type: 'log', level, tag, msg, ts: new Date().toISOString() });
        };
    }
}
function broadcastConnection(state, jid, reason) {
    broadcast({ type: 'connection', state, jid: jid || '', reason: reason || '' });
}
function broadcastMessage({ from, chat, text, isCmd, isGroup, response }) {
    broadcast({ type: 'message', from, chat, text, isCmd, isGroup, response, ts: new Date().toISOString() });
}
function sseHandler(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    res.write(': connected\n\n');
    clients.add(res);
    const hb = setInterval(() => {
        try { res.write(': heartbeat\n\n'); } catch { clearInterval(hb); }
    }, 25000);
    req.on('close', () => { clearInterval(hb); clients.delete(res); });
}
module.exports = { patchLogger, sseHandler, broadcastConnection, broadcastMessage, broadcast };
