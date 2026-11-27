import os from 'os';
import moment from 'moment-timezone';
import CONFIG from '../../Guru Tech/config.js';
import { t, translate, translateAIResponse, getUserLang } from '../france/translator.js';

const startTime = Date.now();

const styles = {
    10: {
        "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
        "a": "ᴀ", "b": "ʙ", "c": "ᴄ", "d": "ᴅ", "e": "ᴇ", "f": "ғ", "g": "ɢ", "h": "ʜ", "i": "ɪ", "j": "ᴊ",
        "k": "ᴋ", "l": "ʟ", "m": "ᴍ", "n": "ɴ", "o": "ᴏ", "p": "ᴘ", "q": "ϙ", "r": "ʀ", "s": "s", "t": "ᴛ",
        "u": "ᴜ", "v": "v", "w": "ᴡ", "x": "x", "y": "ʏ", "z": "ᴢ", "A": "ᴀ", "B": "ʙ", "C": "ᴄ", "D": "ᴅ",
        "E": "ᴇ", "F": "ғ", "G": "ɢ", "H": "ʜ", "I": "ɪ", "J": "ᴊ", "K": "ᴋ", "L": "ʟ", "M": "ᴍ", "N": "ɴ",
        "O": "ᴏ", "P": "ᴘ", "Q": "ϙ", "R": "ʀ", "S": "s", "T": "ᴛ", "U": "ᴜ", "V": "v", "W": "ᴡ", "X": "x",
        "Y": "ʏ", "Z": "ᴢ"
    }
};

const applyStyle = (text, styleNum) => {
    const map = styles[styleNum];
    return text.split('').map(c => map[c] || c).join('');
};

const formatUptime = ms => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const preferredCategoryOrder = [
    'GENERAL', 'AI', 'DOWNLOADER', 'TOOLS', 'SEARCH', 'GROUP', 'OWNER', 'SETTINGS',
    'FUN', 'CONVERTER', 'RELIGION', 'NOTES', 'SPORTS', 'ULTRACORE', 'ADVERTISE',
    'API', 'ECONOMY', 'GAME', 'LOGO', 'ULTRA PICS', 'TEMPMAIL', 'UPLOADER', 'UTILITY'
];
const categoryMenuSessions = new Map();
const CATEGORY_MENU_TTL_MS = 10 * 60 * 1000;
const normalizeCategoryName = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const categoryAliases = {
    DOWNLOAD: 'DOWNLOADER',
    FINANCE: 'ECONOMY',
    WHATSAPP: 'UTILITY',
    ULTRAPICS: 'ULTRA PICS'
};

function getCategoryEntries(commands) {
    const grouped = new Map();
    for (const command of commands) {
        if (!command?.name) continue;
        const sourceName = String(command.category || 'General').trim() || 'General';
        const normalizedName = normalizeCategoryName(sourceName);
        const name = categoryAliases[normalizedName] || sourceName.toUpperCase();
        if (!grouped.has(name)) grouped.set(name, []);
        grouped.get(name).push(command);
    }

    const preferred = new Map(preferredCategoryOrder.map((name, index) => [normalizeCategoryName(name), index]));
    return [...grouped.entries()]
        .map(([name, items]) => ({
            name,
            commands: items.sort((a, b) => a.name.localeCompare(b.name))
        }))
        .sort((a, b) => {
            const ai = preferred.get(normalizeCategoryName(a.name));
            const bi = preferred.get(normalizeCategoryName(b.name));
            if (ai !== undefined || bi !== undefined) {
                if (ai === undefined) return 1;
                if (bi === undefined) return -1;
                if (ai !== bi) return ai - bi;
            }
            return a.name.localeCompare(b.name);
        });
}

export function expandInvocableCommands(commands, commandAliases = new Map()) {
    const invocable = new Map();
    for (const command of commands || []) {
        if (command?.name) invocable.set(String(command.name).toLowerCase(), command);
    }
    const aliases = commandAliases instanceof Map ? new Map(commandAliases) : new Map();
    if (!aliases.size) {
        for (const command of commands || []) {
            for (const alias of command?.aliases || []) {
                if (command?.name) aliases.set(String(alias).toLowerCase(), String(command.name).toLowerCase());
            }
        }
    }
    for (const [alias, targetName] of aliases) {
        const target = invocable.get(String(targetName).toLowerCase());
        if (target && alias) invocable.set(String(alias).toLowerCase(), { ...target, name: String(alias).toLowerCase(), aliases: [] });
    }
    return [...invocable.values()];
}

