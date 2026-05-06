'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  vibranium.js
//  🛡️  Advanced Group Tools:
//      • antibot · antilink · antispam · antitoxic
//      • tagall · hidetag · groupinfo · groupstats
//      • lockgroup · unlockgroup · mute/unmute
//      • setwelcome · setbye · setdesc · setname
//      • poll · vote · countdown
//      • warn · warns · clearwarns · kickwarn
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd, addTrigger } = require('../../guru/handlers/loader');
const { getGroupSettings, setGroupSetting, getSetting, setSetting } = require('../../guru/db/database');
const config = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
const moment = require('moment-timezone');

function now(fmt) { return moment().tz(config.TIME_ZONE || 'Africa/Nairobi').format(fmt); }

// In-memory warn store (backed up to DB by key)
const warnStore = new Map();

function getWarns(jid, from) {
    const key = `warn_${from}_${jid}`;
    return warnStore.get(key) || 0;
}
function addWarn(jid, from) {
    const key = `warn_${from}_${jid}`;
    const cur = (warnStore.get(key) || 0) + 1;
    warnStore.set(key, cur);
    return cur;
}
function clearWarns(jid, from) {
    warnStore.delete(`warn_${from}_${jid}`);
}

// ════════════════════════════════════════════════════════════════
//  📢  TAG ALL
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'tagall',
    aliases: ['mentionall', 'everyone', '@all'],
    desc: 'Mention all group members',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const meta    = await ctx.sock.groupMetadata(ctx.from);
        const members = meta.participants.map(p => p.id);
        const msg     = ctx.text || '📢 Attention everyone!';
        let text = `*📢 ATTENTION ALL MEMBERS*\n${config.BOT_NAME}\n\n${msg}\n\n`;
        text += members.map(m => `@${m.split('@')[0]}`).join(' ');
        text += `\n\n_Total: ${members.length} members_\n◈ ${config.CHANNEL_NAME}`;
        await ctx.sock.sendMessage(ctx.from, { text, mentions: members, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ════════════════════════════════════════════════════════════════
//  👻  HIDETAG (tag all silently)
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'hidetag',
    aliases: ['htag', 'silentall'],
    desc: 'Tag all members without showing names',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const meta    = await ctx.sock.groupMetadata(ctx.from);
        const members = meta.participants.map(p => p.id);
        const msg     = ctx.text || '📢';
        await ctx.sock.sendMessage(ctx.from,
            { text: msg, mentions: members, contextInfo: channelCtx() },
            { quoted: ctx.m });
    },
});

