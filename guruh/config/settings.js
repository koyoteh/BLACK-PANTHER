import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const _s = require('../../guru/config/settings.js');

export const botname      = _s.BOT_NAME      || 'BLACK PANTHER MD';
export const prefix       = _s.BOT_PREFIX    || '.';
export const ownerNumber  = _s.OWNER_NUMBER  || '254794703644';
export const ownerName    = _s.OWNER_NAME    || 'Putiny_🇷🇺KE';
export const session      = _s.SESSION_ID    || '';
export const mycode       = ownerNumber.replace(/\D/g, '').slice(0, 3) || '254';
export const herokuAppName = process.env.HEROKU_APP_NAME || '';
export function getHerokuApiKey() { return process.env.HEROKU_API_KEY || ''; }

export default _s;
