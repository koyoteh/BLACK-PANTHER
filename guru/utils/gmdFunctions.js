'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  gmdFunctions.js  (Core Utilities)
//  👑  Owner : GuruTech  |  📞 +254105521300
//  🔧  Rich formatting · Media tools · Session · Upload helpers
// ╚══════════════════════════════════════════════════════════════╝

const fs        = require('fs-extra');
const path      = require('path');
const axios     = require('axios');
const FormData  = require('form-data');
const ffmpeg    = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config    = require('../config/settings');

ffmpeg.setFfmpegPath(ffmpegPath);

const TEMP_DIR = path.join(__dirname, '../../temp');
fs.ensureDirSync(TEMP_DIR);

// ═══════════════════════════════════════════════════════════════
//  🎨  RICH TEXT FORMATTERS
// ═══════════════════════════════════════════════════════════════

/**
 * Wraps text in a decorated box banner
 * @param {string} title
 * @param {string[]} lines
 * @param {string} footer
 */
function gmdBanner(title, lines = [], footer = '') {
    const top    = `╔${'═'.repeat(38)}╗`;
    const mid    = `╠${'═'.repeat(38)}╣`;
    const bot    = `╚${'═'.repeat(38)}╝`;
    const pad    = (s) => `║  ${s}${' '.repeat(Math.max(0, 36 - stripEmoji(s).length))}║`;

    let out = `${top}\n`;
    out    += pad(`🐾  *${title}*`) + '\n';
    if (lines.length) {
        out += `${mid}\n`;
        for (const line of lines) out += pad(line) + '\n';
    }
    if (footer) {
        out += `${mid}\n`;
        out += pad(`_${footer}_`) + '\n';
    }
    out += bot;
    return out;
}

/** Strip emoji/special chars for length calculation */
function stripEmoji(str) {
    return str.replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27FF}]|\*|_/gu, '').trim();
}

/**
 * Build a two-column table
 * @param {string} title  - Table heading
 * @param {Array<[string,string]>} rows - [label, value] pairs
 * @param {string} [footer]
 */
function gmdTable(title, rows = [], footer = '') {
    const DIV  = `┃${'━'.repeat(38)}┃`;
    const TOP  = `┏${'━'.repeat(38)}┓`;
    const BOT  = `┗${'━'.repeat(38)}┛`;
    const row  = (l, v) => {
        const label = String(l).padEnd(14);
        const value = String(v).slice(0, 20);
        return `┃  ${label}: ${value}`;
    };

    let out = `${TOP}\n`;
    out    += `┃  🐾  *${title}*\n`;
    out    += `${DIV}\n`;
    for (const [l, v] of rows) out += row(l, v) + '\n';
    if (footer) {
        out += `${DIV}\n`;
        out += `┃  _${footer}_\n`;
    }
    out += BOT;
    return out;
}

/**
 * Simple bulleted list with custom emoji bullet
 */
function gmdList(title, items = [], bullet = '◈', footer = '') {
    let out = `*${title}*\n${'─'.repeat(30)}\n`;
    items.forEach((item, i) => {
        out += `${bullet} ${item}\n`;
    });
    if (footer) out += `\n_${footer}_`;
    return out;
}

/**
 * Progress bar string  ▰▰▰▰▱▱▱▱  (filled/total)
 */
function gmdProgress(filled, total = 10, label = '') {
    const f = Math.round((filled / total) * 10);
    const bar = '▰'.repeat(f) + '▱'.repeat(10 - f);
    return `${bar} ${Math.round((filled / total) * 100)}%${label ? '  ' + label : ''}`;
}

/**
 * Convert seconds to mm:ss
 */
