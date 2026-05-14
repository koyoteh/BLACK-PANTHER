'use strict';
// ╔══════════════════════════════════════════════════════════════╗
//  🐾  BLACK PANTHER MD  —  vcf_wa.js
//  📇  VCF Filter · WA Checker · GetPP · GetStatus
//  🔇  MuteChat · ChatInfo · ExportVCF · Disappear All
// ╚══════════════════════════════════════════════════════════════╝

const { addCmd }    = require('../../guru/handlers/loader');
const config        = require('../../guru/config/settings');
const { channelCtx } = require('../../guru/utils/gmdFunctions2');
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');

const sep = `✦ ───────────── ✦`;

// ══════════════════════════════════════════════════════════════
//  VCF HELPERS
// ══════════════════════════════════════════════════════════════

function parseVcf(text) {
    const cards = [];
    const raw   = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split on BEGIN:VCARD boundaries
    const pattern = /BEGIN:VCARD[\s\S]*?END:VCARD/gi;
    let   match;
    while ((match = pattern.exec(raw)) !== null) {
        const block = match[0].trim();

        // Extract all TEL lines — keep original block untouched
        const telLines = [...block.matchAll(/^TEL[^:\n]*:(.+)$/gim)];
        const numbers  = telLines
            .map(m => m[1].trim().replace(/[\s\-().]/g, ''))   // strip spaces/dashes/parens
            .map(n => n.replace(/^\+/, ''))                    // strip leading +
            .filter(n => /^\d{6,15}$/.test(n));                // valid digit-only number

        cards.push({ block, numbers });
    }
    return cards;
}

function buildVcf(cards) {
    return cards.map(c => c.block).join('\r\n\r\n') + '\r\n';
}

// Chunk array into groups of N
function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
}

