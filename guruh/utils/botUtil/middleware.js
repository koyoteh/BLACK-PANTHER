const DEV_NUMBER = '254116284050';

const normalizeNumber = (jid) => {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0].replace(/\D/g, '') + '@s.whatsapp.net';
};

const middleware = async (context, next) => {
    const { m, isBotAdmin, client } = context;
    const isDev = normalizeNumber(m.sender) === normalizeNumber(DEV_NUMBER);

    if (!m.isGroup) {
        return m.reply(`✦ ──『 Gʀᴏᴜᴘ Oɴʟʏ 』── ⚝
▢ This command isn't for lone wolves.\n▢ Try again in a group, you loner.\n└──𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ──`);
    }
    if (!isDev && !context.isAdmin) {
        return m.reply(`✦ ──『 Nᴏᴛ Aᴅᴍɪɴ 』── ⚝
▢ You think you're worthy?\n▢ Admin privileges are required—\n▢ go beg for them, peasant.\n└──𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ──`);
    }

    let resolvedIsBotAdmin = isBotAdmin;

    if (!resolvedIsBotAdmin && m.isGroup && client) {
        try {
            const botRawJid = client.user?.id || '';
            const botNum = botRawJid.split('@')[0].split(':')[0].replace(/\D/g, '');
            const meta = await client.groupMetadata(m.chat);
            const participants = meta?.participants || [];
            for (const p of participants) {
                const pJid = p.id || p.jid || '';
                const pNum = pJid.split('@')[0].split(':')[0].replace(/\D/g, '');
                const isAdminRole = p.admin === 'admin' || p.admin === 'superadmin';
                if (isAdminRole && pNum && botNum && (pNum === botNum || pNum.endsWith(botNum) || botNum.endsWith(pNum))) {
                    resolvedIsBotAdmin = true;
                    break;
                }
            }
        } catch {}
    }

    if (!resolvedIsBotAdmin) {
        return m.reply(`✦ ──『 Bᴏᴛ Nᴏᴛ Aᴅᴍɪɴ 』── ⚝
▢ I need admin rights to obey,\n▢ unlike you who blindly follows.\n▢ Make me admin first, idiot.\n└──𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ──`);
    }

    await next();
};

export default middleware;
