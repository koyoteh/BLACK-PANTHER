import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decorateOutgoingContent } from './rudeResponses.js';
import { getUserOrBotThumbnail, websitePreviewContext } from './avatarThumbnail.js';
import { OFFICIAL_WEBSITE, PANTHER_VERSION, pantherCategoryRows, pantherFooter, pantherHeader } from './pantherStyle.js';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const BOT_ROOT = path.resolve(LIB_DIR, '..');
const PLUGINS_DIR = path.join(BOT_ROOT, 'plugins');
const MENU_PROMPTS = new Map();
const ACTIVE_MENU_BY_CHAT = new Map();
const MENU_PROMPT_TTL_MS = 30 * 60 * 1000;
const MAX_MENU_PROMPTS = 300;
const MENU_PROMPT_MARKER = /CATEGORIES[\s\S]{0,90}reply\s*0?1\s*[–-]\s*15/i;
export const MENU_CATEGORY_BUTTON_ID = 'ultraguru:categories';
export const MENU_READ_MORE_BUTTON_ID = 'ultraguru:readmore';
const MENU_CATEGORY_ROW_PREFIX = 'ultraguru:category:';

export function isMenuNavigationReply(value) {
  const reply = String(value ?? '').trim();
    return /^\d{1,2}$/.test(reply)
    || reply === MENU_CATEGORY_BUTTON_ID
    || reply === MENU_READ_MORE_BUTTON_ID
    || /^ultraguru:category:[a-z0-9-]+$/i.test(reply);
}

export const MENU_LINKS = Object.freeze({
  repository: 'https://github.com/cleanplata/BLACK-PANTHER',
  website: 'https://cheap.bothosting.gurutech.top',
  channel: 'https://whatsapp.com/channel/0029VbDh88NCMY0Fartkxm1g'
});
export const MENU_LINK_BUTTONS = Object.freeze([
  ['GitHub Repository', MENU_LINKS.repository],
  ['Official Website', MENU_LINKS.website],
  ['WhatsApp Channel', MENU_LINKS.channel]
].map(([label, url]) => Object.freeze({
  name: 'cta_url',
  buttonParamsJson: JSON.stringify({ display_text: label, url, merchant_url: url })
})));
export const MENU_REPOSITORY_BUTTON = MENU_LINK_BUTTONS[0];
export const MENU_WEBSITE_BUTTON = Object.freeze({
  name: 'cta_url',
  buttonParamsJson: JSON.stringify({
    display_text: 'Visit Website',
    url: OFFICIAL_WEBSITE,
    merchant_url: OFFICIAL_WEBSITE
  })
});

function formatRepositoryDate(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(date);
}

export function buildRepositoryInfoText(repoInfo = {}) {
  const stars = Number.isFinite(Number(repoInfo.stars)) ? Number(repoInfo.stars) : 0;
  const forks = Number.isFinite(Number(repoInfo.forks)) ? Number(repoInfo.forks) : 0;
  const owner = String(repoInfo.owner || 'GuruhTech').replace(/[\r\n]/g, ' ').trim() || 'GuruhTech';
  return [
    `> ╭┈┈┈⟡ *BLACK PANTHER* ⟡┈┈┈╮`,
    `> ┊ 𝙍𝙀𝙋𝙊𝙎𝙄𝙏𝙊𝙍𝙔  ·  _${PANTHER_VERSION}_`,
    `> ┊`,
    `> ├─ ◈ *PROJECT DETAILS*`,
    `> ┊ ◆ Stars    ⟶  *${stars}*`,
    `> ┊ ◆ Forks    ⟶  *${forks}*`,
    `> ┊ ◆ Created  ⟶  *${formatRepositoryDate(repoInfo.createdAt)}*`,
    `> ┊ ◆ Updated  ⟶  *${formatRepositoryDate(repoInfo.lastUpdate)}*`,
    `> ┊ ◆ Owner    ⟶  *${owner}*`,
    pantherFooter()
  ].join('\n');
}

function stripRawUrlLines(value) {
  return String(value || '').split(/\r?\n/)
    .filter((line) => !/(?:https?:\/\/|www\.)/i.test(line))
    .join('\n').trim();
}

const MENU_PLUGIN_NAMES = [
  'menu', 'fullmenu', 'generalmenu', 'settingsmenu', 'ownermenu', 'herokumenu',
  'privacymenu', 'groupmenu', 'aimenu', 'downloadmenu', 'editingmenu',
  'effectsmenu', 'utilsmenu', 'animemenu', 'nsfwmenu', 'reactionsmenu', 'logomenu'
];

