import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFICIAL_WEBSITE, pantherThumbnailRibbonSvg } from './pantherStyle.js';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const BOT_IMAGE_PATH = path.resolve(LIB_DIR, '..', 'ultra-guru.jpg');
let cachedBotImage;
let botImageLoaded = false;

function getBundledBotImage() {
  if (!botImageLoaded) {
    botImageLoaded = true;
    try {
      cachedBotImage = fs.readFileSync(BOT_IMAGE_PATH);
    } catch {
      cachedBotImage = null;
    }
  }
  return cachedBotImage || null;
}

async function downloadImage(url) {
  if (typeof url !== 'string' || !url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType && !contentType.toLowerCase().startsWith('image/')) return null;
    const image = Buffer.from(await response.arrayBuffer());
    return image.length ? image : null;
  } catch {
    return null;
  }
}

export async function addWebsiteRibbon(image) {
  if (!Buffer.isBuffer(image) || image.length === 0) return image;
  try {
    const { default: sharp } = await import('sharp');
    const source = sharp(image, { failOn: 'none' });
    const metadata = await source.metadata();
    const width = Math.max(240, Number(metadata.width) || 640);
    const height = Math.max(160, Number(metadata.height) || 640);
    const ribbonWidth = Math.max(42, Math.min(74, Math.round(width * 0.14)));
    const ribbon = pantherThumbnailRibbonSvg(ribbonWidth, height);
    return await source
      .extend({ right: ribbonWidth, background: '#101820' })
      .composite([{ input: ribbon, left: width, top: 0 }])
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    return image;
  }
}

export function websitePreviewContext(thumbnail, body = 'Official BLACK-PANTHER website') {
  const image = Buffer.isBuffer(thumbnail) ? thumbnail : thumbnail?.buffer;
  return {
    showAdAttribution: false,
    title: 'BLACK PANTHER',
    body,
    sourceUrl: OFFICIAL_WEBSITE,
    ...(image?.length ? { thumbnail: image } : {}),
    mediaType: 1,
    renderLargerThumbnail: false
  };
}

async function getProfileImage(client, jid) {
  if (!jid || typeof client?.profilePictureUrl !== 'function') return null;
  try {
    const url = await client.profilePictureUrl(jid, 'image');
    const buffer = await downloadImage(url);
    return buffer ? { url, buffer: await addWebsiteRibbon(buffer), branded: true } : null;
  } catch {
    return null;
  }
}

export async function getUserOrBotThumbnail(client, senderJid) {
  const normalizeJid = (jid) => jid ? (client?.decodeJid?.(jid) || jid) : '';
  const botJid = normalizeJid(client?.user?.id);
  const userJid = normalizeJid(senderJid);
  const [botPicture, senderPicture] = await Promise.all([
    getProfileImage(client, botJid),
    userJid && userJid !== botJid ? getProfileImage(client, userJid) : Promise.resolve(null)
  ]);

  const bundledBotImage = getBundledBotImage();
  const brandedBundled = bundledBotImage ? await addWebsiteRibbon(bundledBotImage) : null;
  const bot = botPicture || (brandedBundled
    ? { url: '', buffer: brandedBundled, bundled: true, branded: true }
    : null);
  return {
    sender: senderPicture,
    bot,
    preferred: senderPicture || bot
  };
}
