const URL_SCHEME_RE = /\b[a-z][a-z0-9+.-]{1,20}:\/\/[^\s<>"']+/giu;
const DOMAIN_RE = /(?<![\p{L}\p{N}@.-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59})(?::\d{1,5})?(?:[/?#][^\s<>"']*)?/giu;
const IPV4_RE = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:\/[^\s<>"']*)?/gu;
const WHATSAPP_INVITE_RE = /(?:\bchat\s*\.\s*whatsapp\s*\.\s*com\b|\bwhatsapp\s*\.\s*com\s*\/\s*(?:channel|invite|group|groups)\b|\bwhatsapp\s*\.\s*net\s*\/\s*(?:channel|invite)\b)/iu;

function cleanCandidate(candidate) {
  return String(candidate || '').trim().replace(/[),.!?;:]+$/u, '').replace(/[\]}]+$/u, '');
}

function normalizeObfuscatedLinks(text) {
  return String(text || '')
    .replace(/\bhxxps?/giu, (scheme) => scheme.toLowerCase().startsWith('hxxps') ? 'https' : 'http')
    .replace(/\s*\[(?:\.|dot)\]\s*|\s*\(\s*dot\s*\)\s*|\s+dot\s+/giu, '.')
    .replace(/\s*\[\.\]\s*/gu, '.')
    .replace(/\s*\[\s*:\s*\]\s*/gu, ':');
}

function collectStrings(value, output, seen, depth = 0) {
  if (value == null || depth > 8) return;
  if (typeof value === 'string') {
    output.push(value);
    return;
  }
  if (typeof value !== 'object' || Buffer.isBuffer(value) || ArrayBuffer.isView(value) || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output, seen, depth + 1);
    return;
  }
  for (const child of Object.values(value)) collectStrings(child, output, seen, depth + 1);
}

export function extractMessageText(message) {
  const pieces = [];
  collectStrings(message, pieces, new Set());
  return [...new Set(pieces)].join('\n');
}

export function hasForwardedContentMetadata(message) {
  const seen = new Set();
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 12 || Buffer.isBuffer(value) || ArrayBuffer.isView(value) || seen.has(value)) return false;
    seen.add(value);
    if (Array.isArray(value)) return value.some((item) => visit(item, depth + 1));

    const newsletterInfo = value.forwardedNewsletterMessageInfo;
    const newsletterJids = [value.remoteJid, value.newsletterJid, newsletterInfo?.newsletterJid, newsletterInfo?.jid];
    const hasNewsletterAttribution = Boolean(newsletterInfo) || newsletterJids.some((jid) => typeof jid === 'string' && jid.endsWith('@newsletter'));
    const isForwarded = value.isForwarded === true && Number(value.forwardingScore || 0) >= 1;
    if (hasNewsletterAttribution || isForwarded) return true;

    return Object.entries(value).some(([key, child]) => key !== 'quotedMessage' && visit(child, depth + 1));
  };
  return visit(message);
}

export function isStickerMessage(message) {
  let current = message || {};
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current.stickerMessage) return true;
    current = current.ephemeralMessage?.message
      || current.viewOnceMessage?.message
      || current.viewOnceMessageV2?.message
      || current.viewOnceMessageV2Extension?.message
      || current.documentWithCaptionMessage?.message
      || null;
  }
  return false;
}

export function extractLinkDomains(input) {
  const source = normalizeObfuscatedLinks(input);
  const candidates = new Set();
  for (const match of source.matchAll(URL_SCHEME_RE)) candidates.add(cleanCandidate(match[0]));
  for (const match of source.matchAll(DOMAIN_RE)) candidates.add(cleanCandidate(match[0]));
  for (const match of source.matchAll(IPV4_RE)) candidates.add(cleanCandidate(match[0]));

  const domains = [];
  for (const candidate of candidates) {
    try {
      const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//iu.test(candidate) ? candidate : `https://${candidate}`);
      if (parsed.hostname && parsed.hostname.includes('.')) domains.push(parsed.hostname.replace(/^www\./iu, '').toLowerCase());
    } catch {}
  }
  return [...new Set(domains)];
}

export function hasAnyLink(input) {
  const source = normalizeObfuscatedLinks(typeof input === 'string' ? input : extractMessageText(input));
  URL_SCHEME_RE.lastIndex = 0;
  DOMAIN_RE.lastIndex = 0;
  IPV4_RE.lastIndex = 0;
  const found = URL_SCHEME_RE.test(source) || DOMAIN_RE.test(source) || IPV4_RE.test(source);
  URL_SCHEME_RE.lastIndex = 0;
  DOMAIN_RE.lastIndex = 0;
  IPV4_RE.lastIndex = 0;
  return found;
}

export function hasWhatsAppInviteLink(input) {
  const source = normalizeObfuscatedLinks(typeof input === 'string' ? input : extractMessageText(input));
  return WHATSAPP_INVITE_RE.test(source);
}