const GENERAL_FUN = ['dice', 'games', 'gaycheck', 'joke', 'roast', 'tictactoe'];
const GENERAL_USER = ['profile', 'profilegc'];
const GENERAL_UTILITY = ['tempmail', 'tempinbox'];

export const MENU_CATEGORIES = [
  { id: 'general', label: 'GENERAL', emoji: '📋', sources: [{ folder: 'General', exclude: [...MENU_PLUGIN_NAMES, 'coinflip', ...GENERAL_FUN, 'random-anime', ...GENERAL_USER, ...GENERAL_UTILITY] }] },
  { id: 'ai', label: 'AI', emoji: '🧠', sources: [{ folder: 'AI' }] },
  { id: 'downloader', label: 'DOWNLOADER', emoji: '⬇️', sources: [{ folder: 'Downloads', exclude: ['upload', 'image'] }] },
  { id: 'search', label: 'SEARCH', emoji: '🔎', sources: [{ folder: 'Search' }] },
  { id: 'group', label: 'GROUP', emoji: '👥', sources: [{ folder: 'Groups' }] },
  { id: 'owner', label: 'OWNER', emoji: '👑', sources: [{ folder: 'Owner' }, { folder: 'Heroku' }] },
  { id: 'settings', label: 'SETTINGS', emoji: '⚙️', sources: [{ folder: 'Settings' }] },
  { id: 'fun', label: 'FUN', emoji: '🎭', sources: [
    { folder: 'General', include: GENERAL_FUN },
    { folder: 'Effects' }, { folder: 'Reactions' }, { folder: 'NSFW' }
  ] },
  { id: 'converter', label: 'CONVERTER', emoji: '🔄', sources: [
    { folder: 'Editing', exclude: ['logogen'] }, { folder: 'Utils', include: ['tomp3'] }
  ] },
  { id: 'economy', label: 'ECONOMY', emoji: '🪙', sources: [{ folder: 'General', include: ['coinflip'] }] },
  { id: 'logo', label: 'LOGO', emoji: '🎨', sources: [{ folder: 'Editing', include: ['logogen'] }] },
  { id: 'ultra-pics', label: 'ULTRA PICS', emoji: '🖼️', sources: [
    { folder: 'Anime' },
    { folder: 'Downloads', include: ['image'] },
    { folder: 'General', include: ['random-anime'] }
  ] },
  { id: 'uploader', label: 'UPLOADER', emoji: '📤', sources: [
    { folder: 'Downloads', include: ['upload'] },
    { folder: 'Utils', include: ['catbox', 'cdnwa'] }
  ] },
  { id: 'utility', label: 'UTILITY', emoji: '🧰', sources: [
    { folder: 'Utils', exclude: ['catbox', 'cdnwa', 'tomp3'] },
    { folder: 'Coding' },
    { folder: 'General', include: GENERAL_UTILITY }
  ] },
  { id: 'user', label: 'USER', emoji: '👤', sources: [
    { folder: 'Privacy' },
    { folder: 'General', include: GENERAL_USER }
  ] }
];

const normalizeCommandName = (value) => String(value || '').trim().toLowerCase();

function getTimeParts(date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', hour: '2-digit', hourCycle: 'h23'
  }).format(date));
  const greeting = hour >= 5 && hour < 12 ? 'Good Morning'
    : hour >= 12 && hour < 18 ? 'Good Afternoon'
      : hour >= 18 && hour < 22 ? 'Good Evening' : 'Good Night';
  const dateText = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short', year: 'numeric'
  }).format(date);
  const timeText = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi', hour: 'numeric', minute: '2-digit'
  }).format(date);
  return { greeting, dateText, timeText };
}

async function getMenuThumbnails(client, m = {}) {
  return getUserOrBotThumbnail(client, m.sender);
}

function menuPreviewContext(thumbnail) {
  return websitePreviewContext(thumbnail, `Official website: ${OFFICIAL_WEBSITE}`);
}

export function buildCategorySelectorButton() {
  return {
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
      title: '📋 Menu',
      sections: [{
        title: 'ALL MENU CATEGORIES',
        rows: MENU_CATEGORIES.map((category, index) => ({
          title: `${String(index + 1).padStart(2, '0')} ${category.label}`,
          description: `Open ${category.label.toLowerCase()} commands`,
          id: `${MENU_CATEGORY_ROW_PREFIX}${category.id}`
        }))
      }]
    })
  };
}