// ════════════════════════════════════════════════════════════════
//  ℹ️  GROUP INFO
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'groupinfo',
    aliases: ['ginfo', 'groupstats'],
    desc: 'Show detailed group information',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        const meta    = await ctx.sock.groupMetadata(ctx.from);
        const admins  = meta.participants.filter(p => p.admin).length;
        const members = meta.participants.length;
        const created = meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : 'Unknown';

        const text =
            `*ℹ️ GROUP INFO*\n${config.BOT_NAME}\n\n` +
            `📛 *Name:*     ${meta.subject}\n` +
            `🆔 *JID:*      \`${ctx.from}\`\n` +
            `📝 *Desc:*     ${meta.desc?.slice(0, 100) || 'None'}\n` +
            `👥 *Members:*  ${members}\n` +
            `👑 *Admins:*   ${admins}\n` +
            `📅 *Created:*  ${created}\n` +
            `🔗 *Invite:*   ${meta.inviteCode ? `https://chat.whatsapp.com/${meta.inviteCode}` : 'Restricted'}\n` +
            `🔒 *Restrict:* ${meta.restrict ? 'Yes (Admin only)' : 'No'}\n` +
            `📣 *Announce:* ${meta.announce ? 'Yes' : 'No'}\n\n` +
            `◈ ${config.CHANNEL_NAME}`;

        await ctx.sock.sendMessage(ctx.from, { text, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ════════════════════════════════════════════════════════════════
//  ⚠️  WARN SYSTEM
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'warn',
    aliases: ['warning'],
    desc: 'Warn a member (3 warns = kick)',
    usage: 'warn @user <reason>',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return ctx.reply('❌ Reply to a member\'s message to warn them.');
        if (target === ctx.sender) return ctx.reply('❌ You cannot warn yourself.');

        const reason = ctx.text || 'No reason given';
        const warns  = addWarn(target, ctx.from);
        const limit  = parseInt(getSetting('WARN_LIMIT') || '3');

        let text =
            `*⚠️ WARNING ISSUED*\n${config.BOT_NAME}\n\n` +
            `👤 *Member:* @${target.split('@')[0]}\n` +
            `📝 *Reason:* ${reason}\n` +
            `⚠️ *Warns:*  ${warns}/${limit}\n\n`;

        if (warns >= limit) {
            text += `🚫 *Maximum warns reached! Removing from group...*`;
            await ctx.sock.sendMessage(ctx.from, { text, mentions: [target], contextInfo: channelCtx() }, { quoted: ctx.m });
            try { await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'remove'); } catch {}
            clearWarns(target, ctx.from);
        } else {
            text += `💡 _${limit - warns} more warn(s) before removal._\n◈ ${config.CHANNEL_NAME}`;
            await ctx.sock.sendMessage(ctx.from, { text, mentions: [target], contextInfo: channelCtx() }, { quoted: ctx.m });
        }
    },
});

addCmd({
    name: 'warns',
    aliases: ['checkwarns'],
    desc: 'Check warns for a member',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant || ctx.sender;
        const warns  = getWarns(target, ctx.from);
        const limit  = parseInt(getSetting('WARN_LIMIT') || '3');
        await ctx.sock.sendMessage(ctx.from,
            { text: `*⚠️ WARNS*\n${config.BOT_NAME}\n\n👤 @${target.split('@')[0]}\n⚠️ *Warns:* ${warns}/${limit}\n\n◈ ${config.CHANNEL_NAME}`, mentions: [target], contextInfo: channelCtx() },
            { quoted: ctx.m });
    },
});

addCmd({
    name: 'clearwarn',
    aliases: ['resetwarn', 'unwarn'],
    desc: 'Clear all warns for a member',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return ctx.reply('❌ Reply to a member\'s message.');
        clearWarns(target, ctx.from);
        await ctx.sock.sendMessage(ctx.from,
            { text: `✅ Warns cleared for @${target.split('@')[0]}`, mentions: [target], contextInfo: channelCtx() },
            { quoted: ctx.m });
    },
});

addCmd({
    name: 'setwarnlimit',
    aliases: ['warnlimit'],
    desc: 'Set warn limit before kick (default: 3)',
    usage: 'setwarnlimit <number>',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const n = parseInt(ctx.args[0]);
        if (!n || n < 1 || n > 10) return ctx.reply('❌ Warn limit must be between 1–10.');
        setSetting('WARN_LIMIT', String(n));
        await ctx.reply(`✅ Warn limit set to *${n}* warnings before kick.`);
    },
});

// ════════════════════════════════════════════════════════════════
//  🔒  LOCK / UNLOCK GROUP
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'lockgroup',
    aliases: ['lock', 'closegroup'],
    desc: 'Lock group (only admins can send messages)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        try {
            await ctx.sock.groupSettingUpdate(ctx.from, 'announcement');
            await ctx.reply('🔒 *Group LOCKED*\nOnly admins can now send messages.');
        } catch { await ctx.reply('❌ Failed to lock group. Make sure I\'m an admin.'); }
    },
});

