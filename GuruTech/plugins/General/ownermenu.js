import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'ownermenu',
  aliases: ['ownercmds'],
  description: 'Displays the owner command table',
  run: async (context) => sendFolderMenu(context, 'Owner', 'OWNER')
};
