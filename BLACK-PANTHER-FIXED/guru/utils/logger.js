'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  Smart Logger
//  Auto-detects: Heroku · Panel/VPS · Railway · Render · Local
// ╚══════════════════════════════════════════════════════════════╝

const moment = require('moment-timezone');
const TZ     = process.env.TIME_ZONE || 'Africa/Nairobi';

// ── Platform detection ─────────────────────────────────────────
const IS_HEROKU  = !!process.env.DYNO;
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const IS_RENDER  = !!process.env.RENDER;
const IS_KOYEB   = !!process.env.KOYEB_SERVICE_NAME;
const IS_TTY     = !!process.stdout.isTTY;
// Panel/VPS: no TTY AND not a recognised cloud platform
// (Docker containers on panel hosts also have no TTY)
const IS_CLOUD   = IS_HEROKU || IS_RAILWAY || IS_RENDER || IS_KOYEB;
const IS_PANEL   = !IS_CLOUD && !IS_TTY;
const IS_LOCAL   = IS_TTY && !IS_CLOUD;

const PLATFORM =
    IS_HEROKU  ? 'Heroku'  :
    IS_RAILWAY ? 'Railway' :
    IS_RENDER  ? 'Render'  :
    IS_KOYEB   ? 'Koyeb'   :
    IS_PANEL   ? 'Panel'   : 'Local';

// ── ANSI colours (only for local TTY) ─────────────────────────
const C = IS_LOCAL ? {
    reset:'\x1b[0m', bold:'\x1b[1m',
    green:'\x1b[32m', cyan:'\x1b[36m', yellow:'\x1b[33m',
    red:'\x1b[31m', magenta:'\x1b[35m', blue:'\x1b[34m', gray:'\x1b[90m',
} : Object.fromEntries(
    ['reset','bold','green','cyan','yellow','red','magenta','blue','gray'].map(k=>[k,''])
);

function ts() { return moment().tz(TZ).format('HH:mm:ss'); }

// ── Per-platform log strategies ───────────────────────────────

// Heroku / Railway / Render / Koyeb — one-line, no box chars, no ANSI
// Heroku charges per log line so we keep it minimal
function cloudLog(level, tag, msg) {
    const L = { info:'INFO', warn:'WARN', error:'ERR ', success:'OK  ', debug:'DBG ' };
    process.stdout.write(`[${ts()}] ${L[level]||level.toUpperCase()} [${tag}] ${msg}\n`);
}

// Panel / VPS  — clean lines, emoji bullets, no ANSI colours
function panelLog(level, tag, msg) {
    const I = { info:'ℹ️', warn:'⚠️', error:'❌', success:'✅', debug:'🔧' };
    process.stdout.write(`${I[level]||'•'} [${ts()}] [${tag}] ${msg}\n`);
}

// Local TTY — full colour + box-drawing
function localLog(level, tag, msg) {
    const S = {
        info:    `${C.cyan}${C.bold}[INFO ]${C.reset}`,
        warn:    `${C.yellow}${C.bold}[WARN ]${C.reset}`,
        error:   `${C.red}${C.bold}[ERROR]${C.reset}`,
        success: `${C.green}${C.bold}[ OK  ]${C.reset}`,
        debug:   `${C.gray}${C.bold}[DEBUG]${C.reset}`,
    };
    const t = `${C.gray}${ts()}${C.reset}`;
    const g = `${C.magenta}[${tag}]${C.reset}`;
    process.stdout.write(`${t} ${S[level]||level} ${g} ${msg}\n`);
}

function log(level, tag, msg) {
    if (IS_CLOUD) return cloudLog(level, tag, msg);
    if (IS_PANEL) return panelLog(level, tag, msg);
    return localLog(level, tag, msg);
}

// ── Startup banner ─────────────────────────────────────────────
function printBanner(name, owner, num, prefix, mode, ver) {
    if (IS_CLOUD) {
        // Minimal single line — don't waste Heroku log quota
        console.log(`[BOOT] ${name} v${ver} | ${owner} +${num} | prefix:${prefix} mode:${mode} | ${PLATFORM}`);
        return;
    }
    if (IS_PANEL) {
        console.log(`\n${'─'.repeat(48)}`);
        console.log(`  🐾  ${name}  v${ver}`);
        console.log(`  👑  Owner   : ${owner} (+${num})`);
        console.log(`  🔧  Prefix  : ${prefix}    Mode: ${mode}`);
        console.log(`  🖥️   Platform: ${PLATFORM}`);
        console.log(`  ⏰  Started : ${ts()}`);
        console.log(`${'─'.repeat(48)}\n`);
        return;
    }
    // Local — Vesper-Xmd inspired ❖ banner
    const line = (label, val) =>
        `${C.cyan}├─❖${C.reset} ${C.yellow}${label}:${C.reset} ${val}`;

    console.log(`${C.cyan}╭─❖${C.reset} ${C.bold}${C.green}${name}${C.reset} ${C.gray}v${ver}${C.reset} ${C.cyan}❖─╮${C.reset}`);
    console.log(`${C.cyan}│${C.reset}`);
    console.log(line('Status ', `${C.green}✅ ONLINE${C.reset}`));
    console.log(line('Owner  ', `${owner} (+${num})`));
    console.log(line('Prefix ', `[ ${prefix} ]`));
    console.log(line('Mode   ', mode));
    console.log(line('Host   ', PLATFORM));
    console.log(line('Time   ', ts()));
    console.log(`${C.cyan}│${C.reset}`);
    console.log(`${C.cyan}╰─❖${C.reset} ${C.bold}Powered by GuruTech${C.reset} ${C.cyan}❖─╯${C.reset}\n`);
}

module.exports = {
    info:    (tag, msg) => log('info',    tag, msg),
    warn:    (tag, msg) => log('warn',    tag, msg),
    error:   (tag, msg) => log('error',   tag, msg),
    success: (tag, msg) => log('success', tag, msg),
    debug:   (tag, msg) => { if (process.env.DEBUG==='true') log('debug', tag, msg); },
    banner:  printBanner,
    PLATFORM, IS_HEROKU, IS_PANEL, IS_LOCAL, IS_CLOUD,
};
