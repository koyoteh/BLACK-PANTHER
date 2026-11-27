import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'nsfwmenu',
  aliases: ['nsfwmenu'],
  description: 'Displays the NSFW command table',
  run: async (context) => sendFolderMenu(context, 'NSFW', 'FUN / NSFW')
};
