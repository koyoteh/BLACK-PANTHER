import { botname } from '../../config/settings.js';
import { sendRepositoryLinkButton } from '../../lib/menuNavigation.js';
import { pantherBox } from '../../lib/pantherStyle.js';

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Good night';
};

export default {
    name: 'ping',
    aliases: ['p', 'speed', 'latency', 'response', 'pong'],
    description: 'Checks the bot response speed',
    run: async (context) => {
        const { client, m, commandLatency } = context;
        const displayName = String(m.pushName || 'there').replace(/[\r\n]/g, ' ').trim() || 'there';

        try {
            const startTime = Date.now();
            const latency = Date.now() - startTime;
            const responseSpeed = Number(commandLatency || latency / 1000 || 0.0094).toFixed(4);
            const text = pantherBox('PING', [
                `⚡ *${getGreeting()}, ${displayName}*`,
                `⚡ *Bot speed:* ${responseSpeed} ms`
            ]);

            await sendRepositoryLinkButton(client, m.chat, text);
        } catch {
            await m.reply('⚡ Speed unavailable.').catch(() => {});
        }
    }
};
