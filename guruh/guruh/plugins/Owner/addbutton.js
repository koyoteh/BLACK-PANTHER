import { getSettings } from '../../database/config.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
  name: 'addbutton',
  aliases: ['addbtn'],
  description: 'Adds a custom button to the menu',
  run: async (context) => {
    const { client, m, args } = context;
    try {
      if (args.length < 2) {
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
        await sendInteractive(client, m, `╭━⬣ 「 USAGE」
┃ .addbutton <button_name> <command>\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
        return;
      }
      const buttonName = args[0];
      const command = args[1];
      await sendInteractive(client, m, `╭━⬣ 「 BUTTON ADDED」
┃ Added button "${buttonName}"\n┃ for command "${command}"\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
    } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      console.error(`AddButton error: ${error.stack}`);
      await sendInteractive(client, m, `╭━⬣ 「 ERROR」
┃ Error adding custom button.\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
    }
  }
};
