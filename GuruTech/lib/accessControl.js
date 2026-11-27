function phoneDigits(value) {
  const jid = String(value || '').trim();
  if (!jid || jid.endsWith('@lid')) return '';
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
}

export function isLinkedOwnerSender(sender, ownerNumber, { fromMe = false, botNumber = '' } = {}) {
  const bot = phoneDigits(botNumber);
  const owner = bot || phoneDigits(ownerNumber);
  if (!owner) return false;

  if (phoneDigits(sender) === owner) return true;
  return fromMe && bot === owner;
}

export function isCommandAllowedByMode(mode, {
  isLinkedOwner = false,
  isPrivileged = false,
  isGroup = false
} = {}) {
  const currentMode = String(mode || 'public').toLowerCase();
  if (currentMode === 'private') return isLinkedOwner;
  if (isLinkedOwner || isPrivileged) return true;
  if (currentMode === 'group') return isGroup;
  if (currentMode === 'inbox') return !isGroup;
  return true;
}

export function isLinkedOwnerOnlyPlugin(relativePluginPath) {
  return String(relativePluginPath || '')
    .replace(/\\/g, '/')
    .split('/')[0]
    ?.toLowerCase() === 'owner';
}

export function markLinkedOwnerOnly(run, relativePluginPath) {
  if (typeof run === 'function' && isLinkedOwnerOnlyPlugin(relativePluginPath)) {
    run.linkedOwnerOnly = true;
  }
  return run;
}
