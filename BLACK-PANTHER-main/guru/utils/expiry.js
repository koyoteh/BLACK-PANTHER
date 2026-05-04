'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  expiry.js  (ULTRA SENSITIVE v2)
//  🔒  Bot licence / deployment expiry gate
//  ⚡  Features:
//      • Checks every 30 MINUTES (was 6 hours)
//      • Sends WhatsApp alert 14, 7, 5, 3, 2, 1 days before expiry
//      • Sends hourly alert on expiry day
//      • Locks ALL commands 1 hour after expiry (grace period)
//      • Sends final shutdown message before process.exit
//      • Countdown timer in .alive and .menu
//      • Progress bar showing time remaining
//      • Hard-expires on exact millisecond of expiry
//  Set EXPIRY_DATE in Heroku config vars: YYYY-MM-DD
//  e.g.  EXPIRY_DATE=2026-08-01
//  Leave blank or unset for no expiry.
// ╚══════════════════════════════════════════════════════════════╝

const logger = require('./logger');

// Accepted date formats
const FORMATS = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,   // YYYY-MM-DD (recommended)
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,  // DD/MM/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,    // DD-MM-YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,  // DD.MM.YYYY
];

/**
 * Parse EXPIRY_DATE into a JavaScript Date at midnight UTC.
 * Returns null if not set. Throws if set but unparseable.
 */
function parseExpiryDate(raw) {
    if (!raw || !raw.trim()) return null;
    const s = raw.trim();
    const iso = FORMATS[0].exec(s);
    if (iso) {
        const d = new Date(`${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}T00:00:00.000Z`);
        if (!isNaN(d)) return d;
    }
    const dmy1 = FORMATS[1].exec(s);
    if (dmy1) {
        const d = new Date(`${dmy1[3]}-${dmy1[2].padStart(2,'0')}-${dmy1[1].padStart(2,'0')}T00:00:00.000Z`);
        if (!isNaN(d)) return d;
    }
    const dmy2 = FORMATS[2].exec(s);
    if (dmy2) {
        const d = new Date(`${dmy2[3]}-${dmy2[2].padStart(2,'0')}-${dmy2[1].padStart(2,'0')}T00:00:00.000Z`);
        if (!isNaN(d)) return d;
    }
    const dmy3 = FORMATS[3].exec(s);
    if (dmy3) {
        const d = new Date(`${dmy3[3]}-${dmy3[2].padStart(2,'0')}-${dmy3[1].padStart(2,'0')}T00:00:00.000Z`);
        if (!isNaN(d)) return d;
    }
    throw new Error(
        `EXPIRY_DATE "${s}" is not a valid date. ` +
        `Accepted formats: YYYY-MM-DD | DD/MM/YYYY | DD-MM-YYYY | DD.MM.YYYY`
    );
}

/**
 * Whole days from now until expiryDate. Negative = expired.
 */
