'use strict';
const fs   = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '../../guruh/plugins');

const commands = new Map();
const triggers  = [];

function addCmd({ name, aliases = [], handler, desc = '', usage = '', category = 'misc', ownerOnly = false, groupOnly = false, adminOnly = false }) {
    const entry = { name, aliases, handler, desc, usage, category, ownerOnly, groupOnly, adminOnly };
    if (!commands.has(name.toLowerCase())) {
        commands.set(name.toLowerCase(), entry);
    }
    for (const alias of aliases) {
        if (!commands.has(alias.toLowerCase())) {
            commands.set(alias.toLowerCase(), entry);
        }
    }
}

function addTrigger({ pattern, handler }) {
    triggers.push({ pattern, handler });
}

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

function findCmd(name) {
    return commands.get(name?.toLowerCase()) || null;
}

function getAllCmds() {
    const seen = new Set();
    return [...commands.values()].filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
    });
}

module.exports = { addCmd, addTrigger, loadPlugins, findCmd, getAllCmds, commands, triggers };
