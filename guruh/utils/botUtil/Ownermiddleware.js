const Ownermiddleware = async (context, next) => {
    const { m, Owner, isOwner } = context;
    const isOwnerCheck = Owner || isOwner || m?.isOwner || m?.fromMe;

    if (!isOwnerCheck) {
        const chat = m?.chat || m?.from;
        const key  = m?.reactKey || m?.key;
        if (chat && context.client) {
            await context.client.sendMessage(chat, {
                text: `⚡ ──「 Aᴄᴄᴇss Dᴇɴɪᴇᴅ 」──\n▢ Owner-only command.\n▢ Only the *owner* can use this.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`,
            }, { quoted: m }).catch(() => {});
        }
        return;
    }

    await next();
};

export default Ownermiddleware;
