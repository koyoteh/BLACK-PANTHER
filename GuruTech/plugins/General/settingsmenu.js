import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'settingsmenu',
  aliases: ['setmenu'],
  description: 'Displays the settings command table',
  run: async (context) => sendFolderMenu(context, 'Settings', 'SETTINGS')
};
