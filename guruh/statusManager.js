'use strict';
// ╭─────────────────────────────────────────────────────────────╮
//   Tehseen Tech Automation  ·  guruh/statusManager.js
//   Bridge/alias so plugins inside guruh/ can import:
//     require('../statusManager')
//   and resolve to the real module at guru/handlers/statusManager.js
//   Do NOT put business logic here — edit the real module instead.
// └──𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇────────────────────────────────────────────────╯

module.exports = require('../guru/handlers/statusManager');
