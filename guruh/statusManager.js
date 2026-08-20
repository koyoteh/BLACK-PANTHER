'use strict';
// ╭─────────────────────────────────────────────────────────────╮
//   BLACK PANTHER MD  ·  guruh/statusManager.js
//   Bridge/alias so plugins inside guruh/ can import:
//     require('../statusManager')
//   and resolve to the real module at guru/handlers/statusManager.js
//   Do NOT put business logic here — edit the real module instead.
// └──𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ────────────────────────────────────────────────╯

module.exports = require('../guru/handlers/statusManager');
