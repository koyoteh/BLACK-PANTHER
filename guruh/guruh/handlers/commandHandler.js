import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const loader = require('../../guru/handlers/loader.js');

export const commands = loader.commands;

export const aliases = (() => {
    const map = new Map();
    for (const [key, cmd] of loader.commands.entries()) {
        if (key !== cmd.name.toLowerCase()) {
            map.set(key, cmd.name);
        }
    }
    return map;
})();
