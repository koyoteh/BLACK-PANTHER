import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'effectsmenu',
  aliases: ['effectlist', 'fxmenu', 'texteffects'],
  description: 'Displays the text-effects command table',
  run: async (context) => sendFolderMenu(context, 'Effects', 'FUN / EFFECTS')
};
