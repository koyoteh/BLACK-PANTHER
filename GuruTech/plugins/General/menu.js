import { sendMainMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'menu',
  aliases: ['commands', 'list', 'cmds', 'm', 'cmd', 'commandlist', 'allcmds'],
  description: 'Displays the numbered BLACK PANTHER category menu',
  run: async (context) => {
    const { client, m } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } }).catch(() => {});
    await sendMainMenu(context);
    await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
  }
};
