'use strict';
const { addCmd }                          = require('../../guru/handlers/loader');
const { getStatusReport }                 = require('../../guru/utils/statusEngine');
const { addSudo, removeSudo, getSudoList, isSudo, setSetting, getSetting } = require('../../guru/db/database');
const { numberToJid, cleanJid }           = require('../../guru/utils/helpers');
const config                              = require('../../guru/config/settings');
const { channelCtx }                      = require('../../guru/utils/gmdFunctions2');
const { execSync }                        = require('child_process');

// ── Sudo management ────────────────────────────────────────────
addCmd({
    name: 'addsudo',
    aliases: ['setsudo'],
    desc: 'Add a sudo user',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const target = ctx.args[0]
            ? numberToJid(ctx.args[0])
            : ctx.quoted
                ? cleanJid(ctx.m.message?.extendedTextMessage?.contextInfo?.participant || '')
                : null;

        if (!target) return ctx.sock.sendMessage(ctx.from, { text: '❌ Tag a user or provide their number.\n\nExample: `.addsudo 254712345678`', contextInfo: channelCtx() }, { quoted: ctx.m });
        if (isSudo(target)) return ctx.sock.sendMessage(ctx.from, { text: '⚠️ That user is already a sudo user.', contextInfo: channelCtx() }, { quoted: ctx.m });

        addSudo(target);
        await ctx.reply(`✅ *@${target.split('@')[0]}* has been added as a sudo user.`, { mentions: [target] });
    },
});

addCmd({
    name: 'delsudo',
    aliases: ['removesudo'],
    desc: 'Remove a sudo user',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const target = ctx.args[0]
            ? numberToJid(ctx.args[0])
            : ctx.quoted
                ? cleanJid(ctx.m.message?.extendedTextMessage?.contextInfo?.participant || '')
                : null;

        if (!target) return ctx.sock.sendMessage(ctx.from, { text: '❌ Tag a user or provide their number.', contextInfo: channelCtx() }, { quoted: ctx.m });
        if (!isSudo(target)) return ctx.sock.sendMessage(ctx.from, { text: '⚠️ That user is not a sudo user.', contextInfo: channelCtx() }, { quoted: ctx.m });

        removeSudo(target);
        await ctx.reply(`✅ *@${target.split('@')[0]}* has been removed from sudo users.`, { mentions: [target] });
    },
});

