import { sendFolderMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'downloadmenu',
  aliases: ['dlmenu'],
  description: 'Displays the download command table',
  run: async (context) => sendFolderMenu(context, 'Downloads', 'DOWNLOADER')
};