// ══════════════════════════════════════════════════════════════
//  📇  VCFFILTER
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'vcffilter',
    aliases: ['filtervcf', 'vcfcheck', 'vcfsplit'],
    desc: 'Reply to a VCF file — bot splits contacts into WhatsApp & non-WhatsApp VCF files',
    usage: 'Reply to a .vcf document with .vcffilter',
    category: 'tools',
    handler: async (ctx) => {

        // ── Find the VCF document ──────────────────────────────
        const quoted     = ctx.m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const curType    = getContentType(ctx.m.message);
        const quotedType = quoted ? getContentType(quoted) : null;

        const isDoc = t => t === 'documentMessage';
        const useQuoted  = isDoc(quotedType);
        const useCurrent = isDoc(curType);

        if (!useQuoted && !useCurrent) {
            return ctx.sock.sendMessage(ctx.from, {
                text:
                    `📇 *VCF Filter — Usage*\n\n` +
                    `${sep}\n\n` +
                    `Send or forward a *.vcf* contacts file, then *reply to it* with:\n` +
                    `\`${config.BOT_PREFIX}vcffilter\`\n\n` +
                    `The bot will check every number against WhatsApp and send back:\n` +
                    `  ✅ *whatsapp_contacts.vcf* — numbers on WhatsApp\n` +
                    `  ❌ *non_whatsapp_contacts.vcf* — numbers not on WhatsApp\n\n` +
                    `_Original contact data is never modified — only filtered._`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
        }

        await ctx.react('⏳');

        // ── Download the VCF buffer ────────────────────────────
        let buf;
        try {
            if (useQuoted) {
                const ctxInfo = ctx.m.message?.extendedTextMessage?.contextInfo;
                buf = await downloadMediaMessage({
                    key: {
                        id:          ctxInfo?.stanzaId,
                        remoteJid:   ctx.from,
                        fromMe:      false,
                        participant: ctxInfo?.participant || ctxInfo?.remoteJid,
                    },
                    message: quoted,
                }, 'buffer', {});
            } else {
                buf = await downloadMediaMessage(ctx.m, 'buffer', {});
            }
        } catch (e) {
            await ctx.react('❌');
            return ctx.reply(`❌ Could not download the file: ${e.message}`);
        }

        const text = buf.toString('utf8');
        const cards = parseVcf(text);

        if (!cards.length) {
            await ctx.react('❌');
            return ctx.reply(
                `❌ *No valid vCard contacts found in this file.*\n\n` +
                `Make sure it is a proper *.vcf* file with contacts.`
            );
        }

        // ── Collect unique numbers → JIDs ─────────────────────
        const numToCards = new Map(); // normalized-number → [card indices]
        cards.forEach((card, idx) => {
            card.numbers.forEach(num => {
                if (!numToCards.has(num)) numToCards.set(num, []);
                numToCards.get(num).push(idx);
            });
        });

        const allNums = [...numToCards.keys()];

        await ctx.sock.sendMessage(ctx.from, {
            text:
                `🔍 *Checking ${cards.length} contacts (${allNums.length} unique numbers)…*\n\n` +
                `⏳ _This may take a moment for large lists._`,
            contextInfo: channelCtx(),
        }, { quoted: ctx.m });

        // ── Batch-check numbers on WhatsApp (50 at a time) ────
        const waSet = new Set();   // numbers confirmed on WA
        const chunks = chunk(allNums, 50);

        for (const batch of chunks) {
            try {
                const jids    = batch.map(n => `${n}@s.whatsapp.net`);
                const results = await ctx.sock.onWhatsApp(...jids);
                for (const r of results || []) {
                    if (r?.exists) {
                        const num = r.jid.split('@')[0].split(':')[0];
                        waSet.add(num);
                    }
                }
            } catch (e) {
                console.error('[VCFFILTER] batch error:', e.message);
            }
            // Small pause between batches to avoid rate-limit
            if (chunks.length > 1) await new Promise(r => setTimeout(r, 800));
        }

        // ── Classify cards ────────────────────────────────────
        const waCards   = [];   // at least one number on WA
        const nowaCards = [];   // no numbers on WA

        cards.forEach(card => {
            const onWa = card.numbers.some(n => waSet.has(n));
            if (onWa) waCards.push(card);
            else      nowaCards.push(card);
        });

        // ── Build VCF strings ─────────────────────────────────
        const waVcf   = buildVcf(waCards);
        const nowaVcf = buildVcf(nowaCards);

        // ── Send summary ──────────────────────────────────────
        await ctx.sock.sendMessage(ctx.from, {
            text:
                `✅ *VCF Filter Complete!*\n\n` +
                `${sep}\n\n` +
                `📋 *Total contacts  :* ${cards.length}\n` +
                `✅ *On WhatsApp     :* ${waCards.length}\n` +
                `❌ *Not on WhatsApp :* ${nowaCards.length}\n\n` +
                `${sep}\n\n` +
                `📤 _Sending 2 VCF files now…_\n` +
                `_${config.BOT_NAME}_`,
            contextInfo: channelCtx(),
        }, { quoted: ctx.m });

        // ── Send WhatsApp VCF ─────────────────────────────────
        if (waCards.length) {
            await ctx.sock.sendMessage(ctx.from, {
                document: Buffer.from(waVcf, 'utf8'),
                mimetype: 'text/vcard',
                fileName: 'whatsapp_contacts.vcf',
                caption:
                    `✅ *WhatsApp Contacts*\n` +
                    `${sep}\n\n` +
                    `📇 *${waCards.length} contact${waCards.length !== 1 ? 's' : ''}* confirmed on WhatsApp\n\n` +
                    `_Original data preserved — no edits made._\n` +
                    `_${config.BOT_NAME}_`,
            }, { quoted: ctx.m });
        } else {
            await ctx.reply(`ℹ️ *No contacts found on WhatsApp.*`);
        }

        // ── Send non-WhatsApp VCF ─────────────────────────────
        if (nowaCards.length) {
            await ctx.sock.sendMessage(ctx.from, {
                document: Buffer.from(nowaVcf, 'utf8'),
                mimetype: 'text/vcard',
                fileName: 'non_whatsapp_contacts.vcf',
                caption:
                    `❌ *Non-WhatsApp Contacts*\n` +
                    `${sep}\n\n` +
                    `📇 *${nowaCards.length} contact${nowaCards.length !== 1 ? 's' : ''}* not on WhatsApp\n\n` +
                    `_Original data preserved — no edits made._\n` +
                    `_${config.BOT_NAME}_`,
            }, { quoted: ctx.m });
        }

        await ctx.react('✅');
    },
});