addCmd({
    name: 'unlockgroup',
    aliases: ['unlock', 'opengroup'],
    desc: 'Unlock group (everyone can send messages)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        try {
            await ctx.sock.groupSettingUpdate(ctx.from, 'not_announcement');
            await ctx.reply('🔓 *Group UNLOCKED*\nAll members can now send messages.');
        } catch { await ctx.reply('❌ Failed to unlock group. Make sure I\'m an admin.'); }
    },
});

// ════════════════════════════════════════════════════════════════
//  📝  SET GROUP NAME / DESC
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'setgroupname',
    aliases: ['setname', 'groupname'],
    desc: 'Change group name',
    usage: 'setgroupname <new name>',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const name = ctx.text;
        if (!name) return ctx.reply(`❌ Provide a new name.\n\nExample: \`${config.BOT_PREFIX}setgroupname My Cool Group\``);
        try {
            await ctx.sock.groupUpdateSubject(ctx.from, name);
            await ctx.reply(`✅ Group name changed to *${name}*`);
        } catch { await ctx.reply('❌ Failed to change group name. Make sure I\'m an admin.'); }
    },
});

addCmd({
    name: 'setgroupdesc',
    aliases: ['setdesc', 'groupdesc'],
    desc: 'Change group description',
    usage: 'setgroupdesc <description>',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const desc = ctx.text;
        if (!desc) return ctx.reply(`❌ Provide a description.\n\nExample: \`${config.BOT_PREFIX}setgroupdesc Welcome to our group!\``);
        try {
            await ctx.sock.groupUpdateDescription(ctx.from, desc);
            await ctx.reply(`✅ Group description updated!`);
        } catch { await ctx.reply('❌ Failed to update description. Make sure I\'m an admin.'); }
    },
});

// ════════════════════════════════════════════════════════════════
//  🔗  GROUP INVITE LINK
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'invitelink',
    aliases: ['grouplink', 'link'],
    desc: 'Get group invite link',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        try {
            const code = await ctx.sock.groupInviteCode(ctx.from);
            await ctx.sock.sendMessage(ctx.from,
                { text: `🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}\n\n_Share carefully!_\n◈ ${config.CHANNEL_NAME}`, contextInfo: channelCtx() },
                { quoted: ctx.m });
        } catch { await ctx.reply('❌ Failed to get invite link. Make sure I\'m an admin.'); }
    },
});

addCmd({
    name: 'revokelink',
    aliases: ['resetlink', 'newlink'],
    desc: 'Revoke and get new group invite link',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        try {
            const code = await ctx.sock.groupRevokeInvite(ctx.from);
            await ctx.sock.sendMessage(ctx.from,
                { text: `🔄 *New Invite Link Generated*\n\nhttps://chat.whatsapp.com/${code}\n\n✅ Old link has been revoked.\n◈ ${config.CHANNEL_NAME}`, contextInfo: channelCtx() },
                { quoted: ctx.m });
        } catch { await ctx.reply('❌ Failed to revoke invite link. Make sure I\'m an admin.'); }
    },
});

