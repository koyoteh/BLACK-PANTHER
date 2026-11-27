import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'herokumenu',
  aliases: ['heroku'],
  description: 'Displays the hosting and owner command table',
  run: async (context) => sendFolderMenu(context, 'Heroku', 'OWNER / HOSTING')
};
