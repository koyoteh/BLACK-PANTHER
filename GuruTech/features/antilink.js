import { getGroupSettings, addWarn, resetWarn, getWarnLimit, getTrustedLinks } from '../database/config.js';
import { resolveTargetJid } from '../lib/lidResolver.js';
import { extractLinkDomains, extractMessageText, hasAnyLink, hasForwardedContentMetadata, isStickerMessage } from '../lib/linkDetection.js';
import { notifyMissingAdmin } from '../lib/adminNotice.js';

const DEV_NUMBER = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const processedMessages = new Set();

const _num = (jid) => (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');

const _pNum = (p) => {
    const phone = p.phoneNumber || p.phone_number || '';
    if (phone) return _num(phone);
    const base = p.id || p.jid || '';
    if (base && !base.endsWith('@lid')) return _num(base);
    return _num(p.lid || base);
};

const isDevJid = (jid) => _num(jid) === DEV_NUMBER;

const fmt = (msg) => `╭─❏ 「 ANTILINK 」\n│ ${msg}\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`;

export default async (client, m) => {
    try {
        if (!m || !m.chat || !m.chat.endsWith('@g.us')) return;
        if (m.key?.fromMe) return;
        if (isDevJid(m.sender)) return;

        const msg = m.message || {};
        // Skip stickers before any database or group-metadata lookup. This keeps
        // sticker bursts out of the anti-link work queue entirely.
        if (isStickerMessage(msg) || m.mtype === 'stickerMessage') return;

        const messageId = m.key?.id;
        if (messageId) {
            if (processedMessages.has(messageId)) return;
            processedMessages.add(messageId);
            if (processedMessages.size > 5000) processedMessages.delete(processedMessages.values().next().value);
        }

        const groupSettings = await getGroupSettings(m.chat);
        const antilinkMode = (groupSettings.antilink || 'off').toLowerCase();
        if (antilinkMode === 'off') return;

        const isChannelForward = hasForwardedContentMetadata(msg);

        const text = [m.text, extractMessageText(msg)].filter(Boolean).join('\n');
        const hasPreview = msg.extendedTextMessage?.matchedText || msg.extendedTextMessage?.canonicalUrl;
        const hasLink = hasAnyLink(text) || hasAnyLink(hasPreview || '');

        // Forwarded metadata alone is not evidence of a link. Require a real URL
        // in visible text, a preview, or link-bearing message metadata.
        if (!hasLink) return;

        if (hasLink && !isChannelForward) {
            try {
                const ownCode = await client.groupInviteCode(m.chat);
                const ownLink = `https://chat.whatsapp.com/${ownCode}`;
                if (text.includes(ownLink) || text.includes(ownCode)) return;
            } catch {}
        }

        if (hasLink && !isChannelForward) {
            try {
                const trustedDomains = await getTrustedLinks(m.chat);
                if (trustedDomains && trustedDomains.length > 0) {
                    const msgDomains = extractLinkDomains(text);
                    const previewDomain = hasPreview
                        ? (() => {
                            try { return new URL(hasPreview).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
                        })()
                        : '';
                    const allDomains = msgDomains.concat(previewDomain ? [previewDomain] : []);
                    if (allDomains.length > 0 && allDomains.every(d => trustedDomains.some(t => d === t || d.endsWith('.' + t)))) {
                        return;
                    }
                }
            } catch {}
        }

        const groupMetadata = await client.groupMetadata(m.chat);
        const sender = resolveTargetJid(m.sender, groupMetadata.participants);

        if (!sender) return;

        const senderNum = _num(sender);
        const botRaw = client.decodeJid ? client.decodeJid(client.user.id) : (client.user?.id || '');
        const botNum = _num(botRaw);

        const isAdmin = groupMetadata.participants.some(p => {
            return _pNum(p) === senderNum && (p.admin === 'admin' || p.admin === 'superadmin');
        });
        const isBotAdmin = groupMetadata.participants.some(p => {
            return _pNum(p) === botNum && (p.admin === 'admin' || p.admin === 'superadmin');
        });

        const username = senderNum || sender.split('@')[0];
        const reason = isChannelForward ? '📡 Channel forward' : '🔗 Link detected';

        if (isAdmin) return;

        if (!isBotAdmin) {
            await notifyMissingAdmin(client, m, sender,
                fmt(`@${username} sent a link.\nMake me admin so I can actually do something about it. 😤`));
            return;
        }

        try {
            await client.sendMessage(m.chat, {
                delete: {
                    remoteJid: m.chat,
                    fromMe: false,
                    id: m.key.id,
                    participant: m.key.participant || m.sender
                }
            });
        } catch (e) {
        }

        if (antilinkMode === 'delete' || antilinkMode === 'on') {
            await client.sendMessage(m.chat, {
                text: fmt(`🚫 @${username}, links are not allowed here.\n│ Message deleted.`),
                mentions: [sender]
            });
            return;
        }

        if (antilinkMode === 'kick') {
            try {
                await client.groupParticipantsUpdate(m.chat, [sender], 'remove');
                await client.sendMessage(m.chat, {
                    text: fmt(`🚨 @${username} KICKED!\n│ Reason: links are not allowed here.\n│ Kick mode — zero tolerance. 😈`),
                    mentions: [sender]
                });
            } catch (e) {
            }
            return;
        }

        const MAX_WARNS = await getWarnLimit(m.chat);
        const newCount = await addWarn(m.chat, username);
        const remaining = MAX_WARNS - newCount;

        if (newCount >= MAX_WARNS) {
            await resetWarn(m.chat, username);
            try { await client.groupParticipantsUpdate(m.chat, [sender], 'remove'); } catch {}
            await client.sendMessage(m.chat, {
                text: fmt(`🚨 @${username} KICKED!\n│ Reason: links are not allowed here\n│ Warns: ${newCount}/${MAX_WARNS}\n│ That's it. Get out. 😈\n│ Warn count wiped clean.`),
                mentions: [sender]
            });
            return;
        }

        await client.sendMessage(m.chat, {
            text: fmt(`⚠️ @${username}, warned!\n│ Reason: links are not allowed here\n│ Message deleted.\n│ Warns: ${newCount}/${MAX_WARNS}\n│ ${remaining} more and you're GONE. 😈`),
            mentions: [sender]
        });
    } catch (err) {
        console.error('[ANTILINK] Error:', err.message);
    }
};
