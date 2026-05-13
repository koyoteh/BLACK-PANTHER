'use strict';
const { addCmd }                = require('../../guru/handlers/loader');
const { getGroupSettings, setGroupSetting, addWarning, getWarnings, clearWarnings, saveNote, getNote, getAllNotes, deleteNote } = require('../../guru/db/database');
const { cleanJid, numberToJid } = require('../../guru/utils/helpers');
const config                    = require('../../guru/config/settings');
const { channelCtx }            = require('../../guru/utils/gmdFunctions2');

// ── Helper: resolve mention/reply to a JID ───────────────────────
function resolveTarget(ctx) {
    const contextParticipant = ctx.m.message?.extendedTextMessage?.contextInfo?.participant
        || ctx.m.message?.imageMessage?.contextInfo?.participant
        || ctx.m.message?.videoMessage?.contextInfo?.participant
        || ctx.m.message?.audioMessage?.contextInfo?.participant;
    if (contextParticipant) return cleanJid(contextParticipant);
    if (ctx.m.message?.extendedTextMessage?.contextInfo?.remoteJid &&
        !ctx.m.message?.extendedTextMessage?.contextInfo?.remoteJid?.endsWith('@g.us')) {
        return cleanJid(ctx.m.message.extendedTextMessage.contextInfo.remoteJid);
    }
    const mentions = ctx.m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentions.length) return cleanJid(mentions[0]);
    if (ctx.args[0]) return numberToJid(ctx.args[0]);
    return null;
}

// ── Safe send helper ─────────────────────────────────────────────
async function safeSend(ctx, text) {
    return ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
}

// ═══════════════════════════════════════════════════════════════════
//  KICK
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'kick',
    aliases: ['remove'],
    desc: 'Kick a member from the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to kick members.\n\n👉 Please promote me to group admin first.');
        const target = resolveTarget(ctx);
        if (!target) return safeSend(ctx, '❌ Tag a user or reply to their message.\n\nUsage: `.kick @user` or reply to a message');
        const targetNum = target.split('@')[0];
        const admins = ctx.admins || [];
        if (admins.includes(target)) return safeSend(ctx, `❌ Cannot kick *@${targetNum}* — they are an admin.`);
        try {
            await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'remove');
            await ctx.react('✅');
            await safeSend(ctx, `✅ *@${targetNum}* has been kicked from the group.`);
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to kick: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  ADD MEMBER
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'add',
    desc: 'Add a member to the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to add members.\n\n👉 Please promote me to group admin first.');
        const number = ctx.args[0];
        if (!number) return safeSend(ctx, '❌ Provide a number.\n\nExample: `.add 254712345678`');
        const jid = numberToJid(number);
        await ctx.react('⏳');
        try {
            await ctx.sock.groupParticipantsUpdate(ctx.from, [jid], 'add');
            await ctx.react('✅');
            await safeSend(ctx, `✅ *@${jid.split('@')[0]}* has been added to the group.`);
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, '❌ Failed to add user. They may have privacy settings enabled or already be in the group.');
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  PROMOTE / DEMOTE
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'promote',
    desc: 'Promote a member to admin',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to promote members.\n\n👉 Please promote me to group admin first.');
        const target = resolveTarget(ctx);
        if (!target) return safeSend(ctx, '❌ Tag a user or reply to their message.');
        await ctx.react('⏳');
        try {
            await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'promote');
            await ctx.react('✅');
            await safeSend(ctx, `🎉 *@${target.split('@')[0]}* has been promoted to *admin!*`);
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to promote: ${e.message}`);
        }
    },
});

addCmd({
    name: 'demote',
    desc: 'Demote an admin to member',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to demote members.\n\n👉 Please promote me to group admin first.');
        const target = resolveTarget(ctx);
        if (!target) return safeSend(ctx, '❌ Tag a user or reply to their message.');
        await ctx.react('⏳');
        try {
            await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'demote');
            await ctx.react('✅');
            await safeSend(ctx, `ℹ️ *@${target.split('@')[0]}* has been demoted to member.`);
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to demote: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  MUTE / UNMUTE
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'mute',
    desc: 'Mute the group (only admins can send messages)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to mute the group.\n\n👉 Please promote me to group admin first.');
        await ctx.react('⏳');
        try {
            await ctx.sock.groupSettingUpdate(ctx.from, 'announcement');
            setGroupSetting(ctx.from, 'mute', true);
            await ctx.react('✅');
            await safeSend(ctx, '🔇 Group has been *muted*. Only admins can send messages.');
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to mute: ${e.message}`);
        }
    },
});