addCmd({
    name: 'sudolist',
    aliases: ['listsudo'],
    desc: 'List all sudo users',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const list = getSudoList();
        if (!list.length) return ctx.sock.sendMessage(ctx.from, { text: '📭 No sudo users have been added yet.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const text = `👑 *Sudo Users* (${list.length})\n\n` +
            list.map((j, i) => `${i + 1}. @${j.split('@')[0]}`).join('\n') +
            `\n\n_${config.BOT_NAME}_`;
        await ctx.send({ text, mentions: list });
    },
});

// ── Bot settings ───────────────────────────────────────────────
addCmd({
    name: 'setmode',
    desc: 'Set bot mode (public/private/groups/dm)',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const mode = ctx.args[0]?.toLowerCase();
        const valid = ['public', 'private', 'groups', 'dm'];
        if (!mode || !valid.includes(mode))
            return ctx.reply(`❌ Invalid mode.\n\nValid modes: ${valid.join(', ')}\n\nExample: \`.setmode public\``);

        setSetting('MODE', mode);
        config.MODE = mode;
        await ctx.sock.sendMessage(ctx.from, { text: `✅ Bot mode set to *${mode}*`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

addCmd({
    name: 'setprefix',
    desc: 'Change the bot command prefix',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const prefix = ctx.args[0];
        if (!prefix) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a new prefix.\n\nExample: `.setprefix !`', contextInfo: channelCtx() }, { quoted: ctx.m });
        setSetting('BOT_PREFIX', prefix);
        config.BOT_PREFIX = prefix;
        await ctx.sock.sendMessage(ctx.from, { text: `✅ Prefix changed to *${prefix}*`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

addCmd({
    name: 'setname',
    desc: 'Change the bot name',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const name = ctx.text;
        if (!name) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a new bot name.', contextInfo: channelCtx() }, { quoted: ctx.m });
        setSetting('BOT_NAME', name);
        config.BOT_NAME = name;
        await ctx.sock.sendMessage(ctx.from, { text: `✅ Bot name updated to *${name}*`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── Broadcast ──────────────────────────────────────────────────
addCmd({
    name: 'broadcast',
    aliases: ['bc'],
    desc: 'Broadcast a message to all groups',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        if (!ctx.text) return ctx.sock.sendMessage(ctx.from, { text: '❌ Provide a message to broadcast.', contextInfo: channelCtx() }, { quoted: ctx.m });
        const groups = await ctx.sock.groupFetchAllParticipating().catch(() => ({}));
        const ids    = Object.keys(groups);
        if (!ids.length) return ctx.sock.sendMessage(ctx.from, { text: '⚠️ No groups found.', contextInfo: channelCtx() }, { quoted: ctx.m });

        await ctx.sock.sendMessage(ctx.from, { text: `📡 Broadcasting to *${ids.length}* groups...`, contextInfo: channelCtx() }, { quoted: ctx.m });
        let sent = 0;
        for (const id of ids) {
            await ctx.sock.sendMessage(id, {
                text: `📢 *Broadcast from ${config.OWNER_NAME}*\n\n${ctx.text}\n\n_— ${config.BOT_NAME}_`,
            }).catch(() => {});
            sent++;
            await new Promise(r => setTimeout(r, 500));
        }
        await ctx.sock.sendMessage(ctx.from, { text: `✅ Broadcast sent to *${sent}* groups.`, contextInfo: channelCtx() }, { quoted: ctx.m });
    },
});

// ── Restart / shutdown ─────────────────────────────────────────
addCmd({
    name: 'restart',
    desc: 'Restart the bot',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        await ctx.reply('♻️ Restarting *' + config.BOT_NAME + '*...');
        setTimeout(() => process.exit(0), 2000);
    },
});

addCmd({
    name: 'shutdown',
    aliases: ['stop'],
    desc: 'Shut down the bot',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        await ctx.sock.sendMessage(ctx.from, { text: `🛑 *${config.BOT_NAME}* is shutting down. Goodbye!`, contextInfo: channelCtx() }, { quoted: ctx.m });
        setTimeout(() => process.exit(1), 2000);
    },
});

// ── Status Engine Report ───────────────────────────────────────
addCmd({
    name: 'statusreport',
    aliases: ['statusstats', 'viewstatus'],
    desc: 'Show auto-status engine statistics',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        await ctx.reply(getStatusReport());
    },
});

// ── Auto Update ────────────────────────────────────────────────
addCmd({
    name: 'update',
    aliases: ['upgrade', 'checkupdate'],
    desc: 'Check for and apply updates from the GitHub repo',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        await ctx.react('🔄');

        const run = (cmd) => execSync(cmd, { cwd: process.cwd(), encoding: 'utf8', timeout: 60000, env: { ...process.env, GIT_DISCOVERY_ACROSS_FILESYSTEM: '1' } }).trim();

        // ── Step 1: Fetch latest from origin ──────────────────
        try {
            await ctx.sock.sendMessage(ctx.from, {
                text: `🔍 *Checking for updates...*\n\n⏳ Fetching from GitHub...`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });

            run('git fetch origin');
        } catch (err) {
            return ctx.sock.sendMessage(ctx.from, {
                text: `❌ *Failed to reach GitHub*\n\nError: ${err.message.slice(0, 200)}\n\n_Check your internet connection._`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        // ── Step 2: Compare local vs remote ───────────────────
        let localHash, remoteHash, remoteBranch;
        try {
            localHash = run('git rev-parse HEAD');
        } catch (err) {
            return ctx.sock.sendMessage(ctx.from, {
                text: `❌ Could not read local git state.\n${err.message.slice(0, 200)}`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        // Auto-detect remote branch (main or master)
        for (const branch of ['main', 'master']) {
            try {
                remoteHash = run(`git rev-parse origin/${branch}`);
                remoteBranch = branch;
                break;
            } catch { /* try next */ }
        }

        if (!remoteHash) {
            return ctx.sock.sendMessage(ctx.from, {
                text: `❌ Could not read remote branch (tried main & master).\n_Ensure remote is properly configured._`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        if (localHash === remoteHash) {
            await ctx.react('✅');
            return ctx.sock.sendMessage(ctx.from, {
                text:
                    `✅ *${config.BOT_NAME} is up to date!*\n\n` +
                    `📌 *Version :* \`${localHash.slice(0, 7)}\`\n` +
                    `🏠 *Branch  :* ${remoteBranch}\n\n` +
                    `_No new updates available._`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        // ── Step 3: Show what's new ────────────────────────────
        let changelog = '';
        try {
            changelog = run(`git log HEAD..origin/${remoteBranch} --oneline --no-merges`);
        } catch {
            changelog = '_(could not read changelog)_';
        }

        const changeLines = changelog
            .split('\n')
            .filter(Boolean)
            .slice(0, 10)
            .map(l => `  • ${l.slice(8)}`)
            .join('\n');

        const totalNew = changelog.split('\n').filter(Boolean).length;

        await ctx.sock.sendMessage(ctx.from, {
            text:
                `🆕 *Update Available!*\n\n` +
                `📦 *${totalNew} new commit${totalNew !== 1 ? 's' : ''}:*\n` +
                `${changeLines || '  • (no details)'}\n\n` +
                `⏳ Applying update now...`,
            contextInfo: channelCtx(),
        }, { quoted: ctx.m });

        // ── Step 4: Check if package.json will change ─────────
        let pkgChanged = false;
        try {
            const diffFiles = run(`git diff HEAD origin/${remoteBranch} --name-only`);
            pkgChanged = diffFiles.split('\n').some(f => f.trim() === 'package.json');
        } catch {}

        // ── Step 5: Pull updates ──────────────────────────────
        try {
            run(`git pull origin ${remoteBranch} --rebase`);
        } catch (err) {
            await ctx.react('❌');
            return ctx.sock.sendMessage(ctx.from, {
                text:
                    `❌ *Git pull failed!*\n\n` +
                    `Error: ${err.message.slice(0, 300)}\n\n` +
                    `_You may need to run \`git pull\` manually._`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        // ── Step 6: Reinstall deps if package.json changed ────
        if (pkgChanged) {
            await ctx.sock.sendMessage(ctx.from, {
                text: `📦 *package.json changed — installing new dependencies...*`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            try {
                run('npm install --legacy-peer-deps');
            } catch (err) {
                await ctx.sock.sendMessage(ctx.from, {
                    text: `⚠️ Dependency install had issues:\n${err.message.slice(0, 200)}\n\nContinuing restart...`,
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            }
        }

        // ── Step 7: Confirm and restart ───────────────────────
        const newHash = run('git rev-parse HEAD').slice(0, 7);

        await ctx.sock.sendMessage(ctx.from, {
            text:
                `✅ *Update Applied Successfully!*\n\n` +
                `📌 *New version :* \`${newHash}\`\n` +
                `📦 *Commits     :* ${totalNew}\n` +
                `🔁 *Deps update :* ${pkgChanged ? 'Yes ✅' : 'No (unchanged)'}\n\n` +
                `♻️ *Restarting ${config.BOT_NAME}...*`,
            contextInfo: channelCtx(),
        }, { quoted: ctx.m });

        await ctx.react('✅');
        setTimeout(() => process.exit(0), 2500);
    },
});

// ── Repo ───────────────────────────────────────────────────────
addCmd({
    name: 'repo',
    aliases: ['github', 'source', 'sourcecode'],
    desc: 'Show the bot GitHub repository link',
    category: 'owner',
    handler: async (ctx) => {
        await ctx.sock.sendMessage(ctx.from, {
            text:
                `╭═❖ *${config.BOT_NAME}* ❖═╮\n` +
                `│ 🐾 *GitHub Repository*\n` +
                `├──────────────────────────\n` +
                `│ 🔗 https://github.com/koyoteh/BLACK-PANTHER\n` +
                `│\n` +
                `│ ⭐ Star the repo if you love it!\n` +
                `│ 🍴 Fork it to customise your own bot\n` +
                `│ 📞 Owner: wa.me/${config.OWNER_NUMBER}\n` +
                `╰═❖ _${config.BOT_NAME}_ ❖═╯`,
            contextInfo: channelCtx(),
        }, { quoted: ctx.m });
        await ctx.react('🐾');
    },
});

// ── Owner Info Card ────────────────────────────────────────────
addCmd({
    name: 'owner',
    aliases: ['developer', 'dev', 'creator', 'contact'],
    desc: 'Show bot owner contact info',
    category: 'general',
    handler: async (ctx) => {
        let ppUrl = null;
        try {
            ppUrl = await ctx.sock.profilePictureUrl(
                config.OWNER_NUMBER + '@s.whatsapp.net', 'image'
            );
        } catch {}

        const ownerCard =
            `╭═❖ *OWNER INFO* ❖═╮\n` +
            `│ 🐾 *${config.BOT_NAME}*\n` +
            `├──────────────────────────\n` +
            `│ 👑 *Name:*    ${config.OWNER_NAME}\n` +
            `│ 📞 *Number:*  +${config.OWNER_NUMBER}\n` +
            `│ 💬 *Chat:*    wa.me/${config.OWNER_NUMBER}\n` +
            `│ 📡 *Channel:* ${config.CHANNEL_URL}\n` +
            `├──────────────────────────\n` +
            `│ 🔗 *GitHub:*  https://github.com/koyoteh/BLACK-PANTHER\n` +
            `│ ⭐ Star us if you love the bot!\n` +
            `╰═❖ _${config.BOT_NAME}_ ❖═╯`;

        if (ppUrl) {
            await ctx.sock.sendMessage(
                ctx.from,
                { image: { url: ppUrl }, caption: ownerCard, contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        } else {
            await ctx.sock.sendMessage(
                ctx.from,
                { text: ownerCard, contextInfo: channelCtx() },
                { quoted: ctx.m }
            );
        }
        await ctx.react('👑');
    },
});
