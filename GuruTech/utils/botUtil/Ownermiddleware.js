const Ownermiddleware = async (context, next) => {
    const { m, isLinkedOwner } = context;

    if (!isLinkedOwner) {
        return m.reply(`╭─❏ 「 Aᴄᴄᴇss Dᴇɴɪᴇᴅ」
│ Only the linked bot owner can use this command.\n│ Try again from the number linked to this session.
╰───────────────
> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
    }

    await next();
};

export default Ownermiddleware;