addCmd({
    name: 'unmute',
    desc: 'Unmute the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to unmute the group.\n\n👉 Please promote me to group admin first.');
        await ctx.react('⏳');
        try {
            await ctx.sock.groupSettingUpdate(ctx.from, 'not_announcement');
            setGroupSetting(ctx.from, 'mute', false);
            await ctx.react('✅');
            await safeSend(ctx, '🔊 Group has been *unmuted*. Everyone can send messages.');
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to unmute: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  LOCK / UNLOCK GROUP (edit info permission)
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'lock',
    aliases: ['lockgroup'],
    desc: 'Lock group — only admins can edit group info',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to lock the group.\n\n👉 Please promote me to group admin first.');
        await ctx.react('⏳');
        try {
            await ctx.sock.groupSettingUpdate(ctx.from, 'locked');
            await ctx.react('✅');
            await safeSend(ctx, '🔒 Group info has been *locked*. Only admins can edit it.');
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to lock: ${e.message}`);
        }
    },
});

addCmd({
    name: 'unlock',
    aliases: ['unlockgroup'],
    desc: 'Unlock group — everyone can edit group info',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to unlock the group.\n\n👉 Please promote me to group admin first.');
        await ctx.react('⏳');
        try {
            await ctx.sock.groupSettingUpdate(ctx.from, 'unlocked');
            await ctx.react('✅');
            await safeSend(ctx, '🔓 Group info has been *unlocked*. Everyone can edit it.');
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to unlock: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  GROUP INFO
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'groupinfo',
    aliases: ['ginfo', 'gc'],
    desc: 'Show group information',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        await ctx.react('⏳');
        try {
            const meta    = await ctx.sock.groupMetadata(ctx.from);
            const members = meta.participants || [];
            const admins  = members.filter(p => p.admin).map(a => `@${a.id.split('@')[0]}`);
            const text    =
                `👥 *Group Info*\n\n` +
                `📛 *Name    :* ${meta.subject}\n` +
                `🆔 *JID     :* ${ctx.from}\n` +
                `👤 *Members :* ${members.length}\n` +
                `👑 *Admins  :* ${admins.length}\n` +
                `📝 *Desc    :* ${meta.desc || 'None'}\n` +
                `📅 *Created :* ${new Date(meta.creation * 1000).toLocaleDateString()}\n\n` +
                `_${config.BOT_NAME}_`;
            await ctx.react('✅');
            await safeSend(ctx, text);
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to fetch group info: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  TAG ALL
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'tagall',
    aliases: ['everyone', 'all'],
    desc: 'Mention all group members',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        await ctx.react('⏳');
        try {
            const meta     = await ctx.sock.groupMetadata(ctx.from);
            const mentions = (meta.participants || []).map(p => cleanJid(p.id));
            const tags     = mentions.map(j => `@${j.split('@')[0]}`).join(' ');
            const msg      = ctx.text
                ? `📣 *${ctx.text}*\n\n${tags}`
                : `📣 *Attention everyone!*\n\n${tags}`;
            await ctx.sock.sendMessage(ctx.from, { text: msg, mentions, contextInfo: channelCtx() });
            await ctx.react('✅');
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to tag all: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  TAG ADMINS
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'tagadmins',
    aliases: ['admins', 'pingadmins'],
    desc: 'Mention all group admins',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        await ctx.react('⏳');
        try {
            const meta   = await ctx.sock.groupMetadata(ctx.from);
            const admins = (meta.participants || []).filter(p => p.admin).map(p => cleanJid(p.id));
            if (!admins.length) return safeSend(ctx, '❌ No admins found in this group.');
            const tags   = admins.map(j => `@${j.split('@')[0]}`).join(' ');
            const msg    = ctx.text
                ? `🛡️ *Admins, your attention please!*\n\n${ctx.text}\n\n${tags}`
                : `🛡️ *Pinging all admins:*\n\n${tags}`;
            await ctx.sock.sendMessage(ctx.from, { text: msg, mentions: admins, contextInfo: channelCtx() });
            await ctx.react('✅');
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  LIST MEMBERS
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'members',
    aliases: ['listmembers', 'memberlist'],
    desc: 'List all group members',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        await ctx.react('⏳');
        try {
            const meta    = await ctx.sock.groupMetadata(ctx.from);
            const members = meta.participants || [];
            const list    = members.map((p, i) => {
                const num  = p.id.split('@')[0];
                const role = p.admin === 'superadmin' ? '👑' : p.admin ? '🛡️' : '👤';
                return `${i + 1}. ${role} @${num}`;
            }).join('\n');
            const text =
                `👥 *Members of ${meta.subject}* (${members.length})\n\n` +
                `${list}\n\n` +
                `👑 = Owner  🛡️ = Admin  👤 = Member\n\n` +
                `_${config.BOT_NAME}_`;
            await ctx.sock.sendMessage(ctx.from,
                { text, mentions: members.map(p => cleanJid(p.id)), contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
            await ctx.react('✅');
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  INVITE LINK
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'invitelink',
    aliases: ['invite', 'link', 'grouplink'],
    desc: 'Get the group invite link',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to get the invite link.\n\n👉 Please promote me to group admin first.');
        await ctx.react('⏳');
        try {
            const code = await ctx.sock.groupInviteCode(ctx.from);
            await ctx.react('✅');
            await safeSend(ctx,
                `🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}\n\n_${config.BOT_NAME}_`
            );
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to get invite link: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  REVOKE INVITE LINK
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'revoke',
    aliases: ['revokelink', 'resetlink'],
    desc: 'Revoke and reset the group invite link',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to revoke the link.\n\n👉 Please promote me to group admin first.');
        await ctx.react('⏳');
        try {
            const newCode = await ctx.sock.groupRevokeInvite(ctx.from);
            await ctx.react('✅');
            await safeSend(ctx,
                `✅ *Invite link revoked and reset!*\n\n🔗 New link:\nhttps://chat.whatsapp.com/${newCode}\n\n_Old link is now invalid._\n\n_${config.BOT_NAME}_`
            );
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to revoke: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  WARNINGS
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'warn',
    desc: 'Warn a group member',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = resolveTarget(ctx);
        if (!target) return safeSend(ctx, '❌ Tag a user or reply to their message.\n\nExample: `.warn @user Bad behaviour`');
        const reason = ctx.text || 'No reason given';
        const count  = addWarning(target, ctx.from, reason);
        const limit  = 3;
        const text   =
            `⚠️ *Warning issued to @${target.split('@')[0]}*\n\n` +
            `📝 *Reason  :* ${reason}\n` +
            `🔢 *Warnings:* ${count}/${limit}\n\n` +
            (count >= limit
                ? `🚫 Limit reached! Kicking...`
                : `_${limit - count} warning(s) remaining._`);

        await ctx.sock.sendMessage(ctx.from, { text, mentions: [target], contextInfo: channelCtx() }, { quoted: ctx.m });

        if (count >= limit && ctx.isBotAdmin) {
            clearWarnings(target, ctx.from);
            await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'remove').catch(() => {});
            await safeSend(ctx, `🚫 *@${target.split('@')[0]}* has been kicked after ${limit} warnings.`);
        }
    },
});