function fmtDuration(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

/**
 * Pretty-print bytes
 */
function fmtBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Fancy Unicode font styles
 */
const FONTS = {
    bold:    (s) => s.replace(/[a-zA-Z]/g, c => String.fromCodePoint(
        c >= 'a' && c <= 'z' ? 0x1D41A + c.charCodeAt(0) - 97 :
        0x1D400 + c.charCodeAt(0) - 65)),
    italic:  (s) => s.replace(/[a-zA-Z]/g, c => String.fromCodePoint(
        c >= 'a' && c <= 'z' ? 0x1D44E + c.charCodeAt(0) - 97 :
        0x1D434 + c.charCodeAt(0) - 65)),
    mono:    (s) => s.replace(/[a-zA-Z0-9]/g, c => String.fromCodePoint(
        c >= 'a' && c <= 'z' ? 0x1D670 + c.charCodeAt(0) - 97 :
        c >= 'A' && c <= 'Z' ? 0x1D670 + c.charCodeAt(0) - 65 - 32 :
        0x1D7F6 + c.charCodeAt(0) - 48)),
};

// ═══════════════════════════════════════════════════════════════
//  📥  MEDIA DOWNLOAD HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Download media from a Baileys message into a Buffer
 */
async function gmdBuffer(msg, type = 'buffer') {
    const message = msg?.message;
    if (!message) return null;

    const contentTypes = [
        'imageMessage', 'videoMessage', 'audioMessage',
        'stickerMessage', 'documentMessage', 'voiceMessage',
    ];

    let mediaMsg, mediaType;
    for (const t of contentTypes) {
        if (message[t]) { mediaMsg = message[t]; mediaType = t.replace('Message', ''); break; }
        const ctx = message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (ctx?.[t]) { mediaMsg = ctx[t]; mediaType = t.replace('Message', ''); break; }
    }
    if (!mediaMsg) return null;

    const stream = await downloadContentFromMessage(mediaMsg, mediaType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

/**
 * Download media and save to a temp file, returns file path
 */
async function gmdSave(msg, ext = '') {
    const buf = await gmdBuffer(msg);
    if (!buf) return null;
    const outPath = path.join(TEMP_DIR, `panther_${Date.now()}${ext ? '.' + ext : ''}`);
    await fs.writeFile(outPath, buf);
    return outPath;
}

// ═══════════════════════════════════════════════════════════════
//  🔊  AUDIO / VIDEO CONVERTERS
// ═══════════════════════════════════════════════════════════════

function runFfmpeg(inputPath, outputPath, options = []) {
    return new Promise((resolve, reject) => {
        let cmd = ffmpeg(inputPath);
        options.forEach(o => cmd = cmd.outputOptions(o));
        cmd.on('end', resolve).on('error', reject).save(outputPath);
    });
}

async function toAudio(buffer, ext = 'mp3') {
    const inp = path.join(TEMP_DIR, `in_${Date.now()}`);
    const out = path.join(TEMP_DIR, `out_${Date.now()}.${ext}`);
    await fs.writeFile(inp, buffer);
    await runFfmpeg(inp, out, ['-q:a 0', '-map a', '-vn']);
    const result = await fs.readFile(out);
    await fs.remove(inp).catch(() => {});
    await fs.remove(out).catch(() => {});
    return result;
}

async function toVideo(buffer) {
    const inp = path.join(TEMP_DIR, `in_${Date.now()}`);
    const out = path.join(TEMP_DIR, `out_${Date.now()}.mp4`);
    await fs.writeFile(inp, buffer);
    await runFfmpeg(inp, out, ['-c:v libx264', '-c:a aac', '-strict experimental']);
    const result = await fs.readFile(out);
    await fs.remove(inp).catch(() => {});
    await fs.remove(out).catch(() => {});
    return result;
}

async function toPtt(buffer) {
    const inp = path.join(TEMP_DIR, `in_${Date.now()}`);
    const out = path.join(TEMP_DIR, `out_${Date.now()}.ogg`);
    await fs.writeFile(inp, buffer);
    await runFfmpeg(inp, out, ['-c:a libopus', '-b:a 64k', '-vbr on', '-vn']);
    const result = await fs.readFile(out);
    await fs.remove(inp).catch(() => {});
    await fs.remove(out).catch(() => {});
    return result;
}

async function getVideoDuration(buffer) {
    const inp = path.join(TEMP_DIR, `dur_${Date.now()}`);
    await fs.writeFile(inp, buffer);
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inp, (err, meta) => {
            fs.remove(inp).catch(() => {});
            if (err) return reject(err);
            resolve(meta?.format?.duration || 0);
        });
    });
}

// ═══════════════════════════════════════════════════════════════
//  🖼️  IMAGE UTILITIES
// ═══════════════════════════════════════════════════════════════

async function gmdSticker(buffer, packname = config.PACK_NAME, author = config.PACK_AUTHOR) {
    try {
        const { StickerTypes, Sticker } = require('wa-sticker-formatter');
        const sticker = new Sticker(buffer, {
            pack:   packname,
            author: author,
            type:   StickerTypes.DEFAULT,
            quality: 50,
        });
        return sticker.toMessage();
    } catch {
        // Fallback: return raw buffer marked as sticker
        return { sticker: buffer, mimetype: 'image/webp' };
    }
}

// ═══════════════════════════════════════════════════════════════
//  ☁️  CDN / UPLOAD HELPERS
// ═══════════════════════════════════════════════════════════════

async function uploadToCatbox(buffer, ext = 'jpg') {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename: `file.${ext}`, contentType: 'application/octet-stream' });
    const res = await axios.post('https://catbox.moe/user.php', form, {
        headers: form.getHeaders(), timeout: 30000,
    });
    return res.data?.trim();
}

async function uploadToImgBB(buffer) {
    const base64 = buffer.toString('base64');
    const res    = await axios.post('https://api.imgbb.com/1/upload', null, {
        params:  { key: 'free', image: base64 },
        timeout: 30000,
    });
    return res.data?.data?.url || null;
}

async function uploadToTmpFiles(buffer, ext = 'jpg') {
    const form = new FormData();
    form.append('file', buffer, { filename: `upload.${ext}` });
    const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(), timeout: 30000,
    });
    return res.data?.data?.url?.replace('tmpfiles.org/', 'tmpfiles.org/dl/') || null;
}

// ═══════════════════════════════════════════════════════════════
//  🛠️  MISC UTILITIES
// ═══════════════════════════════════════════════════════════════

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isUrl(str) {
    try { return /^https?:\/\//.test(str) && Boolean(new URL(str)); }
    catch { return false; }
}

function isNumber(val) { return !isNaN(parseFloat(val)) && isFinite(val); }

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function cleanNumber(str = '') {
    return str.replace(/\D/g, '').replace(/^0/, '254');
}

function formatPhoneNumber(num = '') {
    const clean = cleanNumber(num);
    return clean ? `+${clean}` : num;
}

function truncate(str, len = 100) {
    return str?.length > len ? str.slice(0, len) + '…' : str;
}

function runtime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h ${m % 60}m ${s % 60}s`;
}

// ═══════════════════════════════════════════════════════════════
//  📦  EXPORTS
// ═══════════════════════════════════════════════════════════════
module.exports = {
    // Formatters
    gmdBanner, gmdTable, gmdList, gmdProgress,
    fmtDuration, fmtBytes, FONTS, stripEmoji,
    // Media
    gmdBuffer, gmdSave, gmdSticker,
    // Converters
    toAudio, toVideo, toPtt, getVideoDuration, runFfmpeg,
    // Uploads
    uploadToCatbox, uploadToImgBB, uploadToTmpFiles,
    // Utils
    sleep, isUrl, isNumber, pickRandom, shuffleArray,
    cleanNumber, formatPhoneNumber, truncate, runtime,
};