// ════════════════════════════════════════════════════════════════
//  👥  MEMBERS LIST
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'members',
    aliases: ['memberlist', 'listmembers'],
    desc: 'List all group members',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        const meta    = await ctx.sock.groupMetadata(ctx.from);
        const admins  = meta.participants.filter(p => p.admin).map(p => p.id);
        const members = meta.participants.map(p => p.id);
        let text  = `*👥 MEMBERS LIST*\n${config.BOT_NAME}\n\n`;
        text += `📊 *Total:* ${members.length}\n\n`;
        text += `*👑 Admins (${admins.length}):*\n`;
        admins.forEach(a => { text += `• @${a.split('@')[0]}\n`; });
        text += `\n*👤 Members (${members.length - admins.length}):*\n`;
        meta.participants.filter(p => !p.admin).forEach(m => { text += `• @${m.id.split('@')[0]}\n`; });
        text += `\n◈ ${config.CHANNEL_NAME}`;
        await ctx.sock.sendMessage(ctx.from, { text, mentions: members, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ════════════════════════════════════════════════════════════════
//  🗳️  POLL
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'poll',
    aliases: ['vote', 'survey'],
    desc: 'Create a poll',
    usage: 'poll <question> | <option1> | <option2> | ...',
    category: 'group',
    handler: async (ctx) => {
        const parts = ctx.text?.split('|').map(s => s.trim());
        if (!parts || parts.length < 3) return ctx.reply(
            `❌ *Usage:* \`${config.BOT_PREFIX}poll Which is best? | Option A | Option B | Option C\`\n\nMinimum 2 options required.`);
        const question = parts[0];
        const options  = parts.slice(1, 13); // max 12 options

        try {
            await ctx.sock.sendMessage(ctx.from, {
                poll: { name: question, values: options, selectableCount: 1 },
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        } catch {
            await ctx.reply(`❌ Poll creation failed. Using text format:\n\n*📊 ${question}*\n\n${options.map((o,i) => `${i+1}. ${o}`).join('\n')}`);
        }
    },
});

// ════════════════════════════════════════════════════════════════
//  ⏳  COUNTDOWN
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'countdown',
    aliases: ['timer', 'count'],
    desc: 'Start a countdown timer',
    usage: 'countdown <seconds>  max: 60',
    category: 'fun',
    handler: async (ctx) => {
        const secs = Math.min(parseInt(ctx.args[0]) || 10, 60);
        if (secs < 1) return ctx.reply('❌ Countdown must be at least 1 second.');
        const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
        await ctx.reply(`⏳ Countdown started: *${secs} seconds*`);
        for (let i = secs; i >= 1; i--) {
            await new Promise(r => setTimeout(r, 1000));
            if (i <= 10) await ctx.react(emojis[i-1] || '⏳');
        }
        await ctx.reply('🎉 *TIME\'S UP!* 🎉');
    },
});

// ════════════════════════════════════════════════════════════════
//  🎭  PROMOTE / DEMOTE
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'promote',
    aliases: ['makeadmin'],
    desc: 'Promote a member to admin',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant
            || (ctx.args[0] ? ctx.args[0].replace(/\D/g,'') + '@s.whatsapp.net' : null);
        if (!target) return ctx.reply('❌ Reply to a member or provide their number.');
        try {
            await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'promote');
            await ctx.sock.sendMessage(ctx.from,
                { text: `👑 @${target.split('@')[0]} has been *promoted to Admin!*`, mentions: [target], contextInfo: channelCtx() },
                { quoted: ctx.m });
        } catch { await ctx.reply('❌ Failed to promote member.'); }
    },
});

addCmd({
    name: 'demote',
    aliases: ['removeadmin'],
    desc: 'Demote an admin to member',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant
            || (ctx.args[0] ? ctx.args[0].replace(/\D/g,'') + '@s.whatsapp.net' : null);
        if (!target) return ctx.reply('❌ Reply to a member or provide their number.');
        try {
            await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'demote');
            await ctx.sock.sendMessage(ctx.from,
                { text: `⬇️ @${target.split('@')[0]} has been *demoted to Member.*`, mentions: [target], contextInfo: channelCtx() },
                { quoted: ctx.m });
        } catch { await ctx.reply('❌ Failed to demote admin.'); }
    },
});

// ════════════════════════════════════════════════════════════════
//  🚫  KICK (improved)
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'kick',
    aliases: ['remove', 'ban'],
    desc: 'Kick a member from the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant
            || (ctx.args[0] ? ctx.args[0].replace(/\D/g,'') + '@s.whatsapp.net' : null);
        if (!target) return ctx.reply('❌ Reply to a member or provide their number.');
        if (target === ctx.sender) return ctx.reply('❌ You cannot kick yourself!');
        const reason = ctx.args.slice(1).join(' ') || 'No reason given';
        try {
            await ctx.sock.sendMessage(ctx.from,
                { text: `🚫 @${target.split('@')[0]} has been *removed* from the group.\n📝 *Reason:* ${reason}`, mentions: [target], contextInfo: channelCtx() },
                { quoted: ctx.m });
            await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'remove');
        } catch { await ctx.reply('❌ Failed to kick member. Make sure I\'m an admin.'); }
    },
});