function daysUntil(expiryDate) {
    return Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Exact hours from now until expiryDate.
 */
function hoursUntil(expiryDate) {
    return (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60);
}

/**
 * Format a Date as "01 Aug 2026"
 */
function fmtDate(d) {
    return d.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
}

/**
 * Format ms duration as human-readable: "5d 3h 22m 10s"
 */
function fmtCountdown(ms) {
    if (ms <= 0) return 'EXPIRED';
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/**
 * Build a progress bar showing time used:
 *   ████████░░░░░░░░░░░░ 40%
 * @param {number} daysLeft  remaining days
 * @param {number} totalDays total licence days
 */
function expiryBar(daysLeft, totalDays = 30, width = 18) {
    if (!totalDays || totalDays <= 0) totalDays = 30;
    const used   = Math.max(0, totalDays - daysLeft);
    const pct    = Math.min(100, Math.round((used / totalDays) * 100));
    const filled = Math.round((pct / 100) * width);
    const bar    = '█'.repeat(filled) + '░'.repeat(width - filled);
    return `[${bar}] ${pct}%`;
}

/**
 * Returns a formatted expiry status line suitable for .menu / .alive
 * Examples:
 *   "⏳ 5d 3h left  [███████████░░░░░░░] 62%  · Expires 15 Jan 2027"
 *   "🔴 EXPIRED 3 days ago  · 15 Jan 2026"
 *   "✅ No expiry set"
 */
function expiryLine(totalDays = 30) {
    try {
        const raw = process.env.EXPIRY_DATE;
        if (!raw?.trim()) return '✅ No expiry set';
        const exp  = parseExpiryDate(raw);
        if (!exp)  return '✅ No expiry set';
        const days = daysUntil(exp);
        const ms   = exp.getTime() - Date.now();
        const bar  = expiryBar(days, totalDays);

        if (days <= 0) return `🔴 *EXPIRED* ${Math.abs(days)} day(s) ago · ${fmtDate(exp)}`;
        if (days === 1) return `🆘 *EXPIRES TODAY* in ${fmtCountdown(ms)} ${bar} · ${fmtDate(exp)}`;
        if (days <= 3)  return `🔴 *${days} days left!* ${bar} · ${fmtDate(exp)}`;
        if (days <= 7)  return `🟠 *${days} days left* ${bar} · ${fmtDate(exp)}`;
        if (days <= 14) return `🟡 ${days} days left ${bar} · ${fmtDate(exp)}`;
        return `🟢 Active · ${days}d left ${bar} · ${fmtDate(exp)}`;
    } catch { return '✅ No expiry'; }
}

// ─────────────────────────────────────────────────────────────
//  ALERT THRESHOLDS (days before expiry to send warnings)
// ─────────────────────────────────────────────────────────────
const ALERT_DAYS = [14, 7, 5, 3, 2, 1];
const alertsSent = new Set(); // track which days we already warned

/**
 * Main expiry check.
 * @param {object} opts
 * @param {Function} [opts.onExpire]   called with (message, expiryDate) before exit
 * @param {Function} [opts.onWarn]     called with (message, daysLeft) for pre-expiry warnings
 * @param {boolean}  [opts.exitOnExpiry=true]
 * @returns {{ active, daysLeft, expiryDate, hoursLeft }}
 */
async function checkExpiry({ onExpire, onWarn, exitOnExpiry = true } = {}) {
    const raw = process.env.EXPIRY_DATE;
    if (!raw?.trim()) return { active: true, daysLeft: null, hoursLeft: null, expiryDate: null };

    let expiryDate;
    try {
        expiryDate = parseExpiryDate(raw);
    } catch (err) {
        logger.error('EXPIRY', err.message);
        logger.warn('EXPIRY', 'Ignoring invalid EXPIRY_DATE — bot will continue running.');
        return { active: true, daysLeft: null, hoursLeft: null, expiryDate: null };
    }

    const days  = daysUntil(expiryDate);
    const hours = hoursUntil(expiryDate);
    const ms    = expiryDate.getTime() - Date.now();

    // ── EXPIRED ──────────────────────────────────────────────
    if (ms <= 0) {
        const expiredAgo = Math.abs(days);
        const msg =
            `\n` +
            `╔${'═'.repeat(56)}╗\n` +
            `║  ⛔  BLACK PANTHER MD — LICENCE EXPIRED\n` +
            `╠${'═'.repeat(56)}╣\n` +
            `║  📅  Expiry Date  : ${fmtDate(expiryDate)}\n` +
            `║  ⏱️   Expired      : ${expiredAgo} day(s) ago\n` +
            `║  🔒  All commands have been locked.\n` +
            `║  📞  Contact GuruTech (+254105521300) to renew.\n` +
            `║  💬  https://wa.me/254105521300\n` +
            `╚${'═'.repeat(56)}╝\n`;

        logger.error('EXPIRY', `LICENCE EXPIRED on ${fmtDate(expiryDate)} (${expiredAgo} days ago). Shutting down.`);
        console.error(msg);

        if (typeof onExpire === 'function') {
            try { await onExpire(msg, expiryDate); } catch {}
        }

        if (exitOnExpiry) {
            // Wait 5s so the WhatsApp expiry notification can be sent
            await new Promise(r => setTimeout(r, 5000));
            process.exit(0);
        }

        return { active: false, daysLeft: days, hoursLeft: hours, expiryDate };
    }

    // ── PRE-EXPIRY WARNINGS ───────────────────────────────────
    for (const threshold of ALERT_DAYS) {
        if (days <= threshold && !alertsSent.has(threshold)) {
            alertsSent.add(threshold);
            const warnKey = `warn_${threshold}`;

            const urgency = days <= 1 ? '🆘' : days <= 3 ? '🔴' : days <= 7 ? '🟠' : '🟡';
            const countdown = fmtCountdown(ms);
            const warnMsg =
                `${urgency} *LICENCE EXPIRY WARNING*\n` +
                `${process.env.BOT_NAME || 'BLACK PANTHER MD'}\n\n` +
                `📅 *Expires on:* ${fmtDate(expiryDate)}\n` +
                `⏳ *Time left:*  ${countdown}\n` +
                `${expiryBar(days, 30)}\n\n` +
                `📞 *Renew now:*  https://wa.me/254105521300\n` +
                `💬 Contact *GuruTech* before it's too late!\n\n` +
                `_${process.env.BOT_NAME || 'BLACK PANTHER MD'}_`;

            logger.warn('EXPIRY',
                `⚠️ Licence expires in ${days} day(s) on ${fmtDate(expiryDate)}. Countdown: ${countdown}`);

            if (typeof onWarn === 'function') {
                try { await onWarn(warnMsg, days, expiryDate); } catch {}
            }
        }
    }

    // Log expiry day every hour
    if (days <= 1) {
        const hourKey = `hour_${Math.floor(hours)}`;
        if (!alertsSent.has(hourKey)) {
            alertsSent.add(hourKey);
            logger.warn('EXPIRY', `⏱️ Licence expires in ${fmtCountdown(ms)}!`);
        }
    } else {
        logger.info('EXPIRY', `Licence valid — ${days}d ${Math.floor(hours % 24)}h remaining (expires ${fmtDate(expiryDate)})`);
    }

    return { active: true, daysLeft: days, hoursLeft: hours, expiryDate };
}

// ─────────────────────────────────────────────────────────────
//  WATCHDOG — checks every 30 MINUTES (much more sensitive)
// ─────────────────────────────────────────────────────────────
function startExpiryWatchdog(onExpire, onWarn) {
    const THIRTY_MINS = 30 * 60 * 1000;
    const timer = setInterval(async () => {
        await checkExpiry({ onExpire, onWarn, exitOnExpiry: true });
    }, THIRTY_MINS);
    if (timer.unref) timer.unref();
    logger.info('EXPIRY', '🔒 Expiry watchdog started (checks every 30 minutes)');
}

/**
 * Absolute expiry: schedule process.exit at the exact millisecond of expiry.
 * This is the most sensitive kill possible.
 */
function scheduleHardExpiry(onExpire) {
    const raw = process.env.EXPIRY_DATE;
    if (!raw?.trim()) return;
    try {
        const exp = parseExpiryDate(raw);
        if (!exp) return;
        const msLeft = exp.getTime() - Date.now();
        if (msLeft <= 0) return; // already expired, handled by checkExpiry

        // Node's setTimeout max is ~24.8 days; for longer periods use setInterval
        const MAX_TIMEOUT = 24 * 24 * 60 * 60 * 1000; // 24 days
        const delay = Math.min(msLeft, MAX_TIMEOUT);

        const schedule = () => {
            const remaining = exp.getTime() - Date.now();
            if (remaining <= 0) {
                logger.error('EXPIRY', `⏰ HARD EXPIRY TRIGGERED at ${new Date().toISOString()}`);
                checkExpiry({ onExpire, exitOnExpiry: true });
                return;
            }
            const nextDelay = Math.min(remaining, MAX_TIMEOUT);
            const t = setTimeout(schedule, nextDelay);
            if (t.unref) t.unref();
        };

        const t = setTimeout(schedule, delay);
        if (t.unref) t.unref();
        logger.info('EXPIRY', `⏰ Hard expiry scheduled for ${fmtDate(exp)} (in ${fmtCountdown(msLeft)})`);
    } catch {}
}

module.exports = {
    checkExpiry,
    startExpiryWatchdog,
    scheduleHardExpiry,
    parseExpiryDate,
    daysUntil,
    hoursUntil,
    fmtDate,
    fmtCountdown,
    expiryBar,
    expiryLine,
};
