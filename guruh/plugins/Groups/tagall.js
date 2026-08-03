import { resolveTargetJid } from '../../lib/lidResolver.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    const { client, m, groupMetadata, text } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    if (!m.isGroup) return sendInteractive(client, m, `▢ Command meant for groups.\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`);

    const resolveParticipantJid = (p, participants) => {
        if (p.pn) return String(p.pn).replace(/\D/g, '') + '@s.whatsapp.net';
        const base = p.jid || p.id || '';
        if (base && !base.endsWith('@lid')) return base.split(':')[0].split('@')[0].replace(/\D/g, '') + '@s.whatsapp.net';
        return resolveTargetJid(base, participants);
    };

    try {
        const participants = groupMetadata?.participants || [];
        const mentions = participants.map(p => resolveParticipantJid(p, participants)).filter(Boolean);
        const txt = [
            `⚡ ──「 TAG ALL  」──`,
            `▢ Message: ${text ? text : 'Yo, listen up!'}`,
            `▢ `,
            ...mentions.map(id => `▢ @${id.split('@')[0]}`),
            `└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`
        ].join('\n');
        await client.sendMessage(m.chat, { text: txt, mentions });
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
    } catch (error) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
        await sendInteractive(client, m, `▢ Failed to tag participants.\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`);
    }
};
