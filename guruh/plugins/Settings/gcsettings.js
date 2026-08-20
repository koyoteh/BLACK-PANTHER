import { getGroupSettings } from '../../database/config.js';
import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { client, m } = context;

        const jid = m.chat;

        if (!jid.endsWith('@g.us')) {
            await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, "▢ This command is for groups only, you fool.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──");
        }

        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
        let groupSettings = await getGroupSettings(jid);

        if (!groupSettings) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return await sendInteractive(client, m, "▢ No group settings found. Configure something first!\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──");
        }

        const on = (v) => (v ? '✅ ON' : '❌ OFF');
        let response = `⚡ ──「 GROUP SETTINGS 」──
`;
        response += `▢ Antilink: ${on(groupSettings.antilink)}\n`;
        response += `▢ Antibot: ${on(groupSettings.antibot)}\n`;
        response += `▢ Antidelete: ${on(groupSettings.antidelete)}\n`;
        response += `▢ Events: ${on(groupSettings.events)}\n`;
        response += `▢ Antitag: ${on(groupSettings.antitag)}\n`;
        response += `▢ GCPresence: ${on(groupSettings.gcpresence)}\n`;
        response += `▢ Antiforeign: ${on(groupSettings.antiforeign)}\n`;
        response += `▢ Antidemote: ${on(groupSettings.antidemote)}\n`;
        response += `▢ Antipromote: ${on(groupSettings.antipromote)}\n`;
        response += `▢ Welcome: ${on(groupSettings.welcome)}\n`;
        response += `▢ Goodbye: ${on(groupSettings.goodbye)}\n`;
        response += `└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`;

        await sendInteractive(client, m, response);
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
    });
};
