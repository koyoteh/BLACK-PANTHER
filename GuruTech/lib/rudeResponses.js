import { AsyncLocalStorage } from 'node:async_hooks';
import { getKenyanModerationTagForResponse } from './moderationTags.js';
import { addWebsiteRibbon, websitePreviewContext } from './avatarThumbnail.js';
import { OFFICIAL_WEBSITE } from './pantherStyle.js';

const activeCommand = new AsyncLocalStorage();

const ACTION_TAGS = [
  [/^(remove|kick|yeet|boot|xkill|removemember)$/, [
    '😈 Removed. The mess is gone—keep it that way.', '🕶️ Gone. I run a clean operation.',
    '💼 Access revoked. Order restored.', '🥶 Out. Don’t test the house rules.'
  ]],
  [/^(anticall|callprivacy|callpriv|nocall|callblock)$/, [
    '📵 Call declined. Use your words.', '😎 Not taking calls—text like a professional.',
    '🧊 Line blocked. Business is business.', '☎️ Rejected. I don’t do interruptions.'
  ]],
  [/^(ban|block)$/, [
    '🚫 Locked out. Case closed.', '🔐 Access revoked—move along.',
    '🥶 Door’s shut. Find another entrance.', '👑 You’re off the list. That’s final.'
  ]],
  [/^(unban|unblock)$/, [
    '🤝 Access restored. Don’t make me regret it.', '😏 You’re back in. Act like you belong.',
    '🕴️ Second chance granted. Don’t waste it.', '💎 Door reopened—keep it classy.',
    '🎉 You’re back in. Let’s keep it clean this time.'
  ]],
  [/^(promote|makeadmin|addadmin|promoteuser)$/, [
    '👑 Promoted. Try not to let the title go to your head.', '💼 New rank. Keep your standards high.',
    '🥂 Level up. Don’t embarrass the crew.', '😎 You’ve got the keys now—use them wisely.'
  ]],
  [/^(demote|unadmin|removeadmin|deadmin|demoteuser)$/, [
    '🧊 Rank lowered. Maybe bring better leadership next time.', '😏 Demoted. No speech needed.',
    '🚪 Access trimmed. The room got quieter already.', '👔 Title removed. The standard stays high.'
  ]],
  [/^(warn|warns|warnlist|resetwarn|warncount|warncheck)$/, [
    '⚠️ Warning delivered. Don’t make this a series.', '😤 Rules are rules. You’ve been told.',
    '📋 Logged. Keep your next move clean.', '🫡 Consider that your final courtesy.'
  ]],
  [/^(antidelete|antiviewonce|antilink|antilinkgc|antispam|antibadword)$/, [
    '🛡️ Protection is up. Try a smarter angle.', '🔒 Safeguards set. The usual tricks are old.',
    '😎 Security handled. Carry on.', '🚧 Rules are locked in—don’t test them.'
  ]],
  [/^(vvx|retrieve|openviewonce|viewonceopen)$/, [
    '👁️ View-once opened. Secrets aren’t safe here.', '🕵️ Got the view-once. Nice try hiding it.',
    '😏 That “one view” plan didn’t last long.', '📸 Retrieved. Keep your surprises organized.'
  ]],
  [/^(mode|setmode|botmode|prefix|multiprefix|settings)$/, [
    '⚙️ Settings updated. Keep your hands steady.', '💼 Configured. That’s how the boss runs it.',
    '😎 All set. Don’t go changing it back in five minutes.', '🧰 Updated. You’re welcome.',
    '✨ Settings sorted. Nice and clean.'
  ]],
  [/^(menu|fullmenu|allmenu|generalmenu|settingsmenu|ownermenu|herokumenu|privacymenu|groupmenu|aimenu|downloadmenu|editingmenu|utilsmenu|animemenu|nsfwmenu|reactionsmenu|logomenu)$/, [
    '📋 It’s all there. Try not to get lost.', '🧭 Pick a lane and choose a number.',
    '😏 Menu served. Don’t make me choose for you.', '🗂️ Options laid out. Move with purpose.'
  ]],
  [/^(upload|catbox|cdnwa|gitclone|mediafire|npmdl|shorten|tinyurl)$/, [
    '📦 Delivered. Keep track of your files.', '💸 Sent—business handled.',
    '🕶️ Link secured. Don’t lose the goods.', '🚀 Out the door. Next.',
    '🎉 Delivered clean. The operation is looking good.'
  ]],
  [/^(del|delete|deletechat|clear|cleartmp)$/, [
    '🧹 Gone. Clean slate, clean business.', '🗑️ Deleted. You called the shot.',
    '😌 Cleared. Less clutter, more class.', '🕶️ Wiped. No looking back.'
  ]],
  [/^(add|invite|addsudo|addcmd|addbadword|addbutton)$/, [
    '➕ Added. Keep the operation tidy.', '🤝 In. Don’t make me regret the invite.',
    '💼 Added to the books. Handle it properly.', '😎 Done. You know the rules.',
    '🥂 Added. Nice move—make it count.'
  ]]
];

