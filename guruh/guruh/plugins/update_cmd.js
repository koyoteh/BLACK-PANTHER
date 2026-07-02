'use strict';
// ╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
//  🐾  BLACK PANTHER MD  —  .update command
//  Owner-only: triggers a manual GitHub pull from WhatsApp chat.
//  Replies with the full commit changelog if new commits are found.
// ╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

const { addCmd }       = require('../../guru/handlers/loader');
const config           = require('../../guru/config/settings');
const logger           = require('../../guru/utils/logger');
const { channelCtx }   = require('../../guru/utils/gmdFunctions2');
const { spawnSync }    = require('child_process');
const path             = require('path');

// Cloud containers are immutable — git pull has no effect after a deploy
const IS_CLOUD = !!(
    process.env.DYNO || process.env.K_SERVICE || process.env.RAILWAY_ENVIRONMENT ||
    process.env.RENDER || process.env.KOYEB_APP_NAME || process.env.FLY_APP_NAME
);

const ROOT = path.join(__dirname, '..', '..');

function run(cmd) {
    return spawnSync(cmd, { shell: true, cwd: ROOT, encoding: 'utf8' });
}

function injectAuth(url, token) {
    try {
        const u = new URL(url);
        u.username = 'koyoteh';
        u.password = token;
        return u.toString();
    } catch { return url; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  .update — manual GitHub pull (owner only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
addCmd({
    name:    'update',
    aliases: ['upgrade', 'pull'],
    desc:    'Pull the latest updates from GitHub and show the changelog',
    usage:   'update',
    category: 'owner',
    handler: async (ctx) => {
        const { sock, from, isOwner, reply } = ctx;

        if (!isOwner) {
            return reply('🚫 This command is for the *bot owner* only.');
        }

        // On Heroku/cloud the Docker image is immutable — git pull has no effect
        if (IS_CLOUD) {
            return sock.sendMessage(from, {
                text:
                    `☁️ *Cloud Deployment Detected*\n\n` +
                    `Git pull doesn't work on *${process.env.DYNO ? 'Heroku' : 'cloud'}* because the container is immutable.\n\n` +
                    `*To update on Heroku:*\n` +
                    `1. Push new code to GitHub\n` +
                    `2. Heroku auto-deploys (if connected) or run:\n` +
                    `   \`git push heroku main\`\n\n` +
                    `_The bot already auto-fetches on Replit restarts._`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        if (!token) {
            return reply('⚠️ *GITHUB_PERSONAL_ACCESS_TOKEN* is not set in secrets.\nAdd it in Replit Secrets and restart.');
        }

        // ━━ Send "checking" message ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        await sock.sendMessage(from, {
            text: `🔍 *Checking for updates…*\n_Connecting to GitHub repository_`,
            contextInfo: channelCtx(),
        });

        try {
            // Get & auth remote URL
            const remoteRes = run('git remote get-url origin');
            if (remoteRes.status !== 0) {
                return reply('❌ No git remote "origin" found.');
            }
            const remoteUrl = (remoteRes.stdout || '').trim();
            const authUrl   = injectAuth(remoteUrl, token);

            // Set auth URL, fetch, restore clean URL
            run(`git remote set-url origin "${authUrl}"`);
            const fetchRes = run(
                'git fetch --unshallow origin main 2>/dev/null || ' +
                'git fetch --depth=2147483647 origin main 2>/dev/null || ' +
                'git fetch origin main'
            );
            run(`git remote set-url origin "${remoteUrl}"`);

            if (fetchRes.status !== 0 && !(fetchRes.stderr || '').includes('already complete')) {
                const errMsg = (fetchRes.stderr || '').slice(0, 300);
                return reply(`❌ *Fetch failed!*\n\`\`\`${errMsg}\`\`\``);
            }

            // Count new commits
            const countRes = run('git rev-list HEAD..origin/main --count');
            const behind   = parseInt((countRes.stdout || '0').trim(), 10) || 0;

            if (behind === 0) {
                return sock.sendMessage(from, {
                    text:
                        `╭━⬣ *${config.BOT_NAME} Updater* ⬣━╮\n` +
                        `┃\n` +
                        `┃━⬣ *Status:* ✅ Already up-to-date!\n` +
                        `┃━⬣ *Branch:* main\n` +
                        `┃━⬣ *Repo:*   github.com/koyoteh/BLACK-PANTHER\n` +
                        `┃\n` +
                        `╰━⬣ *No new commits found* ⬣━╯`,
                    contextInfo: channelCtx(),
                });
            }

            // Get the changelog
            const logRes = run(
                'git log HEAD..origin/main --oneline --no-decorate --format="%h %s (%an)" 2>/dev/null'
            );
            const lines    = (logRes.stdout || '').trim().split('\n').filter(Boolean);
            const logText  = lines.slice(0, 15).map((l, i) => `┃━⬣ ${i + 1}. ${l}`).join('\n');
            const extra    = lines.length > 15 ? `\n┃━⬣ … and ${lines.length - 15} more` : '';

            // Apply the update
            const resetRes = run('git reset --hard origin/main');
            if (resetRes.status !== 0) {
                return reply(`❌ *Reset failed!*\n\`\`\`${(resetRes.stderr || '').slice(0, 300)}\`\`\``);
            }

            // Re-install deps if package.json changed
            const diffRes = run('git diff HEAD@{1} HEAD -- package.json 2>/dev/null');
            let depsNote  = '';
            if (diffRes.stdout && diffRes.stdout.trim()) {
                run('npm install --legacy-peer-deps --ignore-scripts 2>&1 && npm rebuild better-sqlite3 2>&1');
                depsNote = '\n┃━⬣ 📦 *Dependencies* reinstalled';
            }

            const msg =
                `╭━⬣ *${config.BOT_NAME} Updated!* ⬣━╮\n` +
                `┃\n` +
                `┃━⬣ *Status:*  ✅ Updated successfully!\n` +
                `┃━⬣ *Commits:* ${behind} new commit(s)\n` +
                `┃━⬣ *Branch:*  main\n` +
                `┃\n` +
                `┃━⬣ 📋 *Changelog:*\n` +
                logText + extra +
                depsNote +
                `\n┃\n` +
                `╰━⬣ *Restart bot to apply changes* ⬣━╯\n\n` +
                `> 🐾 ${config.BOT_NAME} | GuruTech`;

            await sock.sendMessage(from, { text: msg, contextInfo: channelCtx() });
            logger.success('UPDATE', `Manual update applied: ${behind} commit(s) by owner`);

        } catch (err) {
            logger.error('UPDATE_CMD', err.message);
            return reply(`❌ *Update error:*\n${err.message}`);
        }
    },
});
