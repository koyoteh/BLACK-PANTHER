import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const EMOJI = '🎨';
const LABEL = 'EFFECTS & LOGO';

export default {
    name: 'logomenu',
    aliases: ['effectslist', 'logolist'],
    description: 'Displays all available logo & effects commands',
    run: async (context) => {
        const { client, m, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        let effectCommands = [];
        try {
            // Dynamically import to avoid top-level import issues with ESM arrays
            const effectsMod = await import('../../plugins/Effects/effects.js');
            const list = Array.isArray(effectsMod.default) ? effectsMod.default : [];
            for (const cmd of list) {
                if (cmd && cmd.name) effectCommands.push(cmd.name);
            }
        } catch {}

        const p      = prefix || '.';
        const header = `⚡ ──「 ${EMOJI} *${LABEL}* 」──\n▢ ${effectCommands.length} effects available\n\n`;
        const footer = `\n└──✦ _Powered by GuruTech_ ✦──`;

        let menuText = header;
        effectCommands.forEach((name, i) => {
            menuText += `▢ ${String(i + 1).padStart(2, ' ')}. *${p}${name}*\n`;
        });
        menuText += footer;

        await client.sendMessage(m.chat, { text: menuText });
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
    }
};
