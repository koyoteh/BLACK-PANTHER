const EMOJI = '🎨';
const LABEL = 'EFFECTS';

const EFFECT_CMDS = [
    'glossysilver', 'glitchtext', 'advancedglow', 'neonglitch', 'gradienttext', 'glowingtext',
    'luxurygold', 'multicolored', 'galaxytext', 'makingneon', 'writetext', 'underwater',
    'pixelglitch', 'summerbeach', 'papercut', 'cloudtext', 'gradientlogo', 'galaxylogo',
    'colorfulneon', 'greenneon', '1917text', 'texteffect', 'lighteffect', 'bearlogo',
    'typography', 'hackerneon', 'blackpinklogo', 'blackpinkstyle', 'erasertext', 'cartoonstyle'
];

export default {
    name: 'effectsmenu',
    aliases: ['effectlist', 'fxmenu', 'texteffects'],
    description: 'Displays all text effect commands',
    run: async (context) => {
        const { client, m, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        const p      = prefix || '.';
        const header = `⚡ ──「 ${EMOJI} *${LABEL}* 」──\n▢ ${EFFECT_CMDS.length} effects available\n▢ 📌 Usage: ${p}<effect> YourText\n\n`;
        const footer = `\n└──✦ _Powered by GuruTech_ ✦──`;

        let menuText = header;
        EFFECT_CMDS.forEach((cmd, i) => {
            menuText += `▢ ${String(i + 1).padStart(2, ' ')}. *${p}${cmd}*\n`;
        });
        menuText += footer;

        await client.sendMessage(m.chat, { text: menuText });
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
    }
};
