import { getCachedSettings } from './settingsCache.js';
import { updateSetting } from '../database/config.js';

export async function isUltraHosting() {
    const settings = await getCachedSettings();
    if (settings?.hostplatform === 'ultrahosting') return true;

    const marker = (process.env.ULTRA_HOSTING || '').toLowerCase().trim();
    const detected = marker === '1' || marker === 'true';

    if (detected) {
        try { await updateSetting('hostplatform', 'ultrahosting'); } catch {}
        return true;
    }

    return false;
}

export async function detectHostingPlatform(fallbackLabel) {
    const hosted = await isUltraHosting();
    return hosted ? 'BLACK PANTHER Hosting' : fallbackLabel;
}
