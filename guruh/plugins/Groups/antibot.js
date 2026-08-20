import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';
// Use the same SQLite db that PantherAntiBot reads from (guru/db/database.js)
// CJS modules can be default-imported in ESM
import _db from '../../../guru/db/database.js';
import { getDeviceMode } from '../../lib/deviceMode.js';

const { getGroupSettings, setGroupSetting } = _db;

export default {
    name: 'antibot',
    aliases: ['antibotcmd', 'nobot'],
    description: 'Prevent non-admins from using bot commands in a group. Kicks violators instantly.',
    run: async (context) => {
        const { client, m, args, isAdmin, isBotAdmin, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        const fmt = (msg) =>
            `⚡ ──「 ANTIBOT 」──\n▢ ${msg}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`;

        if (!m.isGroup) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await client.sendMessage(m.chat, { text: fmt('Groups only, genius.') });
        }

        if (!isAdmin) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await client.sendMessage(m.chat, { text: fmt("Admins only. You're not special enough.") });
        }

        if (!isBotAdmin) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await client.sendMessage(m.chat, {
                text: fmt("Make me admin first. I can't kick anyone without power."),
            });
        }

        try {
            const groupSettings = getGroupSettings(m.chat);
            const value = (args[0] || '').toLowerCase();
            const validModes = ['on', 'off'];

            if (validModes.includes(value)) {
                const currentlyOn = !!groupSettings.antibot;
                const wantOn = value === 'on';
                if (currentlyOn === wantOn) {
                    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                    return await client.sendMessage(m.chat, {
                        text: fmt(`Antibot is already *${value.toUpperCase()}*. Pay attention.`),
                    });
                }
                setGroupSetting(m.chat, 'antibot', wantOn);
                await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
                const desc = wantOn
                    ? 'Non-admins who send bot commands will be *instantly kicked*. No mercy.'
                    : 'Everyone can use bot commands now.';
                return await client.sendMessage(m.chat, {
                    text: fmt(`Antibot *${value.toUpperCase()}*.\n▢ ${desc}`),
                });
            }

            // Show current status
            const currentMode = !!groupSettings.antibot ? 'ON ✅' : 'OFF ❌';
            const bodyText = fmt(
                `Antibot status: *${currentMode}*\n▢ \n▢ *on*  — Non-admins using commands get kicked instantly\n▢ *off* — Everyone can use commands freely\n▢ \n▢ Usage: *${prefix}antibot on/off*`
            );

            const device = await getDeviceMode();
            if (device === 'ios') {
                await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
                return await client.sendMessage(m.chat, { text: bodyText });
            }

            const _msg = generateWAMessageFromContent(
                m.chat,
                proto.Message.fromObject({
                    interactiveMessage: {
                        body: { text: bodyText },
                        footer: { text: '' },
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: 'single_select',
                                    buttonParamsJson: JSON.stringify({
                                        title: 'Toggle Antibot',
                                        sections: [
                                            {
                                                rows: [
                                                    {
                                                        title: 'ON',
                                                        description: 'Kick non-admins who use commands',
                                                        id: `${prefix}antibot on`,
                                                    },
                                                    {
                                                        title: 'OFF',
                                                        description: 'Allow everyone to use commands',
                                                        id: `${prefix}antibot off`,
                                                    },
                                                ],
                                            },
                                        ],
                                    }),
                                },
                            ],
                        },
                    },
                }),
                { timestamp: new Date(), userJid: client.user?.id }
            );
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
            await client.relayMessage(m.chat, _msg.message, { messageId: _msg.key.id });
        } catch (error) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            console.error('[ANTIBOT CMD] Error:', error);
            await client.sendMessage(m.chat, { text: fmt('Something broke. Try again.') });
        }
    },
};
