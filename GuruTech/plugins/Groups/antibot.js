import { getGroupSettings, updateGroupSetting, getGroupSettingsFresh, getKnownBots, addKnownBot, removeKnownBot } from '../../database/config.js';
import { sendInteractive } from '../../lib/sendInteractive.js';
import { isPrefixedBotCommand } from '../../lib/botSignature.js';
import { aliases, commands, commandsReady } from '../../handlers/commandHandler.js';

const fmt = (msg) => `╭─❏ 「 ANTIBOT」\n│ ${msg}\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`;

const _CHECK = new Set(['check', 'debug', 'test', 'scan']);
const _MARK = new Set(['markbot', 'mark']);
const _UNMARK = new Set(['unmarkbot', 'unmark']);
const _num = (jid) => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

export default {
    name: 'antibot',
    aliases: ['nobot', 'blockbot', 'botblock', 'antibots', 'removebots'],
    description: 'Warn or remove users who send this bot prefixed commands. Usage: .antibot warn|remove|off',
    run: async (context) => {
        const { client, m, args, prefix } = context;
        if (!m.chat?.endsWith('@g.us')) {
            return sendInteractive(client, m, fmt('This command is for groups only.'));
        }
        if (!(context.isAdmin || m.isAdmin)) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt('Only group admins can configure or manage ANTIBOT.'));
        }
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        const val = (args[0] || '').toLowerCase();
        const gs = await getGroupSettings(m.chat);
        const current = gs?.antibot || 'off';

        if (_CHECK.has(val)) {
            if (!m.quoted) {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt(`Reply to a suspected bot's message with\n│ *${prefix}antibot check* to see what\n│ ANTIBOT sees for that message.`));
            }
            const qSender = m.quoted.sender || '';
            const qText = m.quoted.text || '';
            await commandsReady;
            const commandNames = new Set([...Object.keys(commands), ...Object.keys(aliases)].map(name => String(name).toLowerCase()));
            const isCommand = isPrefixedBotCommand(qText, commandNames);
            await client.sendMessage(m.chat, { react: { text: '🔍', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt(`Sender: @${(qSender || '').split('@')[0]}\n│ Prefixed command in quoted text: *${isCommand ? 'YES' : 'NO'}*\n│ Text: ${qText || '(none)'}\n│ Only registered bot commands are moderated.`), { mentions: [qSender].filter(Boolean) });
        }

        if (_MARK.has(val) || _UNMARK.has(val)) {
            if (!m.quoted) {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt(`Reply to the bot's message with\n│ *${prefix}antibot markbot* to permanently\n│ flag that sender as a bot everywhere.`));
            }
            const qSender = m.quoted.sender || m.msg?.contextInfo?.participant || '';
            const qNum = _num(qSender);
            if (!qNum) {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt('Could not resolve a sender number from that message.'));
            }
            if (_MARK.has(val)) {
                await addKnownBot(qNum);
                await client.sendMessage(m.chat, { react: { text: '🤖', key: m.reactKey } }).catch(() => {});
                return sendInteractive(client, m, fmt(`@${qNum} is now flagged as a known bot.\n│ Its registered, prefixed bot commands\n│ will be kicked in ANTIBOT groups.`), { mentions: [qSender].filter(Boolean) });
            }
            await removeKnownBot(qNum);
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt(`@${qNum} removed from the known-bots list.`), { mentions: [qSender].filter(Boolean) });
        }

        if (val === 'botlist') {
            const bots = await getKnownBots();
            await client.sendMessage(m.chat, { react: { text: '📋', key: m.reactKey } }).catch(() => {});
            if (!bots.length) return sendInteractive(client, m, fmt('No numbers are flagged as known bots yet.'));
            return sendInteractive(client, m, fmt(`Known bots:\n│ ${bots.map(n => '@' + n).join('\n│ ')}`), { mentions: bots.map(n => n + '@s.whatsapp.net') });
        }

        const modeLabel =
            current === 'warn'   ? 'WARN ⚠️'   :
            current === 'remove' ? 'REMOVE 🚫' : 'OFF ❌';

        if (!val) {
            await client.sendMessage(m.chat, { react: { text: '📋', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt(
                `Status: *${modeLabel}*\n│ \n│ Only registered commands from this bot\n│ with a prefix are moderated.\n│ Regular words, unknown commands, stickers,\n│ audio, and other media are ignored.\n│ \n│ Usage:\n│ *${prefix}antibot warn*   → delete + warn; kick on repeat command\n│ *${prefix}antibot remove* → delete + kick instantly for commands\n│ *${prefix}antibot off*   → disable\n│ \n│ *${prefix}antibot check* (reply to a msg) → check command match\n│ *${prefix}antibot markbot* (reply) → flag sender for command attempts\n│ *${prefix}antibot unmarkbot* (reply) → unflag\n│ *${prefix}antibot botlist* → show flagged numbers`
            ));
        }

        const normalised =
            val === 'on' || val === 'enable' || val === 'enabled' || val === 'activate' ? 'warn' :
            val === 'disable' || val === 'disabled' || val === 'deactivate' || val === 'false' || val === '0' || val === 'no' || val === 'stop' ? 'off' :
            val;

        const validModes = ['off', 'warn', 'remove'];
        if (!validModes.includes(normalised)) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt(`Invalid option: *${val}*\n│ Use: *warn*, *remove*, or *off*`));
        }

        if (current === normalised) {
            await client.sendMessage(m.chat, { react: { text: '⚠️', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt(`Antibot is already *${normalised.toUpperCase()}*. Pay attention.`));
        }

        await updateGroupSetting(m.chat, 'antibot', normalised);
        await getGroupSettingsFresh(m.chat);
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});

        const desc =
            normalised === 'off'    ? 'Anti-Bot *DISABLED ❌*\n│ Bots are now allowed in this group.' :
            normalised === 'warn'   ? 'Anti-Bot set to *WARN ⚠️*\n│ First bot-command attempt → warning.\n│ Repeat command → kicked. 🤖❌' :
                                     'Anti-Bot set to *REMOVE 🚫*\n│ A non-admin using a registered bot\n│ command is kicked instantly. 😈';
        return sendInteractive(client, m, fmt(desc));
    }
};
