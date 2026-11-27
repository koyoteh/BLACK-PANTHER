import { getPhoneNumber, isGroupJid, normalizeJid } from './baileysIdentity.js'

export { isGroupJid, normalizeJid }

export function getUserNumber(jid) {
  return getPhoneNumber(jid)
}
