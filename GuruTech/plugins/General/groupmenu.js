import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'groupmenu',
  aliases: ['grupmenu'],
  description: 'Displays the group command table',
  run: async (context) => sendFolderMenu(context, 'Groups', 'GROUP')
};