// ══════════════════════════════════════════════════════════════
//  📱  WACHECK — check if number(s) are on WhatsApp
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'wacheck',
    aliases: ['checkwa', 'isonwa', 'numbercheck'],
    desc: 'Check if a phone number (or multiple, comma-separated) is on WhatsApp',
    usage: 'wacheck <number>  OR  wacheck <num1>,<num2>,<num3>',
    category: 'tools',
    handler: async (ctx) => {
        const input = (ctx.text || '').trim();
        if (!input)
            return ctx.reply(
                `📱 *WA Number Checker*\n\n` +
                `${sep}\n\n` +
                `*Single:*  \`${config.BOT_PREFIX}wacheck 254712345678\`\n` +
                `*Multiple:* \`${config.BOT_PREFIX}wacheck 254712345,254798765\`\n\n` +
                `_Include country code, no + or spaces needed._`
            );

        const nums = input
            .split(',')
            .map(n => n.trim().replace(/[^\d]/g, ''))
            .filter(n => n.length >= 6)
            .slice(0, 20);

        if (!nums.length)
            return ctx.reply(`❌ No valid numbers found. Include country code (e.g. 254712345678).`);

        await ctx.react('🔍');

        const jids    = nums.map(n => `${n}@s.whatsapp.net`);
        let   results = [];
        try { results = await ctx.sock.onWhatsApp(...jids) || []; }
        catch (e) { return ctx.reply(`❌ Check failed: ${e.message}`); }

        const waMap = new Map(results.map(r => [r.jid.split('@')[0].split(':')[0], r.exists]));

        let out = `📱 *WhatsApp Number Check*\n\n${sep}\n\n`;
        for (const n of nums) {
            const on = waMap.get(n);
            const ic = on === true ? '✅' : on === false ? '❌' : '❓';
            out += `${ic} \`+${n}\` — ${on === true ? 'On WhatsApp' : on === false ? 'Not on WhatsApp' : 'Unknown'}\n`;
        }
        out += `\n${sep}\n_${config.BOT_NAME}_`;

        await ctx.sock.sendMessage(ctx.from, { text: out, contextInfo: channelCtx() }, { quoted: ctx.m });
        await ctx.react('✅');
    },
});

// ══════════════════════════════════════════════════════════════
//  🖼️  GETPP — fetch any user's profile picture
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'getpp',
    aliases: ['profilepic', 'pfp', 'dp'],
    desc: 'Get the profile picture of any WhatsApp user or group',
    usage: 'getpp <number>  |  reply to someone  |  @mention',
    category: 'tools',
    handler: async (ctx) => {
        let jid;
        if (ctx.quoted?.sender)          jid = ctx.quoted.sender;
        else if (ctx.m?.mentioned?.[0])  jid = ctx.m.mentioned[0];
        else if (ctx.text) {
            const num = ctx.text.replace(/[^\d]/g, '');
            if (num) jid = `${num}@s.whatsapp.net`;
        }

        if (!jid)
            return ctx.reply(
                `🖼️ *Get Profile Picture*\n\n` +
                `Reply to someone's message, mention them, or pass a number:\n` +
                `\`${config.BOT_PREFIX}getpp 254712345678\``
            );

        await ctx.react('⏳');
        try {
            const pp = await ctx.sock.profilePictureUrl(jid, 'image');
            const num = jid.split('@')[0].split(':')[0];
            await ctx.send({
                image:   { url: pp },
                caption:
                    `🖼️ *Profile Picture*\n\n` +
                    `${sep}\n\n` +
                    `📞 *Number :* +${num}\n` +
                    `🔗 *JID    :* \`${jid}\`\n\n` +
                    `_${config.BOT_NAME}_`,
            });
            await ctx.react('✅');
        } catch {
            await ctx.react('❌');
            await ctx.reply(`❌ *No profile picture available.*\n\n_The user may have hidden their photo, or the number is not on WhatsApp._`);
        }
    },
});

// ══════════════════════════════════════════════════════════════
//  📝  GETSTATUS — fetch someone's WhatsApp about/status
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'getstatus',
    aliases: ['getabout', 'waabout', 'wabio'],
    desc: "Fetch any WhatsApp user's About / status text",
    usage: 'getstatus <number>  |  reply  |  @mention',
    category: 'tools',
    handler: async (ctx) => {
        let jid;
        if (ctx.quoted?.sender)          jid = ctx.quoted.sender;
        else if (ctx.m?.mentioned?.[0])  jid = ctx.m.mentioned[0];
        else if (ctx.text) {
            const num = ctx.text.replace(/[^\d]/g, '');
            if (num) jid = `${num}@s.whatsapp.net`;
        }

        if (!jid)
            return ctx.reply(
                `📝 *Get WhatsApp About*\n\n` +
                `Reply to someone, mention them, or pass a number:\n` +
                `\`${config.BOT_PREFIX}getstatus 254712345678\``
            );

        await ctx.react('🔍');
        try {
            const res    = await ctx.sock.fetchStatus(jid);
            const status = res?.status || res?.status?.status || null;
            const setAt  = res?.setAt ? new Date(res.setAt * 1000).toLocaleDateString('en-GB') : null;
            const num    = jid.split('@')[0].split(':')[0];

            await ctx.sock.sendMessage(ctx.from, {
                text:
                    `📝 *WhatsApp About*\n\n` +
                    `${sep}\n\n` +
                    `📞 *Number :* +${num}\n` +
                    (status
                        ? `💬 *About  :*\n_${status}_\n` +
                          (setAt ? `📅 *Set on  :* ${setAt}\n` : '')
                        : `💬 *About  :* _(empty / hidden)_\n`) +
                    `\n${sep}\n_${config.BOT_NAME}_`,
                contextInfo: channelCtx(),
            }, { quoted: ctx.m });
            await ctx.react('✅');
        } catch (e) {
            await ctx.react('❌');
            await ctx.reply(`❌ Could not fetch status: ${e.message}`);
        }
    },
});