addCmd({
    name: 'warnings',
    aliases: ['checkwarn'],
    desc: 'Check warnings for a user',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        const target = resolveTarget(ctx);
        if (!target) return safeSend(ctx, '❌ Tag a user or reply to their message.');
        const count = getWarnings(target, ctx.from);
        await ctx.sock.sendMessage(ctx.from,
            { text: `🔢 *@${target.split('@')[0]}* has *${count}/3* warnings.`, mentions: [target], contextInfo: channelCtx() },
            { quoted: ctx.m }
        );
    },
});

addCmd({
    name: 'clearwarn',
    aliases: ['resetwarn'],
    desc: 'Clear warnings for a user',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = resolveTarget(ctx);
        if (!target) return safeSend(ctx, '❌ Tag a user or reply to their message.');
        clearWarnings(target, ctx.from);
        await ctx.sock.sendMessage(ctx.from,
            { text: `✅ Warnings cleared for *@${target.split('@')[0]}*`, mentions: [target], contextInfo: channelCtx() },
            { quoted: ctx.m }
        );
    },
});

// ═══════════════════════════════════════════════════════════════════
//  GROUP SETTINGS TOGGLES
// ═══════════════════════════════════════════════════════════════════
const TOGGLES = {
    antilink:    { on: '🔗 Antilink *enabled*. Links will be deleted.', off: '🔗 Antilink *disabled*.' },
    antispam:    { on: '🚫 Antispam *enabled*. Spam will be removed.', off: '🚫 Antispam *disabled*.' },
    antibadword: { on: '🤬 Anti-badword *enabled*.', off: '🤬 Anti-badword *disabled*.' },
    welcome:     { on: '👋 Welcome messages *enabled*.', off: '👋 Welcome messages *disabled*.' },
    goodbye:     { on: '👋 Goodbye messages *enabled*.', off: '👋 Goodbye messages *disabled*.' },
    antidelete:  { on: '🗑️ Anti-delete *enabled*. Deleted messages will be logged.', off: '🗑️ Anti-delete *disabled*.' },
    antiforeign: { on: '🌍 Anti-foreign *enabled*. Only local numbers allowed.', off: '🌍 Anti-foreign *disabled*.' },
};

