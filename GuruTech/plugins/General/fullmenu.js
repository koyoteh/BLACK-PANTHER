import { sendAllCategorizedMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'fullmenu',
  aliases: ['allmenu', 'commandslist', 'allcommands', 'fullcmds', 'fcmds', 'fm'],
  description: 'Displays every command grouped by category. You can also type .all menu.',
  run: async (context) => {
    const { client, m } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});
    await sendAllCategorizedMenu(context);
    await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
  }
};
