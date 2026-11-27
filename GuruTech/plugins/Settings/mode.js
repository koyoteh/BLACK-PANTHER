import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendRepositoryLinkButton } from '../../lib/menuNavigation.js';

const MODES = {
    public:  { emoji: '🌐', label: 'PUBLIC' },
    private: { emoji: '🔒', label: 'PRIVATE' },
    group:   { emoji: '👥', label: 'GROUP' },
    inbox:   { emoji: '📩', label: 'INBOX' }
};

function modeCard(message) {
    return [
        '╭•─⛓ *BLACK PANTHER · MODE* ⛓─•╮',
        `⛓ ▣ ${message}`,
        '╰•─⛓━━━━━━━━━━⛓─•╯'
    ].join('\n');
}

export async function executeModeCommand(context, dependencies = {}) {
    const { client, m, args = [], prefix = '.' } = context;
    const readSettings = dependencies.getSettings || (async () => (await import('../../database/config.js')).getSettings());
    const saveSetting = dependencies.updateSetting || (async (...values) => (await import('../../database/config.js')).updateSetting(...values));
    const sendCard = dependencies.sendRepositoryLinkButton || sendRepositoryLinkButton;
    let response;

    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    try {
        const settings = await readSettings();
        const current = String(settings.mode || 'public').toLowerCase();
        const input = String(args[0] || '').toLowerCase();
        const currentMode = MODES[current] || MODES.public;

        if (!input) {
            response = modeCard(`Active: ${currentMode.emoji} *${currentMode.label}*\n⛓ _Use ${prefix}mode <public/private/group/inbox>_`);
        } else if (!MODES[input]) {
            response = modeCard(`Use: ${prefix}mode public/private/group/inbox`);
        } else if (current === input) {
            response = modeCard(`Already active: ${MODES[input].emoji} *${MODES[input].label}*`);
        } else {
            await saveSetting('mode', input);
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
            response = modeCard(`Mode updated: ${MODES[input].emoji} *${MODES[input].label}*`);
        }
    } catch {
        response = modeCard('Mode unchanged. Try again.');
    }

    // Keep the mode status and the only CTA in a single WhatsApp card.
    return sendCard(client, m.chat, response);
}

export default {
    name: 'mode',
    aliases: ['botmode', 'setmode', 'changemode', 'switchmode'],
    description: 'Control who can use the bot and where',
    run: async (context) => ownerMiddleware(context, () => executeModeCommand(context))
};