export function buildReadMoreButton() {
  return {
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({
      display_text: 'Read More',
      id: MENU_READ_MORE_BUTTON_ID
    })
  };
}

async function sendMenuTable(context, text, { mainMenu = false } = {}) {
  const { client, m = {}, prefix = '.' } = context;
  const { bot, preferred } = await getMenuThumbnails(client, m);

  if (text.length <= 1024) {
    try {
      const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = await import('@whiskeysockets/baileys');
      const menuButton = mainMenu
        ? buildCategorySelectorButton()
        : {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
              display_text: '🏠 Main menu',
              id: `${prefix || '.'}menu`
            })
          };
      const sendCard = async (thumbnail) => {
        const image = Buffer.isBuffer(thumbnail) ? thumbnail : thumbnail?.buffer;
        const media = image?.length
          ? await prepareWAMessageMedia({ image }, { upload: client.waUploadToServer })
          : {};
        const message = generateWAMessageFromContent(m.chat, proto.Message.fromObject({
          interactiveMessage: {
            body: { text },
            header: { hasMediaAttachment: Boolean(media.imageMessage), ...media },
            contextInfo: menuPreviewContext(thumbnail),
          nativeFlowMessage: { buttons: [menuButton, MENU_WEBSITE_BUTTON] }
          }
        }), { userJid: client.user?.id || '' });
        await client.relayMessage(m.chat, message.message, { messageId: message.key.id });
        return message;
      };
      try {
        return await sendCard(preferred);
      } catch {
        if (bot && bot !== preferred) {
          try {
            return await sendCard(bot);
          } catch {
            // Continue to the text preview with the selected image bytes.
          }
        }
      }
    } catch {
      // Fall back to the standard text message if interactive cards are unavailable.
    }
  }

  return client.sendMessage(m.chat, {
    text,
    ...menuPreviewContext(bot || preferred),
    ...(m.sender ? { mentions: [m.sender] } : {})
  }, m.key && !mainMenu ? { quoted: m } : {});
}

async function sendLinkButtonCard(client, chatId, body, buttons, { previewBody, sourceUrl, fallbackText }) {
  const title = String(body || '');
  let thumbnail;
  try {
    thumbnail = (await getUserOrBotThumbnail(client, client.user?.id)).bot?.buffer;
  } catch {}
  const preview = {
    ...websitePreviewContext(thumbnail, previewBody),
    sourceUrl: sourceUrl || OFFICIAL_WEBSITE,
    ...(sourceUrl ? { description: sourceUrl } : {})
  };

  try {
    const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = await import('@whiskeysockets/baileys');
    const media = thumbnail?.length
      ? await prepareWAMessageMedia({ image: thumbnail }, { upload: client.waUploadToServer })
      : {};
    const message = generateWAMessageFromContent(chatId, proto.Message.fromObject({
      interactiveMessage: {
        body: { text: title },
        header: { hasMediaAttachment: Boolean(media.imageMessage), ...media },
        contextInfo: { externalAdReply: preview },
        nativeFlowMessage: { buttons }
      }
    }), { userJid: client.user?.id || '' });
    await client.relayMessage(chatId, message.message, { messageId: message.key.id });
    return message;
  } catch {
    return client.sendMessage(chatId, {
      text: fallbackText,
      contextInfo: { externalAdReply: preview }
    });
  }
}

export async function sendOfficialLinkButtons(client, chatId, body = '🌐 *OFFICIAL LINKS*') {
  const title = stripRawUrlLines(body || '🌐 *OFFICIAL LINKS*');
  return sendLinkButtonCard(client, chatId, title, MENU_LINK_BUTTONS, {
    previewBody: `Official website: ${OFFICIAL_WEBSITE}`,
    sourceUrl: MENU_LINKS.website,
    fallbackText: title
  });
}

export async function sendRepositoryLinkButton(client, chatId, body) {
  const title = stripRawUrlLines(body || '⚡ *PING*');
  return sendLinkButtonCard(client, chatId, title, [MENU_REPOSITORY_BUTTON, MENU_WEBSITE_BUTTON], {
    previewBody: `Official website: ${OFFICIAL_WEBSITE}`,
    sourceUrl: MENU_LINKS.repository,
    fallbackText: title
  });
}

