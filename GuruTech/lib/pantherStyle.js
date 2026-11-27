export const OFFICIAL_WEBSITE = 'https://official.gurutechlab.co.ke';
export const PANTHER_VERSION = 'v3.0.0';

function clean(value, fallback = '') {
  return String(value ?? fallback).replace(/[\r\n]+/g, ' ').trim();
}

export function pantherHeader(label = 'SYSTEM PANEL', version = PANTHER_VERSION) {
  const title = clean(label, 'SYSTEM PANEL').toUpperCase();
  return [
    `> ╭┈┈┈⟡ *BLACK PANTHER* ⟡┈┈┈╮`,
    `> ┊`,
    `> ┊`,
    `> ├─ ◈ *${title}*`
  ];
}

export function pantherFooter() {
  return '> ╰┈┈┈⟡ *GURUTECH SYSTEMS* ⟡┈┈┈╯';
}

export function pantherConnectedTable({ mode = 'PUBLIC', prefix = '.', commands = 0, time = '—' } = {}) {
  return [
    '╭━━━━❲〘  *BLACK PANTHER* 〙❳━━━━╮',
    '> ╭────━❮ 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃 ❯━────',
    '> ├⊷ Status   ⟶  *Online ✓*',
    `> ├⊷ Mode     ⟶  *${clean(mode, 'PUBLIC').toUpperCase()}*`,
    `> ├⊷ Prefix   ⟶  *${clean(prefix, '.')}*`,
    `> ├⊷ Commands ⟶  *${clean(commands, '0')}*`,
    `> ├⊷ Time     ⟶  *${clean(time, '—')}*`,
    '> ╰━',
    '╰──────━❮    ❖    ❯━──────╯'
  ].join('\n');
}

export function pantherBox(label, lines = [], { version = PANTHER_VERSION, includeSection = true } = {}) {
  const output = pantherHeader(label, version);
  if (!includeSection) output.splice(3, 1);
  output.push('> ┊');
  for (const line of Array.isArray(lines) ? lines : [lines]) {
    const value = clean(line);
    if (!value) output.push('> ┊');
    else output.push(`> ┊ ${value}`);
  }
  output.push(pantherFooter());
  return output.join('\n');
}

export function pantherField(label, value, marker = '◆') {
  return `${marker} ${clean(label)}  ⟶  *${clean(value, '—')}*`;
}

export function pantherCategoryRows(categories = []) {
  return categories.map((category, index) => {
    const label = clean(category?.label || category).toUpperCase();
    return `> ┊ ${String(index + 1).padStart(2, '0')}  ›  ${label}`;
  });
}

export function pantherThumbnailRibbonSvg(width, height) {
  const safeHeight = Math.max(160, Number(height) || 320);
  const fontSize = Math.max(8, Math.min(12, Math.floor(safeHeight / 34)));
  const text = 'official.gurutechlab.co.ke';
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${safeHeight}">
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#26343d"/>
      <stop offset="0.5" stop-color="#101820"/>
      <stop offset="1" stop-color="#394953"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-5%" width="160%" height="110%">
      <feDropShadow dx="-2" dy="0" stdDeviation="2" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect x="2" y="2" width="${Math.max(1, width - 4)}" height="${Math.max(1, safeHeight - 4)}" rx="9" fill="url(#metal)" stroke="#d6b86a" stroke-width="2" filter="url(#shadow)"/>
  <path d="M 8 12 L ${width - 8} 12" stroke="#f5e7b4" stroke-opacity="0.5" stroke-width="1"/>
  <path d="M 8 ${safeHeight - 12} L ${width - 8} ${safeHeight - 12}" stroke="#05090c" stroke-opacity="0.8" stroke-width="1"/>
  <text x="${Math.floor(width / 2)}" y="${Math.floor(safeHeight / 2)}" fill="#f1e2b3" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="0.6" text-anchor="middle" transform="rotate(90 ${Math.floor(width / 2)} ${Math.floor(safeHeight / 2)})">${text}</text>
</svg>`);
}
