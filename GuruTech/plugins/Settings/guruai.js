import { generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { getSettings, updateSetting } from '../../database/config.js';
import { getDeviceMode } from '../../lib/deviceMode.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

const DEV_NUMBER = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');

export default {
    name: 'ultraai',
    aliases: ['devai', 'ultraagent'],
    description: 'Toggle ULTRA AI GitHub assistant (owner only)',
    run: async (context) => {
        const { client, m, args, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        const senderNum = (m.sender || '').split('@')[0].split(':')[0].replace(/\D/g, '');
        const fmt = (title, lines) => {
            const body = (Array.isArray(lines) ? lines : [lines]).map(l => `│ ${l}`).join('\n');
            return `╭─❏ 「 ${title}」
│
${body}\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`;
        };

        if (!DEV_NUMBER || senderNum !== DEV_NUMBER) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
            return client.sendMessage(m.chat, {
                text: fmt('ULTRA AI', ['Access denied.', 'Owner-only feature.'])
            });
        }

        try {
            const settings = await getSettings();
            const value = (args[0] || '').toLowerCase();

            if (value === 'on' || value === 'off') {
                const newState = value === 'on';
                await updateSetting('ultraai', newState);
                await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
                return client.sendMessage(m.chat, {
                    text: fmt('ULTRA AI', newState
                        ? ['Status: ✅ ON', 'GitHub AI agent active. Just text me GitHub tasks.']
                        : ['Status: ❌ OFF', 'GitHub AI disabled.'])
                });
            }

            const isOn = settings.ultraai === true || settings.ultraai === 'true';

          await client.sendMessage(m.chat, { react: { text: '📋', key: m.reactKey } });
          await sendInteractive(client, m, `╭─❏ 「 ULTRA AI」
│ Status: ${isOn ? 'ON ✅' : 'OFF ❌'}\n│ \n│ Options:\n│ ${prefix}ultraai on\n│ ${prefix}ultraai off\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);

        } catch {
            client.sendMessage(m.chat, { text: fmt('ULTRA AI', 'Something went wrong. Please try again.') });
        }
    }
};
