'use strict';
const { getGroupSettings }         = require('../db/database');
const config                       = require('../config/settings');
const { cleanJid }                 = require('../utils/helpers');
const { getGroupMeta }             = require('../utils/groupCache');

/**
 * Handles group-participants.update events
 * (join / leave / promote / demote)
 * Cache is already busted before this is called (see connection.js),
 * so getGroupMeta will do a fresh fetch and re-cache.
 */
async function handleGroupUpdate(event, sock) {
    const { id: groupJid, participants, action } = event;

    let groupMeta;
    try { groupMeta = await getGroupMeta(sock, groupJid); } catch { return; }

    const groupName = groupMeta?.subject || groupJid;
    const settings  = getGroupSettings(groupJid);

    for (const participant of participants) {
        const number = participant.split('@')[0];
        const tag    = `@${number}`;

        if (action === 'add' && settings.antiforeign) {
            const botJid      = sock.user?.id || '';
            const botNumber   = botJid.split(':')[0].split('@')[0];
            const ownerNumber = config.OWNER_NUMBER;
            const localCodes  = ['254', '255', '256', '257'];  // KE, TZ, UG, BI — adjust as needed
            const numStr      = participant.split('@')[0];
            const isForeign   = !localCodes.some(c => numStr.startsWith(c));
            const isBot       = numStr === botNumber;
            const isOwner     = numStr === ownerNumber;

            if (isForeign && !isBot && !isOwner) {
                await sock.groupParticipantsUpdate(groupJid, [participant], 'remove').catch(() => {});
                await sock.sendMessage(groupJid, {
                    text: `🌍 *Anti-Foreign*\n\n${tag} was removed — only local numbers are allowed in this group.\n\n> _${config.BOT_NAME}_`,
                    mentions: [participant],
                }).catch(() => {});
            }
        }

        if (action === 'add' && settings.welcome) {
            let welcomeText;
            if (settings.welcomeMsg) {
                welcomeText = settings.welcomeMsg
                    .replace(/\{name\}/gi, tag)
                    .replace(/\{group\}/gi, groupName);
            } else {
                welcomeText =
                    `👋 *Welcome to ${groupName}!* 🎉\n\n` +
                    `Hey ${tag}, we're glad to have you here!\n` +
                    `Please read the group rules and enjoy your stay. 😊\n\n` +
                    `> _${config.BOT_NAME}_`;
            }
            await sock.sendMessage(groupJid, {
                text: welcomeText,
                mentions: [participant],
            }).catch(() => {});
        }

        if (action === 'remove' && settings.goodbye) {
            await sock.sendMessage(groupJid, {
                text: `👋 Goodbye, ${tag}! We'll miss you in *${groupName}*.\n\n> _${config.BOT_NAME}_`,
                mentions: [participant],
            }).catch(() => {});
        }

        if (action === 'promote') {
            await sock.sendMessage(groupJid, {
                text: `🎉 Congratulations ${tag}! You've been promoted to *Admin* in *${groupName}*.\n\n> _${config.BOT_NAME}_`,
                mentions: [participant],
            }).catch(() => {});
        }

        if (action === 'demote') {
            await sock.sendMessage(groupJid, {
                text: `ℹ️ ${tag} has been demoted from *Admin* in *${groupName}*.\n\n> _${config.BOT_NAME}_`,
                mentions: [participant],
            }).catch(() => {});
        }
    }
}

/**
 * Handles groups.update events (subject/desc/icon changes)
 */
async function handleGroupSettingsUpdate(events, sock) {
    for (const event of events) {
        if (event.subject !== undefined) {
            await sock.sendMessage(event.id, {
                text: `📝 Group name updated to: *${event.subject}*\n\n> _${config.BOT_NAME}_`
            }).catch(() => {});
        }
    }
}

module.exports = { handleGroupUpdate, handleGroupSettingsUpdate };
