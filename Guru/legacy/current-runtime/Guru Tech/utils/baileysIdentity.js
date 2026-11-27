const PHONE_JID_SERVERS = new Set(['s.whatsapp.net', 'c.us'])

export function normalizeJid(value) {
  if (value === null || value === undefined) return null
  const jid = String(value).trim()
  if (!jid) return null
  const at = jid.lastIndexOf('@')
  if (at < 0) return jid
  const local = jid.slice(0, at).split(':')[0]
  const server = jid.slice(at + 1).toLowerCase()
  return local && server ? `${local}@${server}` : jid
}

export function isPhoneJid(value) {
  const jid = normalizeJid(value)
  if (!jid || !jid.includes('@')) return false
  return PHONE_JID_SERVERS.has(jid.slice(jid.lastIndexOf('@') + 1))
}

export function isLidJid(value) {
  const jid = normalizeJid(value)
  if (!jid || !jid.includes('@')) return false
  return jid.slice(jid.lastIndexOf('@') + 1).endsWith('lid')
}

export function isGroupJid(value) {
  const jid = normalizeJid(value)
  return Boolean(jid?.endsWith('@g.us'))
}

export function getPhoneNumber(value) {
  const jid = normalizeJid(value)
  if (!jid) return null
  if (jid.includes('@') && !isPhoneJid(jid)) return null
  const local = jid.includes('@') ? jid.slice(0, jid.lastIndexOf('@')) : jid
  const digits = local.replace(/\D/g, '')
  return digits || null
}

export function getLidJid(value) {
  const jid = normalizeJid(value)
  return isLidJid(jid) ? jid : null
}

export function formatPhoneJid(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (raw.includes('@')) return normalizeJid(raw)
  const digits = raw.replace(/\D/g, '')
  return digits ? `${digits}@s.whatsapp.net` : null
}

export function getMessageJidAliases(message, { selfJids = [] } = {}) {
  const key = message?.key || message || {}
  const values = []
  const add = value => {
    const jid = normalizeJid(value)
    if (!jid || isGroupJid(jid) || jid === 'status@broadcast' || values.includes(jid)) return
    values.push(jid)
  }

  if (key.fromMe) selfJids.forEach(add)
  add(key.participant)
  add(key.participantAlt)
  add(key.remoteJid)
  add(key.remoteJidAlt)
  return values
}

export function participantJidAliases(participant) {
  if (!participant) return []
  return [...new Set([
    participant.id,
    participant.jid,
    participant.lid,
    participant.phoneNumber,
    participant.phoneNumberJid
  ].map(normalizeJid).filter(Boolean))]
}

export function findGroupParticipant(participants, jid) {
  const target = normalizeJid(jid)
  if (!target) return null
  return (participants || []).find(participant => participantJidAliases(participant).includes(target)) || null
}