for (const [feature, msgs] of Object.entries(TOGGLES)) {
    addCmd({
        name: feature,
        desc: `Toggle ${feature} on/off`,
        category: 'group',
        groupOnly: true,
        adminOnly: true,
        handler: async (ctx) => {
            const arg     = ctx.args[0]?.toLowerCase();
            const current = getGroupSettings(ctx.from)[feature];
            const newVal  = arg === 'on' ? true : arg === 'off' ? false : !current;
            setGroupSetting(ctx.from, feature, newVal);
            await ctx.react(newVal ? '✅' : '🔇');
            await safeSend(ctx, newVal ? msgs.on : msgs.off);
        },
    });
}

// ═══════════════════════════════════════════════════════════════════
//  NOTES
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'save',
    aliases: ['savenote'],
    desc: 'Save a note in the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const name    = ctx.args[0];
        const content = ctx.args.slice(1).join(' ');
        if (!name || !content) return safeSend(ctx, '❌ Usage: `.save <name> <content>`\n\nExample: `.save rules Follow the group rules!`');
        saveNote(ctx.from, name.toLowerCase(), content);
        await ctx.react('✅');
        await safeSend(ctx, `✅ Note *${name}* saved.\n\nRetrieve with: \`.get ${name}\``);
    },
});

addCmd({
    name: 'get',
    aliases: ['getnote', '#'],
    desc: 'Get a saved note',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        const name = ctx.args[0];
        if (!name) return safeSend(ctx, '❌ Provide a note name.\n\nExample: `.get rules`');
        const note = getNote(ctx.from, name.toLowerCase());
        if (!note) return safeSend(ctx, `❌ No note named *${name}* found.\n\nUse \`.notes\` to see all saved notes.`);
        await safeSend(ctx, `📝 *${note.name}*\n\n${note.content}`);
    },
});

