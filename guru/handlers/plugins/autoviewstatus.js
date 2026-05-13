'use strict';
const config = require('../../config/settings');

async function handleAutoView(sock, key, message) {
    if (config.AUTO_READ_STATUS !== 'true' && config.AUTO_READ_STATUS !== true) return;
    try {
        await sock.readMessages([key]);
    } catch {}
}

module.exports = { handleAutoView };