// ══════════════════════════════════════════════════════════════
//  🔇  MUTECHAT / UNMUTECHAT — mute notifications for a chat
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'mutechat',
    aliases: ['mute', 'mutenotif'],
    desc: 'Mute notifications for the current chat (8h / 1week / always)',
    usage: 'mutechat <8h|1week|always>',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const DURATIONS = { '8h': 8 * 3600, '1week': 7 * 86400, 'always': -1 };
        const v = (ctx.args[0] || '').toLowerCase();
        if (!(v in DURATIONS))
            return ctx.reply(`🔇 Usage: \`${config.BOT_PREFIX}mutechat <8h|1week|always>\``);
        try {
            await ctx.sock.chatModify(
                { mute: DURATIONS[v] },
                ctx.from,
                [{ key: ctx.m.key, messageTimestamp: ctx.m.messageTimestamp }]
            );
            await ctx.reply(`🔇 Chat muted for *${v}*.`);
        } catch (e) { await ctx.reply(`❌ ${e.message}`); }
    },
});

addCmd({
    name: 'unmutechat',
    aliases: ['unmute', 'unmutenotif'],
    desc: 'Unmute notifications for the current chat',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        try {
            await ctx.sock.chatModify(
                { mute: null },
                ctx.from,
                [{ key: ctx.m.key, messageTimestamp: ctx.m.messageTimestamp }]
            );
            await ctx.reply(`🔔 Chat unmuted.`);
        } catch (e) { await ctx.reply(`❌ ${e.message}`); }
    },
});

// ══════════════════════════════════════════════════════════════
//  ℹ️  CHATINFO — detailed info about the current chat
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'chatinfo',
    aliases: ['whois', 'userinfo'],
    desc: 'Show info about the current chat or a replied-to user',
    category: 'tools',
    handler: async (ctx) => {
        const isGroup = ctx.from.endsWith('@g.us');
        await ctx.react('🔍');

        try {
            if (isGroup) {
                const meta = await ctx.sock.groupMetadata(ctx.from);
                const created = meta.creation
                    ? new Date(meta.creation * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—';
                let pp = '';
                try { pp = await ctx.sock.profilePictureUrl(ctx.from, 'image'); } catch {}

                const txt =
                    `👥 *GROUP INFO*\n\n` +
                    `${sep}\n\n` +
                    `📛 *Name        :* ${meta.subject}\n` +
                    `🆔 *ID          :* \`${ctx.from}\`\n` +
                    `📅 *Created     :* ${created}\n` +
                    `👑 *Owner       :* \`${meta.owner || '—'}\`\n` +
                    `👤 *Members     :* ${meta.participants?.length || 0}\n` +
                    `🔒 *Announce    :* ${meta.announce ? 'Yes (admin only)' : 'No'}\n` +
                    `📝 *Description :*\n_${meta.desc || '(none)'}_\n\n` +
                    `${sep}\n_${config.BOT_NAME}_`;

                if (pp) {
                    await ctx.send({ image: { url: pp }, caption: txt });
                } else {
                    await ctx.sock.sendMessage(ctx.from, { text: txt, contextInfo: channelCtx() }, { quoted: ctx.m });
                }

            } else {
                // DM — show info about the sender or quoted user
                const target = ctx.quoted?.sender || ctx.m.key.remoteJid;
                const num    = target.split('@')[0].split(':')[0];
                const jid    = `${num}@s.whatsapp.net`;

                let pp = '';
                let about = '';
                let waStatus = '❓ Unknown';
                try { pp = await ctx.sock.profilePictureUrl(jid, 'image'); } catch {}
                try {
                    const s = await ctx.sock.fetchStatus(jid);
                    about = s?.status || '';
                } catch {}
                try {
                    const r = await ctx.sock.onWhatsApp(`${num}@s.whatsapp.net`);
                    waStatus = r?.[0]?.exists ? '✅ On WhatsApp' : '❌ Not on WhatsApp';
                } catch {}

                const txt =
                    `🪪 *USER INFO*\n\n` +
                    `${sep}\n\n` +
                    `📞 *Number  :* +${num}\n` +
                    `🆔 *JID     :* \`${jid}\`\n` +
                    `📱 *Status  :* ${waStatus}\n` +
                    `📝 *About   :* ${about ? `_${about}_` : '_(hidden)_'}\n\n` +
                    `${sep}\n_${config.BOT_NAME}_`;

                if (pp) {
                    await ctx.send({ image: { url: pp }, caption: txt });
                } else {
                    await ctx.sock.sendMessage(ctx.from, { text: txt, contextInfo: channelCtx() }, { quoted: ctx.m });
                }
            }
            await ctx.react('✅');
        } catch (e) {
            await ctx.react('❌');
            await ctx.reply(`❌ Could not fetch chat info: ${e.message}`);
        }
    },
});

