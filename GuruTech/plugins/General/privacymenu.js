import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'privacymenu',
  aliases: ['privmenu'],
  description: 'Displays the privacy and user command table',
  run: async (context) => sendFolderMenu(context, 'Privacy', 'USER / PRIVACY')
};
