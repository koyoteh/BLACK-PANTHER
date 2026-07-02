const Ownermiddleware = async (context, next) => {
    const { m, Owner, isOwner } = context;
    const isOwnerCheck = Owner || isOwner || m?.isOwner || m?.fromMe;

    if (!isOwnerCheck) {
        const chat = m?.chat || m?.from;
        const key  = m?.reactKey || m?.key;
        if (chat && context.client) {
            await context.client.sendMessage(chat, {
                text: `╭─❏ 「 Aᴄᴄᴇss Dᴇɴɪᴇᴅ 」\n│ Owner-only command.\n│ Only *GuruTech* can use this.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`,
            }, { quoted: m }).catch(() => {});
        }
        return;
    }

    await next();
};

export default Ownermiddleware;
