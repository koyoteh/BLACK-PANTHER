import middleware from '../../utils/botUtil/middleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await middleware(context, async () => {
        const { client, m, text, prefix, pict } = context;

        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
        const args = text.trim().split(/ +/);
        const command = args[0]?.toLowerCase() || '';
        const newText = args.slice(1).join(' ').trim();

        switch (command) {
            case 'setgroupname':
                if (!newText) {
                    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                    return m.reply(`⚡ ──「 USAGE 」──
▢ Yo, give me a new group name!\n▢ Usage: ${prefix}setgroupname <new name>\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                }
                if (newText.length > 100) {
                    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                    return m.reply(`⚡ ──「 ERROR 」──
▢ Group name can't be longer\n▢ than 100 characters, genius!\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                }

                try {
                    await client.groupUpdateSubject(m.chat, newText);
                    await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
                await sendInteractive(client, m, `⚡ ──「 UPDATED 」──
▢ Group name set to "${newText}".\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                    await sendInteractive(client, m, `⚡ ──「 FAILED 」──
▢ Failed to update group name.\n▢ Make sure I'm an admin.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                }
                break;

            case 'setgroupdesc':
                if (!newText) {
                    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                    return m.reply(`⚡ ──「 USAGE 」──
▢ Gimme a new description!\n▢ Usage: ${prefix}setgroupdesc <new description>\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                }

                try {
                    await client.groupUpdateDescription(m.chat, newText);
                    await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
                await sendInteractive(client, m, `⚡ ──「 UPDATED 」──
▢ Group description updated.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                    await sendInteractive(client, m, `⚡ ──「 FAILED 」──
▢ Couldn't update the description.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                }
                break;

            case 'setgrouprestrict':
                const action = newText.toLowerCase();
                if (!['on', 'off'].includes(action)) return m.reply(`⚡ ──「 USAGE 」──
▢ Usage: ${prefix}setgrouprestrict <on|off>\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);

                try {
                    const restrict = action === 'on';
                    await client.groupSettingUpdate(m.chat, restrict ? 'locked' : 'unlocked');
                    await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
                await sendInteractive(client, m, `⚡ ──「 UPDATED 」──
▢ Group editing is now\n▢ ${restrict ? 'locked to admins only' : 'open to all members'}.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
                    await sendInteractive(client, m, `⚡ ──「 FAILED 」──
▢ Failed to update group settings.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
                }
                break;

            default:
                await m.reply(`⚡ ──「 INVALID 」──
▢ Invalid groupmeta command!\n▢ Use ${prefix}setgroupname,\n▢ ${prefix}setgroupdesc, or\n▢ ${prefix}setgrouprestrict\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }
    });
};
