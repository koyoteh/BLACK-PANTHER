'use strict';
// ╭─────────────────────────────────────────────────────────────╮
//   Tehseen Tech Automation  ·  guruh/botname.js
//   Provides getBotName() helper used by plugins that need the
//   bot's display name without a circular import back into the
//   full config tree.
// └──𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇────────────────────────────────────────────────╯

const config = require('../guru/config/settings');

/**
 * Returns the bot's current display name.
 * Falls back to 'Tehseen Tech Automation' if config hasn't loaded yet.
 */
function getBotName() {
    return (config && config.BOT_NAME) || process.env.BOT_NAME || 'Tehseen Tech Automation';
}

module.exports = { getBotName };
