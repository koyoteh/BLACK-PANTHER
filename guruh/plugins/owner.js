'use strict';
const { addCmd }                          = require('../../guru/handlers/loader');
const { getStatusReport }                 = require('../../guru/utils/statusEngine');
const { addSudo, removeSudo, getSudoList, isSudo, setSetting, getSetting } = require('../../guru/db/database');
const { numberToJid, cleanJid }           = require('../../guru/utils/helpers');
const config                              = require('../../guru/config/settings');
const { channelCtx, sendButtons }         = require('../../guru/utils/gmdFunctions2');
const { execSync }                        = require('child_process');
const fs                                  = require('fs');
const path                                = require('path');
const https                               = require('https');

// ── GitHub API helper (no git CLI needed) ──────────────────────
const GH_REPO   = 'koyoteh/BLACK-PANTHER';
const GH_BRANCH = 'main';
const SHA_FILE  = path.join(process.cwd(), '.local', 'last_sha.txt');

function ghRequest(method, apiPath, body = null) {
    return new Promise((resolve, reject) => {
        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '';
        const opts = {
            hostname: 'api.github.com',
            path:     apiPath,
            method,
            headers:  {
                'Authorization': token ? `token ${token}` : '',
                'Accept':        'application/vnd.github.v3+json',
                'User-Agent':    'BlackPantherMD-Bot',
                'Content-Type':  'application/json',
            },
        };
        const req = https.request(opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function readStoredSha() {
    try { return fs.readFileSync(SHA_FILE, 'utf8').trim(); }
    catch { return null; }
}
function storesha(sha) {
    fs.mkdirSync(path.dirname(SHA_FILE), { recursive: true });
    fs.writeFileSync(SHA_FILE, sha, 'utf8');
}

const REPO_IMAGE = 'https://i.ibb.co/PZjVDnBM/upload-1778637749645-4b17ed31-jpg.jpg';

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

// ── Auto Update (GitHub API — no git CLI required) ─────────────
addCmd({
    name: 'update',
    aliases: ['upgrade', 'checkupdate'],
    desc: 'Check for and apply updates from GitHub via API',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        await ctx.react('🔄');

        const sep = `✦ ───────────── ✦`;

        // ── Step 1: Fetch latest commit from GitHub API ────────
        await ctx.sock.sendMessage(ctx.from, {
            text: `🔍 *Checking for updates...*\n\n⏳ _Contacting GitHub API…_`,
            contextInfo: channelCtx(),
        }, { quoted: ctx.m });

        let latestCommit;
        try {
            const refData = await ghRequest('GET', `/repos/${GH_REPO}/git/ref/heads/${GH_BRANCH}`);
            if (!refData?.object?.sha) throw new Error(JSON.stringify(refData).slice(0, 200));
            const commitData = await ghRequest('GET', `/repos/${GH_REPO}/git/commits/${refData.object.sha}`);
            latestCommit = {
                sha:     refData.object.sha,
                shortSha: refData.object.sha.slice(0, 7),
                message: commitData?.message?.split('\n')[0] || '—',
                author:  commitData?.author?.name || 'unknown',
                date:    commitData?.author?.date
                    ? new Date(commitData.author.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
                    : '—',
            };
        } catch (err) {
            await ctx.react('❌');
            return ctx.sock.sendMessage(ctx.from, {
                text:
                    `❌ *Could not reach GitHub*\n\n` +
                    `${sep}\n\n` +
                    `_${err.message.slice(0, 200)}_\n\n` +
                    `_Check your internet connection or try again._`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        // ── Step 2: Compare with stored SHA ───────────────────
        const storedSha = readStoredSha();

        if (storedSha === latestCommit.sha) {
            await ctx.react('✅');
            return ctx.sock.sendMessage(ctx.from, {
                text:
                    `✅ *${config.BOT_NAME} is up to date!*\n\n` +
                    `${sep}\n\n` +
                    `📌 *Version :* \`${latestCommit.shortSha}\`\n` +
                    `🌿 *Branch  :* ${GH_BRANCH}\n` +
                    `👤 *Author  :* ${latestCommit.author}\n` +
                    `📅 *Date    :* ${latestCommit.date}\n\n` +
                    `_No new updates available._`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        // ── Step 3: Fetch list of changed files ────────────────
        let changedFiles = [];
        let commitLog = [];
        try {
            if (storedSha) {
                const compare = await ghRequest('GET',
                    `/repos/${GH_REPO}/compare/${storedSha}...${latestCommit.sha}`);
                changedFiles = (compare?.files || []).map(f => ({
                    path:   f.filename,
                    status: f.status,   // added / modified / removed
                }));
                commitLog = (compare?.commits || [])
                    .slice(-10)
                    .reverse()
                    .map(c => `  • ${c.commit?.message?.split('\n')[0]?.slice(0, 60) || '—'}`)
                    .join('\n');
            }
        } catch { /* non-critical */ }

        const totalFiles   = changedFiles.length;
        const pkgChanged   = changedFiles.some(f => f.path === 'package.json');
        const toUpdate     = changedFiles.filter(f => f.status !== 'removed');
        const toRemove     = changedFiles.filter(f => f.status === 'removed');

        await ctx.sock.sendMessage(ctx.from, {
            text:
                `🆕 *Update Available!*\n\n` +
                `${sep}\n\n` +
                `📦 *Latest:* \`${latestCommit.shortSha}\`\n` +
                `📅 *Date  :* ${latestCommit.date}\n` +
                `👤 *By    :* ${latestCommit.author}\n\n` +
                (commitLog ? `📝 *Recent changes:*\n${commitLog}\n\n` : '') +
                `${sep}\n\n` +
                `📁 *${totalFiles} file${totalFiles !== 1 ? 's' : ''} changed* — downloading…`,
            contextInfo: channelCtx(),
        }, { quoted: ctx.m });

        // ── Step 4: Download & write changed files ─────────────
        let written = 0, failed = 0;
        for (const file of toUpdate) {
            try {
                const raw = await ghRequest('GET',
                    `/repos/${GH_REPO}/contents/${file.path}?ref=${latestCommit.sha}`);
                if (!raw?.content) continue;
                const content = Buffer.from(raw.content, 'base64');
                const dest    = path.join(process.cwd(), file.path);
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.writeFileSync(dest, content);
                written++;
            } catch { failed++; }
        }

        for (const file of toRemove) {
            try {
                const dest = path.join(process.cwd(), file.path);
                if (fs.existsSync(dest)) fs.unlinkSync(dest);
            } catch { /* best-effort */ }
        }

        // ── Step 5: Reinstall deps if package.json changed ────
        if (pkgChanged) {
            await ctx.sock.sendMessage(ctx.from, {
                text: `📦 *package.json changed — reinstalling dependencies…*`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            try {
                execSync('npm install --legacy-peer-deps', {
                    cwd: process.cwd(), encoding: 'utf8', timeout: 120000,
                });
            } catch (err) {
                await ctx.sock.sendMessage(ctx.from, {
                    text: `⚠️ Dependency install had issues — continuing:\n_${err.message.slice(0, 200)}_`,
                    contextInfo: channelCtx(),
                }, { quoted: ctx.m });
            }
        }

        // ── Step 6: Save new SHA and restart ──────────────────
        storesha(latestCommit.sha);

        await ctx.sock.sendMessage(ctx.from, {
            text:
                `✅ *Update Applied!*\n\n` +
                `${sep}\n\n` +
                `📌 *New version :* \`${latestCommit.shortSha}\`\n` +
                `📁 *Files written:* ${written}${failed ? `  ⚠️ ${failed} failed` : ''}\n` +
                `🔁 *Deps updated :* ${pkgChanged ? 'Yes ✅' : 'No'}\n\n` +
                `♻️ *Restarting ${config.BOT_NAME}…*`,
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
        const sep = `✦ ───────────── ✦`;
        const card =
            `🐾 *${config.BOT_NAME}* 🐾\n` +
            `✦ *Open-Source WhatsApp Bot* ✦\n` +
            `_GuruTech  ·  Built with ❤️_\n\n` +
            `${sep}\n\n` +
            `🌿 *Branch*   ·  main\n` +
            `⚡ *Engine*   ·  Node.js + Baileys v7\n` +
            `🗄️ *Storage*  ·  SQLite\n` +
            `🔒 *License*  ·  Open-Source\n\n` +
            `${sep}\n\n` +
            `✨ *FEATURES*\n\n` +
            `🤖  200+ Commands & growing\n` +
            `🛡️  Full group protection suite\n` +
            `🎵  Music · Downloads · AI Chat\n` +
            `🔄  Auto-Bio · Auto-Status · React\n` +
            `👑  Owner-only admin controls\n` +
            `🎭  Sticker maker & media tools\n\n` +
            `${sep}\n\n` +
            `👨‍💻 *DEVELOPER*\n\n` +
            `🏷️  *${config.OWNER_NAME}*\n` +
            `📞  +${config.OWNER_NUMBER}\n\n` +
            `${sep}\n\n` +
            `⭐ *Star it · Fork it · Build yours!*\n` +
            `_Tap a button below to get started_`;

        await sendButtons(ctx.sock, ctx.from, {
            title:  `🐾 ${config.BOT_NAME} — Source Code`,
            text:   card,
            footer: `© GuruTech • ${config.BOT_NAME}`,
            image:  { url: REPO_IMAGE },
            buttons: [
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '🌐 View on GitHub',
                        url: 'https://github.com/koyoteh/BLACK-PANTHER',
                        merchant_url: 'https://github.com/koyoteh/BLACK-PANTHER',
                    }),
                },
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '💬 Chat with Owner',
                        url: `https://wa.me/${config.OWNER_NUMBER}`,
                        merchant_url: `https://wa.me/${config.OWNER_NUMBER}`,
                    }),
                },
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📡 Join Channel',
                        url: config.CHANNEL_URL,
                        merchant_url: config.CHANNEL_URL,
                    }),
                },
            ],
        }, { quoted: ctx.m }).catch(async () => {
            await ctx.sock.sendMessage(ctx.from, {
                image:       { url: REPO_IMAGE },
                caption:     card,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m }).catch(async () => {
                await ctx.sock.sendMessage(ctx.from, { text: card, contextInfo: channelCtx() }, { quoted: ctx.m });
            });
        });
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
