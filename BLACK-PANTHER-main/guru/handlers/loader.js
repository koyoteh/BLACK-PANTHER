'use strict';
const fs   = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '../../guruh/plugins');

/** Registry: Map<commandName, handlerFn> */
const commands = new Map();
/** Registry: Array<{ pattern: RegExp, handler: fn }> for body-based triggers */
const triggers  = [];

/**
 * Registers a command handler.
 * Called from every plugin file via:
 *   loader.addCmd({ name, aliases, handler })
 */
function addCmd({ name, aliases = [], handler, desc = '', usage = '', category = 'misc', ownerOnly = false, groupOnly = false, adminOnly = false }) {
    const entry = { name, aliases, handler, desc, usage, category, ownerOnly, groupOnly, adminOnly };
    commands.set(name.toLowerCase(), entry);
    for (const alias of aliases) commands.set(alias.toLowerCase(), entry);
}

/**
 * Registers a body-pattern trigger.
 *   loader.addTrigger({ pattern, handler })
 */
function addTrigger({ pattern, handler }) {
    triggers.push({ pattern, handler });
}

/** Load all plugin files from lib/plugins/ */
function loadPlugins() {
    const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
    let loaded = 0;
    for (const file of files) {
        try {
            require(path.join(PLUGINS_DIR, file));
            loaded++;
        } catch (err) {
            console.error(`[LOADER] Failed to load plugin ${file}:`, err.message);
        }
    }
    console.log(`[LOADER] ${loaded}/${files.length} plugins loaded`);
}

/** Find a command by name (case-insensitive) */
function findCmd(name) {
    return commands.get(name?.toLowerCase()) || null;
}

/** Get all registered commands (for menu generation) */
function getAllCmds() {
    const seen = new Set();
    return [...commands.values()].filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
    });
}

module.exports = { addCmd, addTrigger, loadPlugins, findCmd, getAllCmds, commands, triggers };
