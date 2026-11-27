const SESSION_ID = process.env.SESSION_ID || process.env.SESSION || '';
const session = SESSION_ID;
const OWNER_NUMBER = String(process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const mycode = process.env.CODE || OWNER_NUMBER.slice(0, 3) || '';
const botname = process.env.BOTNAME || 'BLACK PANTHER';
const herokuAppName = process.env.HEROKU_APP_NAME || '';

function getHerokuApiKey() {
    return process.env.HEROKU_API_KEY || '';
}

export { SESSION_ID, session, OWNER_NUMBER, mycode, botname, herokuAppName, getHerokuApiKey };