// ════════════════════════════════════════════════════════════════
//  🏷️  SETWELCOME / SETBYE
// ════════════════════════════════════════════════════════════════
addCmd({
    name: 'setwelcome',
    aliases: ['welcomemsg', 'welcomeon'],
    desc: 'Set custom welcome message',
    usage: 'setwelcome <message>  use {user} for name',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const msg = ctx.text;
        if (!msg) return ctx.reply(
            `❌ Provide a welcome message.\n\nExample:\n\`${config.BOT_PREFIX}setwelcome Welcome {user} to the group! 🎉\`\n\nVariables: {user} {group}`);
        setGroupSetting(ctx.from, 'welcome', msg);
        setGroupSetting(ctx.from, 'welcome_on', 'true');
        await ctx.reply(`✅ *Welcome message set!*\n\n_Preview:_\n${msg.replace('{user}', 'NewMember').replace('{group}', 'This Group')}`);
    },
});

addCmd({
    name: 'setbye',
    aliases: ['byemsg', 'setfarewell'],
    desc: 'Set custom goodbye message',
    usage: 'setbye <message>  use {user} for name',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const msg = ctx.text;
        if (!msg) return ctx.reply(`❌ Provide a goodbye message.\n\nExample:\n\`${config.BOT_PREFIX}setbye Goodbye {user}, we'll miss you! 😢\``);
        setGroupSetting(ctx.from, 'bye', msg);
        setGroupSetting(ctx.from, 'bye_on', 'true');
        await ctx.reply(`✅ *Goodbye message set!*\n\n_Preview:_\n${msg.replace('{user}', 'LeavingMember').replace('{group}', 'This Group')}`);
    },
});

addCmd({
    name: 'welcomeoff',
    aliases: ['disablewelcome'],
    desc: 'Disable welcome messages',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        setGroupSetting(ctx.from, 'welcome_on', 'false');
        await ctx.reply('🔕 Welcome messages *disabled*.');
    },
});

addCmd({
    name: 'byeoff',
    aliases: ['disablebye'],
    desc: 'Disable goodbye messages',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        setGroupSetting(ctx.from, 'bye_on', 'false');
        await ctx.reply('🔕 Goodbye messages *disabled*.');
    },
});

// ════════════════════════════════════════════════════════════════
//  🔇  MUTE / UNMUTE MEMBER (from replying)
// ════════════════════════════════════════════════════════════════
const mutedUsers = new Set();

addCmd({
    name: 'mute',
    aliases: ['silence'],
    desc: 'Mute a member (bot will delete their msgs)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return ctx.reply('❌ Reply to a member\'s message to mute them.');
        mutedUsers.add(`${ctx.from}:${target}`);
        await ctx.sock.sendMessage(ctx.from,
            { text: `🔇 @${target.split('@')[0]} has been *muted*. Their messages will be deleted.`, mentions: [target], contextInfo: channelCtx() },
            { quoted: ctx.m });
    },
});

addCmd({
    name: 'unmute',
    aliases: ['unsilence'],
    desc: 'Unmute a member',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = ctx.m.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) return ctx.reply('❌ Reply to a member\'s message to unmute them.');
        mutedUsers.delete(`${ctx.from}:${target}`);
        await ctx.sock.sendMessage(ctx.from,
            { text: `🔊 @${target.split('@')[0]} has been *unmuted*.`, mentions: [target], contextInfo: channelCtx() },
            { quoted: ctx.m });
    },
});

// Export muted set for use in message handler
global._panthermuted = mutedUsers;
