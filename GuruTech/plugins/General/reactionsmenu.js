import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'reactionsmenu',
  aliases: ['reactmenu', 'reactionlist'],
  description: 'Displays the reaction command table',
  run: async (context) => sendFolderMenu(context, 'Reactions', 'FUN / REACTIONS')
};
