export default async (context, next) => {
    const { m, isBotAdmin } = context;

    if (!m.isGroup) {
        return m.reply(`✦ ──『 Gʀᴏᴜᴘ Oɴʟʏ 』── ⚝
▢ This command only works in groups!\n▢ Private chat? For this? Pathetic.\n└──𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ──`);
    }

    if (!isBotAdmin) {
        return m.reply(`✦ ──『 Aᴅᴍɪɴ Rᴇϙᴜɪʀᴇᴅ 』── ⚝
▢ I need admin rights to get the group link!\n▢ Make me admin or watch me do nothing.\n└──𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ──`);
    }

    await next();
};