export async function sendMenuVisual(sock, from, text, msg) {
    const imageUrl = CONFIG.BOT_PIC || CONFIG.MENU_IMAGES?.[0];
    const options = msg ? { quoted: msg } : {};
    if (!imageUrl) return [await sock.sendMessage(from, { text }, options)];

    const lines = String(text || '').split('\n');
    const captionLines = [];
    while (lines.length && (`${captionLines.join('\n')}${captionLines.length ? '\n' : ''}${lines[0]}`).length <= 900) {
        captionLines.push(lines.shift());
    }
    if (!captionLines.length && lines.length) captionLines.push(lines.shift().slice(0, 900));
    const caption = captionLines.join('\n');
    let imageMessage;
    try {
        imageMessage = await sock.sendMessage(from, { image: { url: imageUrl }, caption }, options);
    } catch (error) {
        console.warn('Menu bot image could not be sent; using text fallback:', error.message);
        return [await sock.sendMessage(from, { text }, options)];
    }

    const sent = [imageMessage];
    const remainder = lines.join('\n').trim();
    if (remainder) sent.push(await sock.sendMessage(from, { text: remainder }, options));
    return sent;
}

function resolveCategorySelection(value, categories) {
    const selection = String(value || '').trim();
    if (!selection) return null;
    if (/^\d+$/.test(selection)) {
        const index = Number(selection) - 1;
        return categories[index] ? { category: categories[index], index } : null;
    }
    const normalized = normalizeCategoryName(selection);
    const index = categories.findIndex(item => normalizeCategoryName(item.name) === normalized);
    return index < 0 ? null : { category: categories[index], index };
}

function renderCategoryCommands({ category, index, prefix, botName, ownerName }) {
    const lines = category.commands.map(command => {
        const description = String(command.description || '').replace(/\s+/g, ' ').trim().slice(0, 90);
        return `> │ ▫️ ${prefix}${command.name}${description ? ` — ${description}` : ''}`;
    });
    return [
        `> ╭─⌈ 🔥 *${botName}* · _${category.name.toUpperCase()}_ ⌋`,
        `> │ 📋 *${String(index + 1).padStart(2, '0')} ${category.name.toUpperCase()}* · *${category.commands.length} commands*`,
        '> │',
        ...lines,
        `> ╰⊷ ✨ _Powered by ${ownerName}_`
    ].join('\n');
}

function renderAllCategoryCommands({ categories, prefix, botName, ownerName }) {
    const lines = [
        `> ╭─⌈ 🔥 *${botName}* · _ALL COMMANDS_ ⌋`,
        `> │ 📋 *${categories.reduce((total, category) => total + category.commands.length, 0)} commands* · *${categories.length} categories*`,
        '> │'
    ];

    for (const category of categories) {
        lines.push(`> │ ── *${category.name.toUpperCase()}* · ${category.commands.length} commands ──`);
        for (const command of category.commands) {
            lines.push(`> │ ▫️ ${prefix}${command.name}`);
        }
        lines.push('> │');
    }

    lines.push(`> ╰⊷ ✨ _Powered by ${ownerName}_`);
    return lines.join('\n');
}

function categoryMenuKey(chat) {
    return String(chat || '');
}

function rememberCategoryMenu(chat, categories, prefix, botName, ownerName, messageIds) {
    const now = Date.now();
    for (const [key, value] of categoryMenuSessions) {
        if (value.expiresAt <= now) categoryMenuSessions.delete(key);
    }
    if (categoryMenuSessions.size >= 500) {
        categoryMenuSessions.delete(categoryMenuSessions.keys().next().value);
    }
    categoryMenuSessions.set(categoryMenuKey(chat), {
        categories, prefix, botName, ownerName,
        messageIds: (Array.isArray(messageIds) ? messageIds : [messageIds]).filter(Boolean),
        expiresAt: now + CATEGORY_MENU_TTL_MS
    });
}

export async function handleMenuCategoryReply({ sock, from, sender, msg, body }) {
    const key = categoryMenuKey(from);
    const session = categoryMenuSessions.get(key);
    if (!session) return false;
    if (session.expiresAt <= Date.now()) {
        categoryMenuSessions.delete(key);
        return false;
    }

    const selection = String(body || '').trim();
    if (!/^\d+$/.test(selection)) return false;
    const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (quotedId && session.messageIds.length && !session.messageIds.includes(quotedId)) return false;

    const resolved = resolveCategorySelection(selection, session.categories);
    if (!resolved) {
        await sock.sendMessage(from, {
            text: `Please reply with a category number from 1 to ${session.categories.length}.`
        }, { quoted: msg });
        return true;
    }

    await sock.sendMessage(from, {
        text: renderCategoryCommands({ ...resolved, ...session })
    }, { quoted: msg });
    return true;
}