export async function sendRepositoryInfoCard(client, chatId, body) {
  const title = stripRawUrlLines(body);
  const repositoryButton = {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({
      display_text: 'GitHub Repo',
      url: MENU_LINKS.repository,
      merchant_url: MENU_LINKS.repository
    })
  };
  return sendLinkButtonCard(client, chatId, title, [repositoryButton, MENU_WEBSITE_BUTTON, MENU_LINK_BUTTONS[2]], {
    previewBody: `Official website: ${OFFICIAL_WEBSITE}`,
    sourceUrl: MENU_LINKS.repository,
    fallbackText: title
  });
}

export function renderMainMenu(context = {}, now = new Date()) {
  const { m = {}, prefix = '.', mode = 'PUBLIC' } = context;
  const { greeting, dateText, timeText } = getTimeParts(now);
  const displayName = String(m.pushName || 'there').replace(/[\r\n]/g, ' ').trim() || 'there';
  const cleanPrefix = prefix || 'None';
  return [
    ...pantherHeader('SYSTEM PANEL', PANTHER_VERSION).slice(0, 2),
    `> ┊ 👋 Welcome, *${displayName}*`,
    `> ┊ ☀️ ${greeting}  ·  📅 ${dateText}  ·  🕐 ${timeText}`,
    `> ┊`,
    `> ├─ ◈ *RUNTIME*`,
    `> ┊  ├─ Commands  ⟶  *${context.totalCommands || 341}*`,
    `> ┊  ├─ Prefix    ⟶  *${cleanPrefix}*`,
    `> ┊  └─ Mode      ⟶  *${String(mode || 'PUBLIC').toUpperCase()}*`,
    `> ┊`,
    `> ├─ ◈ *NAVIGATION*`,
    `> ┊  ↳ Reply with a category number`,
    `> ┊`,
    ...pantherCategoryRows(MENU_CATEGORIES),
    `> ┊`,
    `> ┊  ↳ Type *${prefix || '.'}all menu* for the complete directory`,
    pantherFooter()
  ].join('\n');
}

export function renderCategoryMenu(category, commands = [], prefix = '.') {
  const label = category?.label || 'COMMANDS';
  const emoji = category?.emoji || '📋';
  const rows = commands.flatMap((command) => {
    const commandText = `*${prefix || ''}${command.name}*`;
    const usage = command.description || `Try ${prefix || ''}${command.name} with its required arguments.`;
    return [
      `> ┊ ${emoji} ${commandText}`,
      `> ┊  └─ ${usage}`
    ];
  });
  if (rows.length === 0) rows.push('> ┊ ◆ No commands are registered here yet.');
  rows.push(`> ┊ ◆ *${commands.length} COMMAND${commands.length === 1 ? '' : 'S'}*`);

  return [
    ...pantherHeader(`${label} MODULE`, PANTHER_VERSION).slice(0, 2),
    `> ┊ ├─ ◈ *${emoji} ${label}*`,
    `> ┊`,
    ...rows,
    pantherFooter()
  ].join('\n');
}

async function readFolderCommands(folder) {
  const folderPath = path.join(PLUGINS_DIR, folder);
  if (!fs.existsSync(folderPath)) return [];
  const files = fs.readdirSync(folderPath).filter((file) => file.endsWith('.js')).sort((a, b) => a.localeCompare(b));
  const commands = [];

  for (const file of files) {
    if (file.toLowerCase().includes('menu')) continue;
    const filePath = path.join(PLUGINS_DIR, folder, file);
    const fallbackName = path.basename(file, '.js');
    try {
      const imported = await import(pathToFileURL(filePath).href);
      const exported = imported.default;
      const entries = Array.isArray(exported) ? exported : [exported];
      let found = false;
      for (const entry of entries) {
        if (entry && typeof entry === 'object' && typeof entry.run === 'function' && entry.name) {
          commands.push({ name: String(entry.name), description: String(entry.description || '').replace(/\s+/g, ' ').trim() });
          found = true;
        }
      }
      if (!found && (typeof exported === 'function' || (exported && typeof exported === 'object' && typeof exported.run === 'function'))) {
        commands.push({ name: fallbackName, description: String(exported.description || '').replace(/\s+/g, ' ').trim() });
      }
    } catch {
      commands.push({ name: fallbackName, description: '' });
    }
  }
  return commands;
}

