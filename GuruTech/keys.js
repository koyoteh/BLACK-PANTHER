const splitList = (value) => String(value || '').split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);

const numberedGroqKeys = Object.keys(process.env)
  .filter((name) => /^GROQ_KEY_\d+$/.test(name))
  .sort((a, b) => Number(a.slice(9)) - Number(b.slice(9)))
  .map((name) => process.env[name]);

export const GROQ_API_KEYS = Object.freeze([...new Set([
  ...splitList(process.env.GROQ_API_KEYS),
  process.env.GROQ_API_KEY,
  ...numberedGroqKeys
].filter(Boolean))]);
export const GROQ_API_KEY = GROQ_API_KEYS[0] || '';

let groqCursor = 0;
const failedGroqKeys = new Map();
export function getNextGroqKey() {
  if (!GROQ_API_KEYS.length) return null;
  const now = Date.now();
  for (let i = 0; i < GROQ_API_KEYS.length; i++) {
    const key = GROQ_API_KEYS[groqCursor++ % GROQ_API_KEYS.length];
    if ((failedGroqKeys.get(key) || 0) <= now) return key;
  }
  return GROQ_API_KEYS[0];
}
export function markKeyFailed(key) {
  if (key && GROQ_API_KEYS.includes(key)) failedGroqKeys.set(key, Date.now() + 60_000);
}

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
export const ULTRA_API_KEY = process.env.ULTRA_API_KEY || process.env.GIFTED_API_KEY || '';
export const ULTRA_API_FALLBACK = process.env.ULTRA_API_FALLBACK || '';
export const GOOGLE_CSE_API_KEY = process.env.GOOGLE_CSE_API_KEY || '';
export const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || '';
export const OMDB_API_KEY = process.env.OMDB_API_KEY || '';
export const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || '';
export const ACR_CLOUD_ACCESS_KEY = process.env.ACR_CLOUD_ACCESS_KEY || '';
export const ACR_CLOUD_ACCESS_SECRET = process.env.ACR_CLOUD_ACCESS_SECRET || '';
export const RYUU_API_KEY = process.env.RYUU_API_KEY || 'ryuu-apis-9c049100c28fc39e1791732697814';
export const ELLYTUBE_API_KEY = process.env.ELLYTUBE_API_KEY || 'Agustus2026';
export const SIDYCODERS_API_KEY = process.env.SIDYCODERS_API_KEY || 'memberdycoders';
export const FGSI_API_KEY = process.env.FGSI_API_KEY || '';
export const REMINI_API_KEY = process.env.REMINI_API_KEY || '';
export const TALKNOTES_SECRET = process.env.TALKNOTES_SECRET || '';