export const commands = [
    {
        name: 'menu',
        aliases: ['list'],
        description: 'Show all available bot commands.',
        category: 'General',

        execute: async ({ sock, from, msg, commands, commandAliases, text, auteurMessage, nomAuteurMessage }) => {
            try {
                const botName = CONFIG.BOT_NAME || 'BLACK PANTHER';
                const botVersion = CONFIG.BOT_VERSION || '3.0.0';
                const ownerName = CONFIG.OWNER_NAME || 'GuruTech';
                const tz = CONFIG.TZ || 'Africa/Nairobi';
                const prefix = CONFIG.PREFIXES?.[0] || '';
                const prefixLabel = prefix || 'None';
                const list = expandInvocableCommands(Array.from(commands.values()), commandAliases);

                if (!list.length) {
                    return sock.sendMessage(from, { text: '❌ Command list not available.' }, { quoted: msg });
                }

                const categories = getCategoryEntries(list);
                if (!categories.length) {
                    return sock.sendMessage(from, { text: '❌ Category list not available.' }, { quoted: msg });
                }

                const selector = String(text || '').trim();
                if (selector) {
                    if (['all', 'full', '*', 'everything'].includes(selector.toLowerCase())) {
                        return sock.sendMessage(from, {
                            text: renderAllCategoryCommands({ categories, prefix, botName, ownerName })
                        }, { quoted: msg });
                    }
                    const selected = resolveCategorySelection(selector, categories);
                    if (selected) {
                        return sock.sendMessage(from, {
                            text: renderCategoryCommands({ ...selected, prefix, botName, ownerName })
                        }, { quoted: msg });
                    }
                    return sock.sendMessage(from, {
                        text: `Choose a category with \`${prefix || '.'}menu 1\`–\`${prefix || '.'}menu ${categories.length}\`, run \`${prefix || '.'}menu all\` for every command, or run \`${prefix || '.'}menu\` to see the index.`
                    }, { quoted: msg });
                }

                const now = moment().tz(tz);
                const hour = now.hour();
                const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : hour < 21 ? 'Good Evening' : 'Good Night';
                const greetingIcon = hour < 12 ? '🌅' : hour < 17 ? '☀️' : hour < 21 ? '🌆' : '🌙';
                const userName = String(msg.pushName || nomAuteurMessage || auteurMessage || 'Guest').replace(/[\r\n]/g, ' ').trim().slice(0, 48) || 'Guest';
                const uptime = formatUptime(Date.now() - (global.botStartTime || startTime));
                const totalMemory = os.totalmem() || 1;
                const ramPercent = Math.max(0, Math.min(100, Math.round(((totalMemory - os.freemem()) / totalMemory) * 100)));
                const filled = Math.round(ramPercent / 10);
                const ramBar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
                const categoryLines = categories.map((category, index) =>
                    `> │ ${String(index + 1).padStart(2, '0')}  ${category.name.toUpperCase()}`
                ).join('\n');

                const menuText = [
                    `> ╭─⌈ 🔥 *${botName}*  ·  _v${botVersion}_ ⌋`,
                    `> │ 👤 Hey *${userName}*  —  *${greetingIcon} ${greeting}*`,
                    `> │ 📅 *${now.format('DD MMM YYYY')}*  ·  🕐 *${now.format('hh:mm A')}*`,
                    '> │',
                    `> │ 💬 Commands  ›  *${list.length}*`,
                    `> │ ⏱️  Uptime    ›  *${uptime}*`,
                    `> │ 🔑  Prefix    ›  *${prefixLabel}*`,
                    `> │ 🛠️  Mode      ›  *${String(CONFIG.MODE || 'public').toLowerCase() === 'group' ? 'GROUP ONLY' : String(CONFIG.MODE || 'public').toUpperCase()}*`,
                    `> │ 💾  RAM       ›  *${ramBar} ${ramPercent}%*`,
                    '> │',
                    `> │ 📋 *CATEGORIES*  ·  _reply 1–${categories.length}_`,
                    '> │',
                    categoryLines,
                    `> │ Type ${prefix || '.'}menu all for every command by category`,
                    `> ╰⊷ ✨ _Powered by ${ownerName}_`
                ].join('\n');

                const sent = await sendMenuVisual(sock, from, menuText, msg);
                rememberCategoryMenu(from, categories, prefix, botName, ownerName, sent.map(item => item?.key?.id));
                return sent.at(-1);
            } catch (error) {
                console.error('Menu error:', error);
                return sock.sendMessage(from, { text: '❌ Error loading menu.' }, { quoted: msg });
            }
        }
    },

    {
        name: 'help',
        aliases: ['guide'],
        description: 'Show command details with descriptions and aliases.',
        category: 'General',

        execute: async ({ sock, from, text, msg, commands, auteurMessage, nomAuteurMessage }) => {
            try {

                const botName = CONFIG.BOT_NAME || 'BLACK PANTHER';
                const botVersion = CONFIG.BOT_VERSION || '3.0.0';
                const ownerName = CONFIG.OWNER_NAME || 'GuruTech';
                const tz = CONFIG.TZ || 'Africa/Nairobi';
                const prefix = CONFIG.PREFIXES?.[0] || ' ';

                const list = Array.from(commands.values());

                if (!list.length) {
                    const noCommandsMsg = await t(from, 'help', 'noCommands');
                    return sock.sendMessage(from, {
                        text: noCommandsMsg
                    }, { quoted: msg });
                }

                const time = moment().tz(tz);
                const hour = time.hour();

                let greeting = "Good Night";

                if (hour >= 0 && hour <= 11) {
                    greeting = "Good Morning";
                } else if (hour >= 12 && hour <= 16) {
                    greeting = "Good Afternoon";
                } else if (hour >= 16 && hour <= 21) {
                    greeting = "Good Evening";
                }

                const userName = nomAuteurMessage || auteurMessage || ownerName;

                const greetingMsg = await t(from, 'help', 'greeting');
                const ownerLabel = await t(from, 'help', 'owner');
                const prefixLabel = await t(from, 'help', 'prefix');
                const timeLabel = await t(from, 'help', 'time');
                const dateLabel = await t(from, 'help', 'date');
                const tzLabel = await t(from, 'help', 'timezone');
                const noDescMsg = await t(from, 'help', 'noDescription');
                const aliasesLabel = await t(from, 'help', 'aliases');
                const usageMsg = await t(from, 'help', 'usage');
                const poweredMsg = await t(from, 'help', 'powered');

                let helpText = `${greetingMsg} ${userName}\n\n`;

                helpText += `╭━━━❒ ${applyStyle(`${botName}`, 10)} ❒━━━╮\n`;
                helpText += `┃❃╭────────────────\n`;
                helpText += `┃❃│ *${ownerLabel}:* ${ownerName}\n`;
                helpText += `┃❃│ *${prefixLabel}:* ${prefix}\n`;
                helpText += `┃❃│ *${timeLabel}:* ${time.format('HH:mm:ss')}\n`;
                helpText += `┃❃│ *${dateLabel}:* ${time.format('DD/MM/YYYY')}\n`;
                helpText += `┃❃│ *${tzLabel}:* ${tz}\n`;
                helpText += `┃❃╰────────────────\n`;
                helpText += `╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

                helpText += `*${botName} COMMANDS*\n\n`;

                const grouped = {};

                for (const cmd of list) {
                    const category = cmd.category || 'General';

                    if (!grouped[category]) {
                        grouped[category] = [];
                    }

                    grouped[category].push(cmd);
                }

                const sortedCategories = Object.keys(grouped).sort();

                for (const category of sortedCategories) {

                    const commandsInCategory = grouped[category]
                        .filter(c => c.name)
                        .sort((a, b) => a.name.localeCompare(b.name));

                    if (commandsInCategory.length === 0) continue;

                    helpText += `╭──❒ ${applyStyle(category.toUpperCase(), 10)} ❒───⊷\n`;
                    helpText += `│\n`;

                    for (const cmd of commandsInCategory) {

                        helpText += `│ • *${applyStyle(cmd.name, 10)}*\n`;
                        helpText += `│   ↳ ${cmd.description || noDescMsg}\n`;

                        if (cmd.aliases && cmd.aliases.length > 0) {
                            helpText += `│   ↳ ${aliasesLabel}: ${cmd.aliases.map(a => applyStyle(a, 10)).join(', ')}\n`;
                        }

                        helpText += `│\n`;
                    }

                    helpText += `╰══════════════⊷\n\n`;
                }

                helpText += `${usageMsg} ${prefix}<command>\n`;
                helpText += `${poweredMsg} ${botName} ${botVersion}\n`;
                helpText += `*Channel:* ${CONFIG.CHANNEL_URL}`;

                await sock.sendMessage(from, {
                    text: helpText,

                    contextInfo: {
                        mentionedJid: [userName],
                        forwardingScore: 1,
                        isForwarded: true,

                        forwardedNewsletterMessageInfo: {
                            newsletterJid: CONFIG.CHANNEL_JID,
                            newsletterName: botName,
                            serverMessageId: -1
                        }
                    }

                }, { quoted: msg });

            } catch (error) {

                console.error('Help error:', error);
                const errorMsg = await t(from, 'help', 'error');
                await sock.sendMessage(from, {
                    text: errorMsg
                }, { quoted: msg });
            }
        }
    }
];
