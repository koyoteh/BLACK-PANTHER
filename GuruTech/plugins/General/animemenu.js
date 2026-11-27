import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'animemenu',
  aliases: ['animmenu', 'animelist'],
  description: 'Displays the Anime command table',
  run: async (context) => sendFolderMenu(context, 'Anime', 'ANIME / ULTRA PICS')
};
