'use strict';
const { addCmd }                = require('../../guru/handlers/loader');
const { getGroupSettings, setGroupSetting, addWarning, getWarnings, clearWarnings, saveNote, getNote, getAllNotes, deleteNote } = require('../../guru/db/database');
const { cleanJid, numberToJid } = require('../../guru/utils/helpers');
const config                    = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');

// ── Helper: resolve mention/reply to a JID ───────────────────
function resolveTarget(ctx) {
    if (ctx.m.message?.extendedTextMessage?.contextInfo?.participant)
        return cleanJid(ctx.m.message.extendedTextMessage.contextInfo.participant);
    if (ctx.args[0]) return numberToJid(ctx.args[0]);
    return null;
}

// ── Kick ─────────────────────────────────────────────────────
addCmd({
    name: 'kick',
    aliases: ['remove'],
    desc: 'Kick a member from the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin) return ctx.sock.sendMessage(ctx.from, { text: '❌ I need to be an *admin* to kick members.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const target = resolveTarget(ctx);
        if (!target) return ctx.sock.sendMessage(ctx.from, { text: '❌ Tag a user or provide their number.', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'remove');
        await ctx.reply(`✅ *@${target.split('@')[0]}* has been kicked.`, { mentions: [target] });
    },
});

// ── Add member ────────────────────────────────────────────────
addCmd({
    name: 'add',
    desc: 'Add a member to the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin) return ctx.sock.sendMessage(ctx.from, { text: '❌ I need to be an *admin* to add members.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const number = ctx.args[0];
        if (!number) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a number.\n\nExample: `.add 254712345678`', contextInfo: channelCtx() }, { quoted: ctx.m });
        const jid = numberToJid(number);
        const res = await ctx.sock.groupParticipantsUpdate(ctx.from, [jid], 'add').catch(() => null);
        if (!res) return ctx.sock.sendMessage(ctx.from, { text: '❌ Failed to add user. They may have privacy settings enabled.', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.reply(`✅ *@${jid.split('@')[0]}* has been added.`, { mentions: [jid] });
    },
});

// ── Promote / Demote ──────────────────────────────────────────
addCmd({
    name: 'promote',
    desc: 'Promote a member to admin',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin) return ctx.sock.sendMessage(ctx.from, { text: '❌ I need to be an *admin* to promote members.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const target = resolveTarget(ctx);
        if (!target) return ctx.sock.sendMessage(ctx.from, { text: '❌ Tag a user or provide their number.', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'promote');
        await ctx.reply(`🎉 *@${target.split('@')[0]}* has been promoted to admin!`, { mentions: [target] });
    },
});

addCmd({
    name: 'demote',
    desc: 'Demote an admin to member',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin) return ctx.sock.sendMessage(ctx.from, { text: '❌ I need to be an *admin* to demote members.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const target = resolveTarget(ctx);
        if (!target) return ctx.sock.sendMessage(ctx.from, { text: '❌ Tag a user or provide their number.', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'demote');
        await ctx.reply(`ℹ️ *@${target.split('@')[0]}* has been demoted.`, { mentions: [target] });
    },
});

// ── Mute / Unmute group ───────────────────────────────────────
addCmd({
    name: 'mute',
    desc: 'Mute the group (only admins can send messages)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin) return ctx.sock.sendMessage(ctx.from, { text: '❌ I need to be an *admin* to mute the group.', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.sock.groupSettingUpdate(ctx.from, 'announcement');
        setGroupSetting(ctx.from, 'mute', true);
        await ctx.sock.sendMessage(ctx.from, { text: '🔇 Group has been *muted*. Only admins can send messages.', contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

addCmd({
    name: 'unmute',
    desc: 'Unmute the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin) return ctx.sock.sendMessage(ctx.from, { text: '❌ I need to be an *admin* to unmute the group.', contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.sock.groupSettingUpdate(ctx.from, 'not_announcement');
        setGroupSetting(ctx.from, 'mute', false);
        await ctx.sock.sendMessage(ctx.from, { text: '🔊 Group has been *unmuted*. Everyone can send messages.', contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── Group info ────────────────────────────────────────────────
addCmd({
    name: 'groupinfo',
    aliases: ['ginfo', 'gc'],
    desc: 'Show group information',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        const meta   = ctx.groupMeta;
        const admins = ctx.admins.map(a => `@${a.split('@')[0]}`).join(', ');
        const text   =
            `👥 *Group Info*\n\n` +
            `📛 *Name    :* ${meta.subject}\n` +
            `🆔 *JID     :* ${ctx.from}\n` +
            `👤 *Members :* ${ctx.participants.length}\n` +
            `👑 *Admins  :* ${ctx.admins.length}\n` +
            `📝 *Desc    :* ${meta.desc || 'None'}\n` +
            `📅 *Created :* ${new Date(meta.creation * 1000).toLocaleDateString()}\n\n` +
            `_${config.BOT_NAME}_`;
        await ctx.reply(text);
    },
});

// ── Tag all ───────────────────────────────────────────────────
addCmd({
    name: 'tagall',
    aliases: ['everyone', 'all'],
    desc: 'Mention all group members',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const mentions = ctx.participants.map(p => p.id);
        const tags     = mentions.map(j => `@${j.split('@')[0]}`).join(' ');
        const msg      = ctx.text ? `📣 *${ctx.text}*\n\n${tags}` : `📣 *Attention everyone!*\n\n${tags}`;
        await ctx.send({ text: msg, mentions });
    },
});

// ── Warnings ──────────────────────────────────────────────────
addCmd({
    name: 'warn',
    desc: 'Warn a group member',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const target = resolveTarget(ctx);
        if (!target) return ctx.sock.sendMessage(ctx.from, { text: '❌ Tag a user or provide their number.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const reason  = ctx.text || 'No reason given';
        const count   = addWarning(target, ctx.from, reason);
        const limit   = 3;
        const text    =
            `⚠️ *Warning issued to @${target.split('@')[0]}*\n\n` +
            `📝 *Reason  :* ${reason}\n` +
            `🔢 *Warnings:* ${count}/${limit}\n\n` +
            (count >= limit
                ? `🚫 Limit reached! Taking action...`
                : `_${limit - count} warning(s) remaining._`);

        await ctx.send({ text, mentions: [target] });

        if (count >= limit && ctx.isBotAdmin) {
            clearWarnings(target, ctx.from);
            await ctx.sock.groupParticipantsUpdate(ctx.from, [target], 'remove');
            await ctx.reply(`🚫 *@${target.split('@')[0]}* has been kicked after ${limit} warnings.`, { mentions: [target] });
        }
    },
});

addCmd({
    name: 'warnings',
    desc: 'Check warnings for a user',
    category: 'group',
    groupOnly: true,
    handler: async (ctx) => {
        const target = resolveTarget(ctx);
        if (!target) return ctx.sock.sendMessage(ctx.from, { text: '❌ Tag a user or provide their number.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const count = getWarnings(target, ctx.from);
        await ctx.send({
            text: `🔢 *@${target.split('@')[0]}* has *${count}/3* warnings.`,
            mentions: [target],
        });
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
        if (!target) return ctx.sock.sendMessage(ctx.from, { text: '❌ Tag a user or provide their number.', contextInfo: channelCtx() }, { quoted: ctx.m });
        clearWarnings(target, ctx.from);
        await ctx.send({ text: `✅ Warnings cleared for *@${target.split('@')[0]}*`, mentions: [target] });
    },
});

// ── Group settings toggles ─────────────────────────────────────
const TOGGLES = {
    antilink:    { on: '🔗 Antilink *enabled*.', off: '🔗 Antilink *disabled*.' },
    antispam:    { on: '🚫 Antispam *enabled*.', off: '🚫 Antispam *disabled*.' },
    antibadword: { on: '🤬 Anti-badword *enabled*.', off: '🤬 Anti-badword *disabled*.' },
    welcome:     { on: '👋 Welcome messages *enabled*.', off: '👋 Welcome messages *disabled*.' },
    goodbye:     { on: '👋 Goodbye messages *enabled*.', off: '👋 Goodbye messages *disabled*.' },
    antidelete:  { on: '🗑️ Anti-delete *enabled*.', off: '🗑️ Anti-delete *disabled*.' },
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
            await ctx.reply(newVal ? msgs.on : msgs.off);
        },
    });
}

// ── Notes ─────────────────────────────────────────────────────
addCmd({
    name: 'save',
    aliases: ['savenote'],
    desc: 'Save a note in the group',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const name = ctx.args[0];
        const content = ctx.args.slice(1).join(' ');
        if (!name || !content) return ctx.sock.sendMessage(ctx.from, { text: '❌ Usage: `.save <name> <content>`', contextInfo: channelCtx() }, { quoted: ctx.m });
        saveNote(ctx.from, name.toLowerCase(), content);
        await ctx.sock.sendMessage(ctx.from, { text: `✅ Note *${name}* saved.`, contextInfo: channelCtx() }, { quoted: ctx.m });
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
        if (!name) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a note name. Example: `.get rules`', contextInfo: channelCtx() }, { quoted: ctx.m });
        const note = getNote(ctx.from, name.toLowerCase());
        if (!note) return ctx.sock.sendMessage(ctx.from, { text: `❌ No note named *${name}* found.`, contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.sock.sendMessage(ctx.from, { text: `📝 *${note.name}*\n\n${note.content}`, contextInfo: channelCtx() }, { quoted: ctx.m });
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
        if (!notes.length) return ctx.sock.sendMessage(ctx.from, { text: '📭 No notes saved in this group.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const list  = notes.map((n, i) => `${i + 1}. *${n.name}*`).join('\n');
        await ctx.sock.sendMessage(ctx.from, { text: `📝 *Saved Notes*\n\n${list}\n\n_Use .get <name> to retrieve_`, contextInfo: channelCtx() }, { quoted: ctx.m });
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
        if (!name) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a note name.', contextInfo: channelCtx() }, { quoted: ctx.m });
        deleteNote(ctx.from, name.toLowerCase());
        await ctx.sock.sendMessage(ctx.from, { text: `🗑️ Note *${name}* deleted.`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── Approve join requests ─────────────────────────────────────
addCmd({
    name: 'approve',
    aliases: ['approveall', 'acceptall'],
    desc: 'Approve all pending group join requests',
    usage: 'approve all',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        if (!ctx.isBotAdmin)
            return ctx.sock.sendMessage(ctx.from, { text: '❌ I need to be an *admin* to approve join requests.', contextInfo: channelCtx() }, { quoted: ctx.m });

        await ctx.react('⏳');

        try {
            const meta = await ctx.sock.groupMetadata(ctx.from);
            const pending = (meta?.participants || []).filter(p => p.pending === true || p.request_method != null);

            if (!pending.length)
                return ctx.sock.sendMessage(ctx.from, { text: '📭 No pending join requests found.', contextInfo: channelCtx() }, { quoted: ctx.m });

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
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, {
                text: `❌ Failed to approve requests: ${err.message}`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }
    },
});

// ── Create Group ──────────────────────────────────────────────
addCmd({
    name: 'creategroup',
    aliases: ['newgroup', 'gcreate'],
    desc: 'Create a new WhatsApp group',
    usage: 'creategroup <group name>',
    category: 'group',
    handler: async (ctx) => {
        const name = ctx.text?.trim();
        if (!name)
            return ctx.sock.sendMessage(ctx.from, {
                text: `❌ Provide a group name.\n\nExample: \`${config.BOT_PREFIX}creategroup My New Group\``,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });

        await ctx.react('⏳');
        try {
            // Create group with just the bot owner as initial participant
            const ownerJid = config.OWNER_NUMBER + '@s.whatsapp.net';
            const result   = await ctx.sock.groupCreate(name, [ownerJid]);
            const newJid   = result?.id || result?.gid || 'unknown';

            await ctx.react('✅');
            await ctx.sock.sendMessage(ctx.from, {
                text:
                    `✅ *Group Created Successfully!*\n\n` +
                    `📛 *Name :* ${name}\n` +
                    `🆔 *JID  :* ${newJid}\n\n` +
                    `_Invite link available via .invitelink in the new group._\n\n` +
                    `_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, {
                text: `❌ Failed to create group: ${err.message}`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }
    },
});

// ── Delete / Leave Group ──────────────────────────────────────
addCmd({
    name: 'deletegroup',
    aliases: ['delgroup', 'leavegroup', 'gdelete'],
    desc: 'Make the bot leave (and optionally delete) the current group',
    usage: 'deletegroup',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        await ctx.react('⏳');
        try {
            // Notify the group before leaving
            await ctx.sock.sendMessage(ctx.from, {
                text:
                    `⚠️ *Goodbye!*\n\n` +
                    `I'm leaving this group now.\n` +
                    `Contact *${config.OWNER_NAME}* to re-add me.\n\n` +
                    `_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            });

            // Leave the group
            await ctx.sock.groupLeave(ctx.from);
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, {
                text: `❌ Failed to leave group: ${err.message}`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }
    },
});

// ── Post to Group Status / Broadcast ─────────────────────────
addCmd({
    name: 'statuspost',
    aliases: ['poststatus', 'broadcaststatus', 'gstatus'],
    desc: 'Post a text message as a WhatsApp status update',
    usage: 'statuspost <your status message>',
    category: 'group',
    ownerOnly: true,
    handler: async (ctx) => {
        const text = ctx.text?.trim();
        if (!text)
            return ctx.sock.sendMessage(ctx.from, {
                text: `❌ Provide a status message.\n\nExample: \`${config.BOT_PREFIX}statuspost Good morning everyone! 🌅\``,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });

        await ctx.react('⏳');
        try {
            await ctx.sock.sendMessage('status@broadcast', {
                text: `${text}\n\n_— ${config.BOT_NAME}_`,
            });

            await ctx.react('✅');
            await ctx.sock.sendMessage(ctx.from, {
                text: `✅ *Status Posted!*\n\n📝 _${text}_\n\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        } catch (err) {
            await ctx.react('❌');
            await ctx.sock.sendMessage(ctx.from, {
                text: `❌ Failed to post status: ${err.message}`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }
    },
});

// ── Welcome Config (set custom welcome message) ───────────────
addCmd({
    name: 'setwelcome',
    aliases: ['welcomemsg', 'customwelcome'],
    desc: 'Set a custom welcome message for new members\n  • Use {name} for member name\n  • Use {group} for group name',
    usage: 'setwelcome Welcome {name} to {group}! 🎉',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    handler: async (ctx) => {
        const msg = ctx.text?.trim();
        if (!msg)
            return ctx.sock.sendMessage(ctx.from, {
                text:
                    `❌ Provide a message template.\n\n` +
                    `*Variables you can use:*\n` +
                    `• \`{name}\` — new member's name\n` +
                    `• \`{group}\` — group name\n\n` +
                    `*Example:*\n` +
                    `\`${config.BOT_PREFIX}setwelcome Hey {name}, welcome to {group}! 🎉\``,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });

        const { setGroupSetting } = require('../../guru/db/database');
        setGroupSetting(ctx.from, 'welcomeMsg', msg);

        await ctx.sock.sendMessage(ctx.from, {
            text:
                `✅ *Custom welcome message saved!*\n\n` +
                `📝 Preview:\n_${msg.replace('{name}', 'NewMember').replace('{group}', ctx.groupMeta?.subject || 'this group')}_\n\n` +
                `_${config.BOT_NAME}_`,
            contextInfo: channelCtx(),
        }, { quoted: ctx.m });
    },
});
