import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'aimenu',
  aliases: ['aimenu'],
  description: 'Displays the AI command table',
  run: async (context) => sendFolderMenu(context, 'AI', 'AI')
};
