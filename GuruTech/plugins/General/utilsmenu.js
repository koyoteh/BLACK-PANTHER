import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'utilsmenu',
  aliases: ['utils'],
  description: 'Displays the utility command table',
  run: async (context) => sendFolderMenu(context, 'Utils', 'UTILITY')
};