// ══════════════════════════════════════════════════════════════
//  📤  EXPORTVCF — export group members as a VCF contacts file
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'exportvcf',
    aliases: ['groupvcf', 'membersvcf', 'exportcontacts'],
    desc: 'Export all group members as a downloadable VCF contacts file',
    category: 'group',
    handler: async (ctx) => {
        if (!ctx.from.endsWith('@g.us'))
            return ctx.reply(`❌ This command only works inside a *group chat*.`);

        await ctx.react('⏳');
        try {
            const meta    = await ctx.sock.groupMetadata(ctx.from);
            const members = meta.participants || [];

            if (!members.length) return ctx.reply(`❌ No members found.`);

            // Build VCF — one vCard per member
            const cards = members.map((p, i) => {
                const num  = p.jid.split('@')[0].split(':')[0];
                const role = p.admin === 'superadmin' ? ' [Owner]' : p.admin === 'admin' ? ' [Admin]' : '';
                return [
                    'BEGIN:VCARD',
                    'VERSION:3.0',
                    `FN:+${num}${role}`,
                    `N:;+${num}${role};;;`,
                    `TEL;TYPE=CELL:+${num}`,
                    `NOTE:Exported from ${meta.subject} by ${config.BOT_NAME}`,
                    'END:VCARD',
                ].join('\r\n');
            });

            const vcfContent = cards.join('\r\n\r\n') + '\r\n';
            const filename   = `${meta.subject.replace(/[^a-z0-9]/gi, '_')}_members.vcf`;

            await ctx.sock.sendMessage(ctx.from, {
                document: Buffer.from(vcfContent, 'utf8'),
                mimetype: 'text/vcard',
                fileName: filename,
                caption:
                    `📤 *Group Members VCF*\n\n` +
                    `${sep}\n\n` +
                    `👥 *Group   :* ${meta.subject}\n` +
                    `📇 *Contacts:* ${members.length}\n\n` +
                    `_Import this file into your phone contacts._\n` +
                    `_${config.BOT_NAME}_`,
            }, { quoted: ctx.m });

            await ctx.react('✅');
        } catch (e) {
            await ctx.react('❌');
            await ctx.reply(`❌ Export failed: ${e.message}`);
        }
    },
});

// ══════════════════════════════════════════════════════════════
//  ♾️  DISAPPEARALL — enable disappearing messages for all new chats
// ══════════════════════════════════════════════════════════════
addCmd({
    name: 'disappearall',
    aliases: ['ephemeralall', 'autovanish'],
    desc: 'Enable disappearing messages for all new chats (off|24h|7d|90d)',
    usage: 'disappearall <off|24h|7d|90d>',
    category: 'owner',
    ownerOnly: true,
    handler: async (ctx) => {
        const TIMERS = { off: 0, '24h': 86400, '7d': 604800, '90d': 7776000 };
        const v = (ctx.args[0] || '').toLowerCase();
        if (!(v in TIMERS))
            return ctx.reply(
                `♾️ *Disappear All*\n\n` +
                `Set a default auto-delete timer for *all new chats:*\n\n` +
                `\`${config.BOT_PREFIX}disappearall off\` — Disable\n` +
                `\`${config.BOT_PREFIX}disappearall 24h\` — 24 Hours\n` +
                `\`${config.BOT_PREFIX}disappearall 7d\`  — 7 Days\n` +
                `\`${config.BOT_PREFIX}disappearall 90d\` — 90 Days`
            );
        try {
            await ctx.sock.updateDefaultDisappearingMode(TIMERS[v]);
            await ctx.reply(
                v === 'off'
                    ? `✅ Default disappearing messages *disabled* for new chats.`
                    : `✅ Default disappearing messages set to *${v}* for all new chats.`
            );
        } catch (e) { await ctx.reply(`❌ ${e.message}`); }
    },
});
