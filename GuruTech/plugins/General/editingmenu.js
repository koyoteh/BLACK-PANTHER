import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'editingmenu',
  aliases: ['editmenu'],
  description: 'Displays the editing and converter command table',
  run: async (context) => sendFolderMenu(context, 'Editing', 'CONVERTER / EDITING')
};
