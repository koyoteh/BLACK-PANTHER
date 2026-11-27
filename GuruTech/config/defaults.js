const VALID_BOT_MODES = new Set(['public', 'private', 'group', 'inbox']);
const ENV_BOT_MODE = String(process.env.BOT_MODE || 'public').trim().toLowerCase();

export const DEFAULT_SETTINGS = Object.freeze({
  device: 'default',
  prefix: '.',
  mode: VALID_BOT_MODES.has(ENV_BOT_MODE) ? ENV_BOT_MODE : 'public',
  botname: 'BLACK PANTHER',
  startmessage: true,
  chatbotpm: false,
  autoview: true,
  autolike: true,
  autolikeemoji: 'random',
  autoread: false,
  antidelete: false,
  stealth: false,
  autoai: false,
  ultraai: false,
  anticall: false,
  antiviewonce: false,
  antiedit: false,
  gcpresence: false,
  antitag: false,
  antilink: 'off',
  multiprefix: false,
  warn_limit: 3,
  autobio: false,
  presence: 'online',
  autoreact: false,
  packname: 'BLACK PANTHER',
  author: 'BLACK PANTHER'
});

export function mergeSettings(saved = {}) {
  const values = saved && typeof saved === 'object' ? { ...saved } : {};
  return { ...DEFAULT_SETTINGS, ...values };
}
