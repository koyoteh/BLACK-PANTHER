import { MESSAGES } from '../Guru/france/config.js'
import { getGroupRoles } from './groupSecurity.js'

const OWNER_ONLY_MESSAGE = '❌ This command is restricted to the bot owner.'
const ROLE_LOOKUP_ERROR = '❌ Could not read group permissions. Try again later.'

export async function getCommandPermissionFailure({ command, sock, from, senderJid, isGroup, isOwner }) {
  if (command?.ownerOnly && !isOwner) return OWNER_ONLY_MESSAGE

  const locallyChecked = Boolean(command?.permissionHandled)
  const needsSenderAdmin = Boolean(command?.adminOnly && !locallyChecked && isGroup && !isOwner)
  const needsBotAdmin = Boolean(command?.botAdminOnly && !locallyChecked && isGroup)
  if (!needsSenderAdmin && !needsBotAdmin) return null

  let roles
  try {
    roles = await getGroupRoles(sock, from, senderJid, { forceRefresh: true })
  } catch {
    return ROLE_LOOKUP_ERROR
  }

  if (needsSenderAdmin && !roles.senderIsAdmin) return MESSAGES.adminOnly || MESSAGES.ADMIN_ONLY_MSG
  if (needsBotAdmin && !roles.botIsAdmin) return MESSAGES.botAdminOnly || MESSAGES.BOT_ADMIN_ONLY_MSG
  return null
}