addCmd({
    name: 'notes',
    aliases: ['listnotes'],
    desc: 'List all saved notes',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        const notes = getAllNotes(ctx.from);
        if (!notes.length) return safeSend(ctx, '📭 No notes saved in this group.\n\nAdd one with: `.save <name> <content>`');
        const list = notes.map((n, i) => `${i + 1}. *${n.name}*`).join('\n');
        await safeSend(ctx, `📝 *Saved Notes* (${notes.length})\n\n${list}\n\n_Use .get <name> to retrieve_`);
    },
});

addCmd({
    name: 'delnote',
    aliases: ['removenote'],
    desc: 'Delete a saved note',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const name = ctx.args[0];
        if (!name) return safeSend(ctx, '❌ Provide a note name.');
        deleteNote(ctx.from, name.toLowerCase());
        await ctx.react('✅');
        await safeSend(ctx, `🗑️ Note *${name}* deleted.`);
    },
});

// ═══════════════════════════════════════════════════════════════════
//  SET GROUP NAME
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'setname',
    aliases: ['groupname', 'rename'],
    desc: 'Change the group name',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin) return safeSend(ctx, '❌ I need to be an *admin* to change the group name.');
        const name = ctx.text?.trim();
        if (!name) return safeSend(ctx, '❌ Provide a new group name.\n\nExample: `.setname My Awesome Group`');
        await ctx.react('⏳');
        try {
            await ctx.sock.groupUpdateSubject(ctx.from, name);
            await ctx.react('✅');
            await safeSend(ctx, `✅ Group name changed to *${name}*`);
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to change name: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  SET GROUP DESCRIPTION
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'setdesc',
    aliases: ['setdescription', 'groupdesc'],
    desc: 'Change the group description',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin) return safeSend(ctx, '❌ I need to be an *admin* to change the description.');
        const desc = ctx.text?.trim();
        if (!desc) return safeSend(ctx, '❌ Provide a description.\n\nExample: `.setdesc Welcome to our group!`');
        await ctx.react('⏳');
        try {
            await ctx.sock.groupUpdateDescription(ctx.from, desc);
            await ctx.react('✅');
            await safeSend(ctx, `✅ Group description updated!`);
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to update description: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  APPROVE JOIN REQUESTS
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'approve',
    aliases: ['approveall', 'acceptall'],
    desc: 'Approve all pending group join requests',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin && !ctx.isOwner) return safeSend(ctx, '❌ I need to be a group *admin* to approve join requests.\n\n👉 Please promote me to group admin first.');
        await ctx.react('⏳');
        try {
            const meta    = await ctx.sock.groupMetadata(ctx.from);
            const pending = (meta?.participants || []).filter(p => p.pending === true || p.request_method != null);
            if (!pending.length) return safeSend(ctx, '📭 No pending join requests found.');
            const jids = pending.map(p => p.id);
            await ctx.sock.groupRequestParticipantsUpdate(ctx.from, jids, 'approve');
            await ctx.react('✅');
            await ctx.sock.sendMessage(ctx.from, {
                text:
                    `✅ *Approved ${jids.length} join request${jids.length !== 1 ? 's' : ''}*\n\n` +
                    jids.map((j, i) => `${i + 1}. @${j.split('@')[0]}`).join('\n') +
                    `\n\n_${config.BOT_NAME}_`,
                mentions: jids,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to approve requests: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  KICK INACTIVE (members who haven't sent messages recently)
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'inactive',
    aliases: ['kickinactive'],
    desc: 'List or kick inactive members (no messages in 30 days)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        await ctx.react('⏳');
        await safeSend(ctx,
            `ℹ️ *Inactive Member Cleanup*\n\n` +
            `This feature requires message tracking to be enabled.\n` +
            `For now, use \`.members\` to view all members, then use \`.kick @user\` to remove inactive ones.\n\n` +
            `_${config.BOT_NAME}_`
        );
        await ctx.react('✅');
    },
});

// ═══════════════════════════════════════════════════════════════════
//  CREATE GROUP
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'creategroup',
    aliases: ['newgroup', 'gcreate'],
    desc: 'Create a new WhatsApp group',
    category: 'group',
    ownerOnly: true,
    handler: async (ctx) => {
        const name = ctx.text?.trim();
        if (!name) return safeSend(ctx, `❌ Provide a group name.\n\nExample: \`${config.BOT_PREFIX}creategroup My New Group\``);
        await ctx.react('⏳');
        try {
            const ownerJid = config.OWNER_NUMBER + '@s.whatsapp.net';
            const result   = await ctx.sock.groupCreate(name, [ownerJid]);
            const newJid   = result?.id || result?.gid || 'unknown';
            await ctx.react('✅');
            await safeSend(ctx,
                `✅ *Group Created Successfully!*\n\n` +
                `📛 *Name :* ${name}\n` +
                `🆔 *JID  :* ${newJid}\n\n` +
                `_${config.BOT_NAME}_`
            );
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to create group: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  LEAVE GROUP
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'leavegroup',
    aliases: ['leave', 'gdelete'],
    desc: 'Make the bot leave the current group',
    category: 'group',
    groupOnly: true,
    ownerOnly: true,
    handler: async (ctx) => {
        try {
            await ctx.sock.sendMessage(ctx.from, {
                text: `⚠️ *Goodbye!*\n\nI'm leaving this group now.\nContact *${config.OWNER_NAME}* to re-add me.\n\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            });
            await ctx.sock.groupLeave(ctx.from);
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to leave: ${e.message}`);
        }
    },
});

// ═══════════════════════════════════════════════════════════════════
//  WELCOME CONFIG
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'setwelcome',
    aliases: ['welcomemsg', 'customwelcome'],
    desc: 'Set a custom welcome message\n  • Use {name} for member name\n  • Use {group} for group name',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const msg = ctx.text?.trim();
        if (!msg) return safeSend(ctx,
            `❌ Provide a message template.\n\n` +
            `*Variables:*\n` +
            `• \`{name}\` — new member's name\n` +
            `• \`{group}\` — group name\n\n` +
            `*Example:*\n` +
            `\`.setwelcome Hey {name}, welcome to {group}! 🎉\``
        );
        setGroupSetting(ctx.from, 'welcomeMsg', msg);
        await ctx.react('✅');
        await safeSend(ctx,
            `✅ *Custom welcome message saved!*\n\n` +
            `📝 Preview:\n_${msg.replace('{name}', 'NewMember').replace('{group}', ctx.groupMeta?.subject || 'this group')}_\n\n` +
            `_${config.BOT_NAME}_`
        );
    },
});

// ═══════════════════════════════════════════════════════════════════
//  STATUS POST
// ═══════════════════════════════════════════════════════════════════
addCmd({
    name: 'statuspost',
    aliases: ['poststatus'],
    desc: 'Post a text message as a WhatsApp status',
    category: 'group',
    ownerOnly: true,
    handler: async (ctx) => {
        const text = ctx.text?.trim();
        if (!text) return safeSend(ctx, `❌ Provide a status message.\n\nExample: \`${config.BOT_PREFIX}statuspost Good morning! 🌅\``);
        await ctx.react('⏳');
        try {
            await ctx.sock.sendMessage('status@broadcast', { text: `${text}\n\n_— ${config.BOT_NAME}_` });
            await ctx.react('✅');
            await safeSend(ctx, `✅ *Status Posted!*\n\n📝 _${text}_\n\n_${config.BOT_NAME}_`);
        } catch (e) {
            await ctx.react('❌');
            await safeSend(ctx, `❌ Failed to post status: ${e.message}`);
        }
    },
});