const FAILURE_TAGS = [
  '😮‍💨 That didn’t land. Fix the details and try again.',
  '🫠 Error. Even the boss needs a clean input.',
  '🚧 Couldn’t finish that. Check the command and retry.',
  '😑 No result. Come back with a better plan.',
  '🥀 Something failed. I’ll pretend that was intentional.'
];
const FULLMENU_TAGS = [
  '🗺️ Everything is listed. Try not to get lost.',
  '📚 Full menu served. Pick your next move.',
  '😏 All commands, no excuses. Choose wisely.',
  '💼 Complete list delivered. Handle it like a pro.'
];
const DEFAULT_TAGS = [
  '😏 Done. Keep up.', '👑 Handled. You’re welcome.',
  '💼 Done. That’s how it’s done.', '🥂 Sorted. Try not to look impressed.',
  '🕶️ Finished. Next.', '🎉 Clean win. Keep the momentum.'
];
const LEGACY_TAGS = [
  '👿 Booted. Try behaving next time.', '👿 Calls rejected. Text like a normal person.',
  '👿 Locked out. Take the hint.', '👿 Restored. Don’t waste the second chance.',
  '👿 Promoted. Try not to let it go to your head.', '👿 Demoted. Maybe act like an admin next time.',
  '👿 Warning delivered. Don’t make me repeat myself.', '👿 Protection updated. Try a different trick.',
  '👿 View-once exposed. Privacy was a suggestion.', '👿 Setting changed. Try not to break it.',
  '👿 Pick a number. Don’t make me guess.', '👿 Sent. Try not to lose it, genius.',
  '👿 Gone. You asked for it.', '👿 Added. Don’t make a mess of it.',
  '👿 Everything is listed. Try not to get lost.', '👿 Done. Try to keep up.'
];
const ALL_TAGS = new Set([
  ...FAILURE_TAGS, ...FULLMENU_TAGS, ...DEFAULT_TAGS, ...LEGACY_TAGS,
  ...ACTION_TAGS.flatMap(([, tags]) => tags),
  'Manyoya wewe 😎', "usikue nyan'ganya mkuu🫴😅"
]);
const FAILURE_RESPONSE = /\b(?:fail(?:ed|ure)?|error|could not|cannot|can't|unable|not found|denied|invalid|try again|unchanged|something broke)\b/i;
const KENYAN_WARNING_TAG = "usikue nyan'ganya mkuu🫴😅";
const MODERATION_COUNTDOWN_LINE = /\b(?:\d+|one)\s+more\b.*\b(?:gone|out|door|kicked|removed|booted|bye)\b/iu;

const TABLE_ACTION_LABELS = new Map([
  ['remove', ['🗑️', 'Kick']], ['kick', ['🗑️', 'Kick']], ['yeet', ['🗑️', 'Kick']],
  ['boot', ['🗑️', 'Kick']], ['removemember', ['🗑️', 'Kick']],
  ['anticall', ['📵', 'Anti-Call']], ['antiviewonce', ['👁️', 'Anti-View Once']],
  ['retrieve', ['👁️', 'Open View Once']], ['vvx', ['👁️', 'Open View Once']],
  ['menu', ['📋', 'Menu']], ['fullmenu', ['📋', 'Full Menu']]
]);

function toBoldSans(text) {
  return String(text).replace(/[A-Z]/g, (char) => String.fromCodePoint(char.charCodeAt(0) + 0x1D5D4 - 65))
    .replace(/[a-z]/g, (char) => String.fromCodePoint(char.charCodeAt(0) + 0x1D5EE - 97));
}

function isUltraGuruFooter(line) {
  const candidate = String(line || '').trim().replace(/^⛓(?:\s*▣)?\s*/u, '').replace(/^>\s*/u, '').replace(/[*_~`©]/gu, '').trim();
  if (/[\p{S}\p{P}]/u.test(candidate)) return false;
  const normalized = candidate.normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
  return /^(?:(?:powered\s+by)\s+)?black\s+panther(?:\s+(?:bot|auto\s+report|poll\s+vote))?$/u.test(normalized);
}

function stripUltraGuruFooterLines(text) {
  return String(text ?? '').split(/\r?\n/u).filter((line) => !isUltraGuruFooter(line)).join('\n');
}

function formatLegacyAntideleteCard(text) {
  const raw = String(text ?? '');
  if (!/╭─❏\s*「\s*DELETED MSG\s*」/iu.test(raw)) return raw;
  const rows = [];
  for (const original of raw.split(/\r?\n/u)) {
    const line = original.trim();
    if (!line || /^╭─❏\s*「\s*DELETED MSG\s*」/iu.test(line) || /^(?:╰|╯)[─━═]+/u.test(line)) continue;
    if (isUltraGuruFooter(line)) continue;
    const metadata = line.match(/^│\s*(Time|Chat|Type|Deleted by|Sender):\s*(.*)$/iu);
    if (metadata) {
      const label = metadata[1].replace(/\b\w/gu, (character) => character.toUpperCase());
      rows.push(`*${label}:* ${metadata[2]}`);
      continue;
    }
    const content = line.replace(/^│\s*/u, '').replace(/^>\s*/u, '').trim();
    if (content) rows.push(`⛓ ${content}`);
  }
  return [
    '> ╭┈┈┈⟡ *BLACK PANTHER* ⟡┈┈┈╮',
    '> ┊ 𝘼𝙉𝙏𝙄-𝘿𝙀𝙇𝙀𝙏𝙀  ·  _DELETED MESSAGE_',
    '> ┊',
    ...rows.map((row) => `> ┊ ${row.replace(/^⛓\s*/u, '◆ ')}`),
    '> ╰┈┈┈⟡ *GURUTECH SYSTEMS* ⟡┈┈┈╯'
  ].join('\n');
}

function hasCurrentTableFrame(text) {
  const pantherSlate = /(?:^|\n)\s*>\s*╭┈┈┈⟡\s*\*BLACK PANTHER\*/u.test(text);
  return pantherSlate;
}

function hasLegacyTableFrame(text) {
  return /(?:╭•─⛓|╭─⛓|╭─❏|╭─⌈|╭─⧼|⛓\s*▣|╰•─⛓|╰─⛓|╰────────)/u.test(String(text ?? ''));
}

function getResponseLines(text) {
  const output = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      output.push('');
      continue;
    }
    if (/^(?:>\s*)?(?:╭─|╭┈|┌─|╔═|┏━)/u.test(trimmed)) {
      const title = trimmed.match(/[「『]([^」』]+)[」』]/u)?.[1]?.trim();
      if (title) output.push(`*│✾├─⋄* *${title}*`);
      continue;
    }
    if (/^(?:>\s*)?(?:╰|╯)[─━═┈⟡]+/u.test(trimmed) || /^◈[━─]+$/u.test(trimmed)) continue;
    if (isUltraGuruFooter(trimmed)) continue;

    const content = trimmed
      .replace(/^>\s*/u, '')
      .replace(/^┊\s*/u, '')
      .replace(/^\*?│(?:❒|✾(?:├|└|│))[^*]*\*?\s*/u, '')
      .replace(/^│\s*/u, '')
      .trim();
    if (content) output.push(content);
  }
  return output;
}

function fadeLine(text) {
  const line = text.trim();
  return /[*_~`]/u.test(line) ? line : `_${line}_`;
}

function emphasizeModerationLines(text) {
  const escapedTag = KENYAN_WARNING_TAG.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const tagPattern = new RegExp(`[*_~\x60]*${escapedTag}[*_~\x60]*`, 'gu');
  return String(text ?? '').split(/\r?\n/u).map((original) => {
    let line = original.replace(tagPattern, `*${KENYAN_WARNING_TAG}*`);
    const plain = line.replace(/[*_~`]/gu, '');
    if (!MODERATION_COUNTDOWN_LINE.test(plain)) return line;

    const prefix = line.match(/^(\s*(?:⛓(?:\s*▣)?|│)\s*)/u)?.[0] || '';
    const body = line.slice(prefix.length)
      .replace(/^⚠️\s*/u, '')
      .trim()
      .replace(/^([*_~`]+)([\s\S]*?)([*_~`]+)$/u, '$2')
      .trim();
    return `${prefix}⚠️ *${body}*`;
  }).join('\n');
}

export function formatResponseTable(text, commandName = activeCommand.getStore(), selectedTag) {
  const raw = String(text ?? '');
  const command = String(commandName || '').trim().toLowerCase().replace(/^[/!.#]+/, '');
  if (!command || !raw.trim() || hasCurrentTableFrame(raw)) return raw;

  const [emoji, label] = TABLE_ACTION_LABELS.get(command) || ['✨', command.replace(/[-_]/g, ' ')];
  const lines = getResponseLines(raw);
  const compact = raw.trim().length <= 480 && lines.filter((line) => line.trim()).length <= 5;
  const contentRows = lines.map((line) => {
    if (!line.trim()) return '> ┊';
    const usage = /^\s*(?:📌\s*)?usage\s*:/i.test(line);
    const content = compact
      ? (usage ? fadeLine(line) : line.trim())
      : fadeLine(line);
    return `> ┊ ${compact ? '◆ ' : '├─ '}${content}`;
  });
  const rudeTag = selectedTag === false ? '' : (selectedTag ?? getRudeResponseTag(command, raw));

  return [
    '> ╭┈┈┈⟡ *BLACK PANTHER* ⟡┈┈┈╮',
    `> ┊ 𝙍𝙀𝙎𝙋𝙊𝙉𝙎𝙀  ·  _${toBoldSans(label)}_`,
    '> ┊',
    `> ┊ ${emoji} *${toBoldSans(label)}*`,
    ...contentRows,
    ...(rudeTag ? [`> ┊ ↳ ${fadeLine(rudeTag)}`] : []),
    '> ╰┈┈┈⟡ *GURUTECH SYSTEMS* ⟡┈┈┈╯'
  ].join('\n');
}

export function getRudeResponseTag(commandName = '', responseText = '', random = Math.random) {
  const command = String(commandName || '').trim().toLowerCase().replace(/^[/!.#]+/, '');
  const pool = FAILURE_RESPONSE.test(String(responseText))
    ? FAILURE_TAGS
    : (/^(fullmenu|allmenu|commandslist|allcommands|fullcmds|fcmds|fm)$/.test(command)
      ? FULLMENU_TAGS
      : ACTION_TAGS.find(([pattern]) => pattern.test(command))?.[1] || DEFAULT_TAGS);
  const sample = Number(random());
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, Number.isFinite(sample) ? sample : 0) * pool.length));
  return pool[index];
}

export function withRudeResponseTag(commandName, operation) {
  return activeCommand.run(String(commandName || ''), operation);
}

export function installOutgoingResponseDecorator(client) {
  if (!client || client._rudeResponseDecoratorInstalled) return client;
  const sendMessage = client.sendMessage?.bind(client);
  if (sendMessage) {
    client.sendMessage = async (jid, content, options) => sendMessage(jid, await decorateMediaContent(decorateOutgoingContent(content)), options);
  }
  const relayMessage = client.relayMessage?.bind(client);
  if (relayMessage) {
    client.relayMessage = async (jid, content, options) => relayMessage(jid, await decorateMediaContent(decorateOutgoingContent(content)), options);
  }
  client._rudeResponseDecoratorInstalled = true;
  return client;
}

async function decorateMediaContent(content) {
  if (!content || typeof content !== 'object' || Buffer.isBuffer(content)) return content;
  const next = { ...content };
  let brandedImage = null;
  if (Buffer.isBuffer(next.image)) {
    brandedImage = await addWebsiteRibbon(next.image);
    next.image = brandedImage;
  }
  if (Buffer.isBuffer(next.thumbnail)) {
    next.thumbnail = await addWebsiteRibbon(next.thumbnail);
    brandedImage = next.thumbnail;
  }
  const existingContext = next.contextInfo && typeof next.contextInfo === 'object' ? next.contextInfo : {};
  const existingPreview = existingContext.externalAdReply && typeof existingContext.externalAdReply === 'object'
    ? existingContext.externalAdReply
    : null;
  if (brandedImage || existingPreview) {
    const preview = {
      ...websitePreviewContext(brandedImage, 'Official BLACK-PANTHER website'),
      ...(existingPreview || {}),
      sourceUrl: existingPreview?.sourceUrl || OFFICIAL_WEBSITE,
      ...(brandedImage ? { thumbnail: brandedImage } : {})
    };
    next.contextInfo = { ...existingContext, externalAdReply: preview };
  }
  return next;
}

function appendTag(text, tag) {
  const trimmed = text.trimEnd();
  if ([...ALL_TAGS].some((knownTag) => trimmed.includes(knownTag))) return text;
  const frameFooter = /\n(?=>?\s*╰┈┈┈⟡)/u.exec(trimmed);
  if (frameFooter) {
    const insertAt = frameFooter.index + 1;
    return `${trimmed.slice(0, insertAt)}> ┊ ↳ ${fadeLine(tag)}\n${trimmed.slice(insertAt)}`;
  }
  return `${trimmed}${trimmed ? '\n\n' : ''}${tag}`;
}

export function decorateOutgoingContent(content, commandName = activeCommand.getStore()) {
  if (!content || (typeof content !== 'object' && typeof content !== 'string') || Buffer.isBuffer(content)) return content;
  const moderationTag = getKenyanModerationTagForResponse(content, commandName);
  const effectiveCommand = commandName || (moderationTag?.action === 'kick' ? 'kick' : moderationTag ? 'warn' : '');
  const decorateText = (text) => {
    const cleaned = emphasizeModerationLines(stripUltraGuruFooterLines(formatLegacyAntideleteCard(text)));
    if (!effectiveCommand) {
      return hasLegacyTableFrame(cleaned)
        ? formatResponseTable(cleaned, 'note', false)
        : cleaned;
    }
    const tag = moderationTag?.tag || getRudeResponseTag(effectiveCommand, cleaned);
    return emphasizeModerationLines(appendTag(formatResponseTable(cleaned, effectiveCommand, tag), tag));
  };
  if (typeof content === 'string') return decorateText(content);
  if (!content || typeof content !== 'object' || Buffer.isBuffer(content)) return content;

  const next = { ...content };
  let changed = false;
  if (typeof next.footer === 'string' && /black\s+panther/iu.test(next.footer.normalize('NFKD'))) {
    delete next.footer;
    changed = true;
  }
  if (next.footer && typeof next.footer === 'object' && typeof next.footer.text === 'string' && /black\s+panther/iu.test(next.footer.text.normalize('NFKD'))) {
    delete next.footer;
    changed = true;
  }
  for (const key of ['text', 'caption']) {
    if (typeof next[key] === 'string') {
      next[key] = decorateText(next[key]);
      changed = true;
    }
  }

  if (next.buttonsMessage && typeof next.buttonsMessage.contentText === 'string') {
    next.buttonsMessage = { ...next.buttonsMessage, contentText: decorateText(next.buttonsMessage.contentText) };
    changed = true;
  }
  if (next.interactiveMessage?.body && typeof next.interactiveMessage.body.text === 'string') {
    next.interactiveMessage = {
      ...next.interactiveMessage,
      body: { ...next.interactiveMessage.body, text: decorateText(next.interactiveMessage.body.text) }
    };
    changed = true;
  }
  if (next.templateMessage?.hydratedTemplate && typeof next.templateMessage.hydratedTemplate.hydratedContentText === 'string') {
    next.templateMessage = {
      ...next.templateMessage,
      hydratedTemplate: {
        ...next.templateMessage.hydratedTemplate,
        hydratedContentText: decorateText(next.templateMessage.hydratedTemplate.hydratedContentText),
        ...(typeof next.templateMessage.hydratedTemplate.hydratedFooterText === 'string' && /black\s+panther/iu.test(next.templateMessage.hydratedTemplate.hydratedFooterText.normalize('NFKD'))
          ? { hydratedFooterText: '' }
          : {})
      }
    };
    changed = true;
  }
  if (next.listMessage && typeof next.listMessage.description === 'string') {
    next.listMessage = { ...next.listMessage, description: decorateText(next.listMessage.description) };
    changed = true;
  }

  for (const key of ['buttonsMessage', 'interactiveMessage', 'templateMessage', 'listMessage']) {
    const footer = next[key]?.footer;
    const footerText = typeof footer === 'string' ? footer : footer?.text;
    if (typeof footerText === 'string' && /black\s+panther/iu.test(footerText.normalize('NFKD'))) {
      next[key] = { ...next[key] };
      if (typeof footer === 'string') delete next[key].footer;
      else next[key].footer = { ...footer, text: '' };
      changed = true;
    }
  }

  return changed ? next : content;
}
