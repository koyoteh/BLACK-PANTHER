const FOOTER = '𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ';

export function buildMsg(title, lines = [], footer = FOOTER) {
    const body = lines.map(l => `▢ ${l}`).join('\n');
    return `⚡ ──「 ${title} 」──\n${body}\n└──${footer}──`;
}

export function buildLine(msg, footer = FOOTER) {
    return `▢ ${msg}\n└──${footer}──`;
}

export function buildError(title, err, footer = FOOTER) {
    const msg = err instanceof Error ? err.message : String(err);
    return `⚡ ──「 ${title} ERROR 」──\n▢ ${msg}\n└──${footer}──`;
}

export function buildList(title, items = [], footer = FOOTER) {
    const body = items.map((item, i) => `▢ ${i + 1}. ${item}`).join('\n');
    return `⚡ ──「 ${title} 」──\n${body}\n└──${footer}──`;
}

export function buildField(title, fields = {}, footer = FOOTER) {
    const body = Object.entries(fields).map(([k, v]) => `▢ ${k}: ${v}`).join('\n');
    return `⚡ ──「 ${title} 」──\n${body}\n└──${footer}──`;
}

export function buildUsage(cmd, usage, example, footer = FOOTER) {
    return `⚡ ──「 ${cmd.toUpperCase()} 」──\n▢ Usage: ${usage}\n▢ Example: ${example}\n└──${footer}──`;
}

export function buildSection(title, items = [], footer = FOOTER) {
    const body = items.map(item => `▢ ${item}`).join('\n');
    return `┌───⊷ *${title}*\n${body}\n└──${footer}──`;
}
