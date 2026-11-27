import { sendCategoryMenu } from '../../lib/menuNavigation.js';

export default {
  name: 'logomenu',
  aliases: ['effectsmenu', 'effectslist', 'logolist'],
  description: 'Displays the logo command table',
  run: async (context) => sendCategoryMenu(context, 'logo')
};