export async function getCategoryCommands(categoryOrId) {
  const category = typeof categoryOrId === 'string'
    ? MENU_CATEGORIES.find((item) => item.id === normalizeCommandName(categoryOrId))
    : categoryOrId;
  if (!category) return [];

  const found = [];
  for (const source of category.sources || []) {
    const commands = await readFolderCommands(source.folder);
    const include = source.include ? new Set(source.include.map(normalizeCommandName)) : null;
    const exclude = new Set((source.exclude || []).map(normalizeCommandName));
    for (const command of commands) {
      const name = normalizeCommandName(command.name);
      if (include && !include.has(name)) continue;
      if (exclude.has(name)) continue;
      found.push(command);
    }
  }

  const seen = new Set();
  return found.filter((command) => {
    const key = normalizeCommandName(command.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function rememberMenuPrompt(chatId, messageId) {
  if (!chatId) return;
  const now = Date.now();
  for (const [key, value] of MENU_PROMPTS) {
    if (now - value.createdAt > MENU_PROMPT_TTL_MS) MENU_PROMPTS.delete(key);
  }
  for (const [key, value] of ACTIVE_MENU_BY_CHAT) {
    if (now - value.createdAt > MENU_PROMPT_TTL_MS) ACTIVE_MENU_BY_CHAT.delete(key);
  }
  if (messageId) MENU_PROMPTS.set(`${chatId}:${messageId}`, { createdAt: now });
  ACTIVE_MENU_BY_CHAT.set(chatId, { messageId: messageId || '', createdAt: now });
  while (MENU_PROMPTS.size > MAX_MENU_PROMPTS) MENU_PROMPTS.delete(MENU_PROMPTS.keys().next().value);
  while (ACTIVE_MENU_BY_CHAT.size > MAX_MENU_PROMPTS) ACTIVE_MENU_BY_CHAT.delete(ACTIVE_MENU_BY_CHAT.keys().next().value);
}

function isKnownCategoryMenuReply(m) {
  const messageId = m?.quoted?.id;
  const quotedChatId = m?.quoted?.chat || m?.chat;
  const quotedText = String(m?.quoted?.text || m?.quoted?.caption || m?.quoted?.contentText || m?.quoted?.body?.text || '');
  if (messageId) return MENU_PROMPTS.has(`${quotedChatId}:${messageId}`) || MENU_PROMPT_MARKER.test(quotedText);
  if (m?.quoted) return MENU_PROMPT_MARKER.test(quotedText);

  const activeMenu = ACTIVE_MENU_BY_CHAT.get(m?.chat);
  if (!activeMenu) return false;
  if (Date.now() - activeMenu.createdAt > MENU_PROMPT_TTL_MS) {
    ACTIVE_MENU_BY_CHAT.delete(m.chat);
    return false;
  }
  return true;
}

export function resolveCategorySelection(value) {
  const normalized = String(value ?? '').trim();
  if (!/^\d{1,2}$/.test(normalized)) return null;
  const index = Number(normalized) - 1;
  return MENU_CATEGORIES[index] || null;
}

export async function sendMainMenu(context = {}) {
  const { client, m = {} } = context;
  if (!client || !m.chat) return null;
  const text = decorateOutgoingContent({ text: renderMainMenu(context) }, 'menu').text;
  const message = await sendMenuTable(context, text, { mainMenu: true });
  rememberMenuPrompt(m.chat, message?.key?.id);
  return message;
}

export async function sendCategoryMenu(context = {}, categoryOrId) {
  const { client, m = {}, prefix = '.' } = context;
  if (!client || !m.chat) return null;
  const category = typeof categoryOrId === 'string'
    ? MENU_CATEGORIES.find((item) => item.id === normalizeCommandName(categoryOrId))
    : categoryOrId;
  if (!category) return null;
  const commands = await getCategoryCommands(category);
  const text = decorateOutgoingContent({ text: renderCategoryMenu(category, commands, prefix) }, 'menu').text;
  return sendMenuTable(context, text);
}

function renderCategorySelector(prefix = '.') {
  const categories = pantherCategoryRows(MENU_CATEGORIES);
  return [
    ...pantherHeader('NAVIGATION', PANTHER_VERSION).slice(0, 2),
    `> ┊ ↳ Choose a category from the list below.`,
    `> ┊ ↳ If the list does not open, reply *01–${MENU_CATEGORIES.length}* or type *${prefix || '.'}all menu*.`,
    `> ┊`,
    ...categories,
    pantherFooter()
  ].join('\n');
}

export async function sendCategorySelector(context = {}) {
  const { client, m = {}, prefix = '.' } = context;
  if (!client || !m.chat) return null;

  const sections = [{
    title: 'ALL MENU CATEGORIES',
    rows: MENU_CATEGORIES.map((category, index) => ({
      title: `${String(index + 1).padStart(2, '0')} ${category.label}`,
      rowId: `${MENU_CATEGORY_ROW_PREFIX}${category.id}`,
      description: `Open ${category.label.toLowerCase()} commands`
    }))
  }];
  const options = m.key ? { quoted: m } : {};
  let message;
  try {
    message = await client.sendMessage(m.chat, {
      text: renderCategorySelector(prefix),
      title: 'BLACK PANTHER',
      footer: 'Tap a category to view its commands',
      buttonText: 'Choose Category',
      sections,
      headerType: 1
    }, options);
  } catch {
    message = await client.sendMessage(m.chat, {
      text: renderCategorySelector(prefix),
      ...menuPreviewContext((await getMenuThumbnails(client, m)).preferred),
      ...(m.sender ? { mentions: [m.sender] } : {})
    }, options);
  }
  rememberMenuPrompt(m.chat, message?.key?.id);
  return message;
}

export async function sendAllCategorizedMenu(context = {}) {
  const { client, m = {}, prefix = '.' } = context;
  if (!client || !m.chat) return null;

  const sections = [];
  for (const category of MENU_CATEGORIES) {
    const commands = await getCategoryCommands(category);
    sections.push(`> ┊ ├─ ◈ *${category.emoji} ${category.label}*`);
    if (!commands.length) {
      sections.push('> ┊  └─ No commands are registered here yet.');
      continue;
    }
    for (const command of commands) {
      const description = command.description ? `  ⟶  _${command.description}_` : '';
      sections.push(`> ┊  ├─ *${prefix || ''}${command.name}*${description}`);
    }
  }
  const text = [
    ...pantherHeader('FULL DIRECTORY', PANTHER_VERSION).slice(0, 2),
    `> ┊ ↳ ${MENU_CATEGORIES.length} categories · all commands listed by module`,
    `> ┊`,
    ...sections,
    pantherFooter()
  ].join('\n');
  return client.sendMessage(m.chat, { text, ...(m.sender ? { mentions: [m.sender] } : {}) }, m.key ? { quoted: m } : {});
}

export async function sendFolderMenu(context = {}, folder, label = folder) {
  const folderCategory = { label: String(label || folder).toUpperCase(), emoji: '📋', sources: [{ folder }] };
  const { client, m = {}, prefix = '.' } = context;
  if (!client || !m.chat) return null;
  const commands = await getCategoryCommands(folderCategory);
  const text = decorateOutgoingContent({ text: renderCategoryMenu(folderCategory, commands, prefix) }, 'menu').text;
  return sendMenuTable(context, text);
}

export async function handleCategoryMenuReply({ client, m, body, prefix = '.' } = {}) {
  const selectionText = String(body ?? '').trim();

  if (selectionText === MENU_CATEGORY_BUTTON_ID) {
    await sendCategorySelector({ client, m, prefix });
    return true;
  }

  if (selectionText === MENU_READ_MORE_BUTTON_ID) {
    ACTIVE_MENU_BY_CHAT.delete(m?.chat);
    await sendCategorySelector({ client, m, prefix });
    return true;
  }

  if (selectionText.startsWith(MENU_CATEGORY_ROW_PREFIX)) {
    const categoryId = selectionText.slice(MENU_CATEGORY_ROW_PREFIX.length);
    const category = MENU_CATEGORIES.find((item) => item.id === categoryId);
    if (!category) return false;
    ACTIVE_MENU_BY_CHAT.delete(m?.chat);
    await sendCategoryMenu({ client, m, prefix }, category);
    return true;
  }

  const commandText = prefix && selectionText.startsWith(prefix)
    ? selectionText.slice(prefix.length).trim()
    : '';
  if (/^all\s+menu$/i.test(commandText)) {
    ACTIVE_MENU_BY_CHAT.delete(m?.chat);
    await sendAllCategorizedMenu({ client, m, prefix });
    return true;
  }

  if (!/^\d{1,2}$/.test(selectionText) || !isKnownCategoryMenuReply(m)) return false;

  const category = resolveCategorySelection(selectionText);
  if (!category) {
    const text = [
      ...pantherHeader('NAVIGATION', PANTHER_VERSION).slice(0, 2),
      `> ┊ ↳ Reply with a number from *01–${MENU_CATEGORIES.length}*.`,
      pantherFooter()
    ].join('\n');
    await client.sendMessage(m.chat, decorateOutgoingContent({ text }, 'menu'), m.key ? { quoted: m } : {});
    return true;
  }

  ACTIVE_MENU_BY_CHAT.delete(m?.chat);
  await sendCategoryMenu({ client, m, prefix }, category);
  return true;
}
