function digitsFrom(value) {
  return String(value || '').split('@')[0].split(':')[0].replace(/\D/gu, '');
}

export function isKenyanPhoneNumber(value) {
  const digits = digitsFrom(value);
  return /^(?:254\d{9}|0\d{9}|[17]\d{8})$/u.test(digits);
}

export function getKenyanModerationTag(target, action) {
  if (!isKenyanPhoneNumber(target)) return null;
  if (action === 'kick') return 'Manyoya wewe 😎';
  if (action === 'warn' || action === 'owner') return "usikue nyan'ganya mkuu🫴😅";
  return null;
}

export function getKenyanModerationTagForResponse(content, commandName = '') {
  const textParts = [];
  const mentions = [];
  const seen = new Set();
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 8 || Buffer.isBuffer(value) || ArrayBuffer.isView(value) || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (typeof value.text === 'string') textParts.push(value.text);
    if (typeof value.caption === 'string') textParts.push(value.caption);
    if (Array.isArray(value.mentions)) mentions.push(...value.mentions);
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') visit(child, depth + 1);
    }
  };
  if (typeof content === 'string') textParts.push(content);
  else visit(content);
  const text = textParts.join('\n');
  const targetList = [...mentions];
  for (const match of text.matchAll(/@\+?[\d().\-\s]{7,20}/gu)) targetList.push(match[0].slice(1).trim());
  const target = targetList.find(isKenyanPhoneNumber);
  if (!target) return null;

  const command = String(commandName || '').toLowerCase().replace(/^[/!.#]+/u, '');
  if (/\b(?:could not|couldn't|failed|unable|not permitted|can't)\b/iu.test(text)) return null;
  const ownerNotice = /\bowner\b/iu.test(text) && /\b(?:only|notify|notified|alert|alerted|inform|informed|tell|told)\b/iu.test(text);
  if (ownerNotice) return { action: 'owner', tag: getKenyanModerationTag(target, 'owner') };
  const isKick = /^(?:remove|kick|yeet|boot|xkill|removemember)$/u.test(command) || /\b(?:kicked|removed|yeeted|booted)\b/iu.test(text);
  const autoKickForWarnLimit = /\b(?:hit|reached|exceeded)\b[^\n]*\bwarns?\b[\s\S]{0,80}\b(?:bye|out|removed|kicked|door)\b/iu.test(text);
  if ((isKick || autoKickForWarnLimit) && /\b(?:kicked|removed|yeeted|booted|success|out|bye)\b/iu.test(text)) {
    return { action: 'kick', tag: getKenyanModerationTag(target, 'kick') };
  }
  const isWarn = /^(?:warn|warns|warnlist)$/u.test(command) || /\bwarn(?:ed|ing|s)?\b/iu.test(text);
  if (isWarn && /\b(?:warn(?:ed|ing|s)?|warning)\b/iu.test(text)) {
    return { action: 'warn', tag: getKenyanModerationTag(target, 'warn') };
  }
  return null;
}
