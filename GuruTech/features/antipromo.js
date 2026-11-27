import { getGroupSettings, addWarn, resetWarn, getWarnLimit } from '../database/config.js';
import { resolveTargetJid } from '../lib/lidResolver.js';
import { detectBusinessPromotion } from '../lib/promotionDetector.js';

const DEV_NUMBER = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const _num = (jid) => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const _pNum = (p) => {
    const phone = p.phoneNumber || p.phone_number || '';
    if (phone) return _num(phone);
    const base = p.id || p.jid || '';
    if (base && !base.endsWith('@lid')) return _num(base);
    return _num(p.lid || base);
};
const fmt = (msg) => `╭─❏ 「 ANTIPROMO 」\n│ ${msg}\n╰───────────────`;

function extractText(message, depth = 0) {
    if (!message || typeof message !== 'object' || depth > 8) return '';
    const direct = [
        message.conversation,
        message.extendedTextMessage?.text,
        message.extendedTextMessage?.matchedText,
        message.extendedTextMessage?.canonicalUrl,
        message.imageMessage?.caption,
        message.videoMessage?.caption,
        message.documentMessage?.caption
    ].find(value => typeof value === 'string' && value.trim());
    if (direct) return direct;
    for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'deviceSentMessage', 'documentWithCaptionMessage']) {
        const nested = message[key]?.message;
        if (nested) {
            const text = extractText(nested, depth + 1);
            if (text) return text;
        }
    }
    return '';
}

export default async (client, m) => {
    try {
        if (!m?.chat?.endsWith('@g.us') || m.key?.fromMe) return;
        const senderNumber = _num(m.sender);
        if (DEV_NUMBER && senderNumber === DEV_NUMBER) return;

        const settings = await getGroupSettings(m.chat);
        const mode = String(settings?.antipromo || 'off').toLowerCase();
        if (!mode || mode === 'off') return;

        const text = [m.text, m.body, extractText(m.message)].filter(Boolean).join('\n');
        const detection = detectBusinessPromotion(text);
        if (!detection) return;

        const metadata = await client.groupMetadata(m.chat);
        const sender = resolveTargetJid(m.sender, metadata.participants) || m.sender;
        if (!sender) return;
        const senderNum = _num(sender) || sender.split('@')[0];
        const botRaw = client.decodeJid ? client.decodeJid(client.user?.id) : (client.user?.id || '');
        const botNum = _num(botRaw);
        const isAdmin = metadata.participants.some(p => _pNum(p) === _num(sender) && (p.admin === 'admin' || p.admin === 'superadmin'));
        const isBotAdmin = metadata.participants.some(p => _pNum(p) === botNum && (p.admin === 'admin' || p.admin === 'superadmin'));
        if (isAdmin) return;

        if (!isBotAdmin) {
            await client.sendMessage(m.chat, {
                text: fmt(`@${senderNum} posted a likely promotional pitch.\n│ I need group-admin status to remove it.`),
                mentions: [sender]
            });
            return;
        }

        try {
            if (m.key?.id) {
                await client.sendMessage(m.chat, {
                    delete: {
                        remoteJid: m.chat,
                        fromMe: false,
                        id: m.key.id,
                        participant: m.key.participant || m.sender
                    }
                });
            }
        } catch {}

        if (mode === 'delete' || mode === 'on') {
            return client.sendMessage(m.chat, {
                text: fmt(`🚫 @${senderNum}, promotional business posts aren't allowed here.\n│ Message deleted.`),
                mentions: [sender]
            });
        }

        if (mode === 'kick') {
            try { await client.groupParticipantsUpdate(m.chat, [sender], 'remove'); } catch {}
            return client.sendMessage(m.chat, {
                text: fmt(`🚨 @${senderNum} was removed for promotional spam.\n│ The post was deleted. No second chances.`),
                mentions: [sender]
            });
        }

        const warnLimit = await getWarnLimit(m.chat);
        const warnCount = await addWarn(m.chat, senderNum);
        if (warnCount >= warnLimit) {
            await resetWarn(m.chat, senderNum);
            try { await client.groupParticipantsUpdate(m.chat, [sender], 'remove'); } catch {}
            return client.sendMessage(m.chat, {
                text: fmt(`🚨 @${senderNum} was removed for repeated promotional spam.\n│ Warns: ${warnCount}/${warnLimit}. The post was deleted.`),
                mentions: [sender]
            });
        }

        const remaining = warnLimit - warnCount;
        return client.sendMessage(m.chat, {
            text: fmt(`⚠️ @${senderNum}, that looks like a business/income promotion.\n│ Message deleted. Warns: ${warnCount}/${warnLimit}.\n│ ${remaining} more and you're removed.`),
            mentions: [sender]
        });
    } catch (error) {
        console.error('[ANTIPROMO] Error:', error?.message || error);
    }
};
