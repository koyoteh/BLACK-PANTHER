import { generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { getSettings, updateSetting } from '../../database/config.js';
import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { getDeviceMode } from '../../lib/deviceMode.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { client, m, args, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        const fmt = (msg) => `▢ ${msg}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`;

        try {
            const settings = await getSettings();
            const isEnabled = settings.stealth === 'true' || settings.stealth === true;
            const value = args[0]?.toLowerCase();

            if (value === 'on') {
                if (isEnabled) {
                    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
                    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                    return await client.sendMessage(m.chat, { text: fmt('Stealth Mode already ON, genius. 👻 Bot auto-deletes commands + replies after 8s.') });
                }
                await updateSetting('stealth', true);
                await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
                return await client.sendMessage(m.chat, { text: fmt('Stealth Mode: *ON 👻* — commands vanish after 8s. Ghost mode activated.') });
            }

            if (value === 'off') {
                if (!isEnabled) {
                    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
                    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                    return await client.sendMessage(m.chat, { text: fmt('Stealth Mode already OFF, clown. 💡 Messages stay.') });
                }
                await updateSetting('stealth', false);
                await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
                return await client.sendMessage(m.chat, { text: fmt('Stealth Mode: *OFF 💡* — messages stick around like an ex.') });
            }

                        const _devMode = await getDeviceMode();
            if (_devMode === 'ios') {
          await client.sendMessage(m.chat, { react: { text: '📋', key: m.reactKey } });
          await sendInteractive(client, m, `⚡ ──「 STEALTH 」──
▢ Status: ${settings.stealth ? 'ON ✅' : 'OFF ❌'}\n▢ \n▢ Options:\n▢ ${prefix}stealth on\n▢ ${prefix}stealth off\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──\n> 🌐 wa.me/254116284050`);
      } else {
    const _stealthMsg = generateWAMessageFromContent(
                    m.chat,
                    {
                        interactiveMessage: {
                            body: { text: fmt(`Stealth Mode: *${isEnabled ? 'ON 👻' : 'OFF 💡'}*\n▢ Usage: *${prefix}stealth on/off*\n▢ When ON, bot auto-deletes commands + replies after 8s.`) },
                            footer: { text: '' },
                            nativeFlowMessage: {
                                buttons: [{
                                    name: 'single_select',
                                    buttonParamsJson: JSON.stringify({
                                        title: 'Choose an option',
                                        sections: [{
                                            rows: [
                                                { title: 'ON 👻', id: `${prefix}stealth on` },
                                                { title: 'OFF 💡', id: `${prefix}stealth off` }
                                            ]
                                        }]
                                    })
                                }]
                            }
                        }
                    }
                );
                await client.relayMessage(m.chat, _stealthMsg.message, { messageId: _stealthMsg.key.id });
            }
        } catch (err) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
            await client.sendMessage(m.chat, { text: fmt(`Crashed. 💀 Error: ${err.message}`) });
        }
    });
};
