import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'generalmenu',
  aliases: ['genmenu'],
  description: 'Displays the general command table',
  run: async (context) => sendFolderMenu(context, 'General', 'GENERAL')
};
