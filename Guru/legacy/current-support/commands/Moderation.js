import {
  addGroupReport,
  clearGroupReports,
  clearGroupWarnings,
  getGroupRoles,
  getGroupSecurity,
  normalizeJid,
  recordGroupWarning,
  updateGroupSecurity
} from '../../Guru Tech/groupSecurity.js'
import { isLidJid } from '../../Guru Tech/utils/baileysIdentity.js'

function getContext(msg) {
  const m = msg?.message || {}
  return m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo || m.documentMessage?.contextInfo || null
}

function targetsFrom(msg, text = '') {
  const context = getContext(msg)
  const targets = [
    ...(Array.isArray(context?.mentionedJid) ? context.mentionedJid : []),
    context?.participant,
    ...(String(text).match(/(?:^|\s)@?(\d{7,20})(?=\s|$)/g) || []).map(value => value.trim().replace(/^@/, '') + '@s.whatsapp.net')
  ].filter(Boolean).map(normalizeJid)
  return [...new Set(targets)]
}

async function requireGroup({ sock, from, msg, sender, isOwner, admin = false }) {
  if (!from?.endsWith('@g.us')) {
    await sock.sendMessage(from, { text: 'This command only works in a WhatsApp group.' }, { quoted: msg })
    return null
  }
  let roles
  try { roles = await getGroupRoles(sock, from, sender) }
  catch {
    await sock.sendMessage(from, { text: '❌ Could not read group permissions. Try again later.' }, { quoted: msg })
    return null
  }
  if (admin && !isOwner && !roles.senderIsAdmin) {
    await sock.sendMessage(from, { text: '❌ Only group admins or the bot owner can use this setting.' }, { quoted: msg })
    return null
  }
  return roles
}

function plainArgs(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean)
}

function showAntibot(state) {
  const list = state.antiBot.botJids || []
  const action = state.antiBot.action || 'kick'
  return `🛡️ Anti-bot: *${state.antiBot.enabled ? 'ON' : 'OFF'}*\nAction: *${action.toUpperCase()}*\nManually registered bots: *${list.length}*\n\nWhen ON with KICK, non-admins are kicked for sending bot commands (including BLACK PANTHER commands) or for being a registered bot; admins are exempt. DELETE mode removes unknown/external commands, replies to them, and messages from registered bot accounts. Use .antibot on [kick|delete] or .antibot add @bot.`
}

export const commands = [
  {
    name: 'antibot',
    aliases: ['anti-bot', 'botguard'],
    description: 'Group admins: kick or delete non-admin bot-command senders and registered bot accounts.',
    category: 'Group', groupOnly: true, adminOnly: true,
    execute: async ({ sock, from, msg, sender, isOwner, text }) => {
      const roles = await requireGroup({ sock, from, msg, sender, isOwner, admin: true })
      if (!roles) return
      const args = plainArgs(text)
      const action = (args[0] || 'status').toLowerCase()
      let state = getGroupSecurity(from)
      if (action === 'status') return sock.sendMessage(from, { text: showAntibot(state) }, { quoted: msg })
      if (action === 'on' || action === 'off') {
        const selectedAction = (args[1] || state.antiBot.action || 'kick').toLowerCase()
        if (action === 'on' && !['kick', 'delete'].includes(selectedAction)) return sock.sendMessage(from, { text: 'Choose an action: kick or delete.' }, { quoted: msg })
        if (action === 'on' && !roles.botIsAdmin) return sock.sendMessage(from, { text: '❌ Make BLACK PANTHER a group admin first so it can delete messages and kick non-admin bot-command senders.' }, { quoted: msg })
        state = await updateGroupSecurity(from, current => {
          current.antiBot.enabled = action === 'on'
          if (action === 'on') current.antiBot.action = selectedAction
        })
        const detail = action === 'on' && state.antiBot.action === 'kick'
          ? ' Non-admins who send any recognized bot command prefix—including BLACK PANTHER commands—will be kicked; group admins are exempt.'
          : action === 'on' ? ' Detected external bot commands and registered bot accounts will have their messages deleted.' : ''
        return sock.sendMessage(from, { text: `✅ Anti-bot is now *${action.toUpperCase()}*${action === 'on' ? ` (action ${state.antiBot.action.toUpperCase()}).${detail}` : '.'} Use .antibot add @bot to register a bot account.` }, { quoted: msg })
      }
      if (action === 'add' || action === 'remove') {
        const targets = targetsFrom(msg, args.slice(1).join(' '))
        if (!targets.length) return sock.sendMessage(from, { text: `Usage: .antibot ${action} @bot (mention the suspected bot account).` }, { quoted: msg })
        state = await updateGroupSecurity(from, current => {
          const currentBots = new Set((current.antiBot.botJids || []).map(normalizeJid))
          for (const jid of targets) action === 'add' ? currentBots.add(jid) : currentBots.delete(jid)
          current.antiBot.botJids = [...currentBots].slice(0, 100)
        })
        return sock.sendMessage(from, { text: `✅ ${targets.length} account(s) ${action === 'add' ? 'added to' : 'removed from'} the anti-bot list. Registered: ${state.antiBot.botJids.length}.`, mentions: targets }, { quoted: msg })
      }
      if (action === 'list') {
        const bots = state.antiBot.botJids || []
        return sock.sendMessage(from, { text: bots.length ? `*Registered bot accounts*\n${bots.map((jid, i) => `${i + 1}. @${jid.split('@')[0]}`).join('\n')}` : 'No bot accounts are registered. Use .antibot add @bot.', mentions: bots }, { quoted: msg })
      }
      return sock.sendMessage(from, { text: 'Usage: .antibot on [kick|delete] | off | status | add @bot | remove @bot | list' }, { quoted: msg })
    }
  },
  {
    name: 'antilink',
    aliases: ['anti-link'],
    description: 'Group admins: configure link filtering, sensitivity, action, and trusted domains.',
    category: 'Group', groupOnly: true, adminOnly: true,
    execute: async ({ sock, from, msg, sender, isOwner, text }) => {
      const roles = await requireGroup({ sock, from, msg, sender, isOwner, admin: true })
      if (!roles) return
      const args = plainArgs(text)
      const action = (args[0] || 'status').toLowerCase()
      let state = getGroupSecurity(from)
      if (action === 'status') {
        const link = state.antiLink
        return sock.sendMessage(from, { text: `🔗 Anti-link: *${link.enabled ? 'ON' : 'OFF'}*\nSensitivity: *${link.sensitivity.toUpperCase()}*\nAction: *${link.action.toUpperCase()}*\nTrusted domains: ${(link.allowedDomains || []).join(', ') || 'none'}\n\nUsage: .antilink on [warn|delete|kick] | off | level normal|high|strict | allow domain | unallow domain` }, { quoted: msg })
      }
      if (action === 'on' || action === 'off') {
        const requestedAction = (args[1] || '').toLowerCase()
        const selectedAction = requestedAction || (roles.botIsAdmin ? state.antiLink.action || 'delete' : 'warn')
        if (action === 'on' && !['warn', 'delete', 'kick'].includes(selectedAction)) return sock.sendMessage(from, { text: 'Choose an action: warn, delete, or kick.' }, { quoted: msg })
        if (action === 'on' && selectedAction !== 'warn' && !roles.botIsAdmin) return sock.sendMessage(from, { text: '❌ Make BLACK PANTHER a group admin before enabling link deletion or kick actions.' }, { quoted: msg })
        state = await updateGroupSecurity(from, current => {
          current.antiLink.enabled = action === 'on'
          if (action === 'on') { current.antiLink.action = selectedAction; current.antiLink.sensitivity ||= 'high' }
        })
        const permissionNote = action === 'on' && !roles.botIsAdmin && state.antiLink.action === 'warn'
          ? ' BLACK PANTHER is not a group admin, so it can warn but cannot remove links. Make it admin and use .antilink on delete to remove them.'
          : ''
        return sock.sendMessage(from, { text: `✅ Anti-link is *${action.toUpperCase()}*${action === 'on' ? ` (sensitivity ${state.antiLink.sensitivity.toUpperCase()}, action ${state.antiLink.action.toUpperCase()}).` : '.'}${permissionNote}` }, { quoted: msg })
      }
      if (action === 'level' || action === 'sensitivity') {
        const level = (args[1] || '').toLowerCase()
        if (!['normal', 'high', 'strict'].includes(level)) return sock.sendMessage(from, { text: 'Usage: .antilink level normal|high|strict. Use strict for obfuscated links such as hxxps, [dot], or spaced dots.' }, { quoted: msg })
        await updateGroupSecurity(from, current => { current.antiLink.sensitivity = level })
        return sock.sendMessage(from, { text: `✅ Anti-link sensitivity set to *${level.toUpperCase()}*.` }, { quoted: msg })
      }
      if (action === 'allow' || action === 'unallow') {
        const domain = String(args[1] || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
        if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain)) return sock.sendMessage(from, { text: `Usage: .antilink ${action} example.com` }, { quoted: msg })
        state = await updateGroupSecurity(from, current => {
          const list = new Set(current.antiLink.allowedDomains || [])
          action === 'allow' ? list.add(domain) : list.delete(domain)
          current.antiLink.allowedDomains = [...list].slice(0, 100)
        })
        return sock.sendMessage(from, { text: `✅ ${domain} ${action === 'allow' ? 'added to' : 'removed from'} the trusted-domain list.` }, { quoted: msg })
      }
      return sock.sendMessage(from, { text: 'Usage: .antilink on [warn|delete|kick] | off | status | level normal|high|strict | allow domain | unallow domain' }, { quoted: msg })
    }
  },
  {
    name: 'warn', aliases: ['warning'], description: 'Group admins: record a warning for a member.', category: 'Group', groupOnly: true, adminOnly: true,
    execute: async ({ sock, from, msg, sender, isOwner, text }) => {
      if (!await requireGroup({ sock, from, msg, sender, isOwner, admin: true })) return
      const target = targetsFrom(msg, text)[0]
      if (!target) return sock.sendMessage(from, { text: 'Usage: .warn @member [reason]' }, { quoted: msg })
      const reason = String(text || '').replace(/@\d{7,20}/g, '').trim() || 'Group rule violation'
      const rows = await recordGroupWarning(from, target, { by: sender, reason })
      await sock.sendMessage(from, { text: `⚠️ @${target.split('@')[0]} received warning #${rows.length}.\nReason: ${reason}`, mentions: [target] }, { quoted: msg })
    }
  },
  {
    name: 'warnings', aliases: ['warns'], description: 'Group admins: view a member’s warning history.', category: 'Group', groupOnly: true, adminOnly: true,
    execute: async ({ sock, from, msg, sender, isOwner, text }) => {
      if (!await requireGroup({ sock, from, msg, sender, isOwner, admin: true })) return
      const target = targetsFrom(msg, text)[0] || sender
      const rows = getGroupSecurity(from).warnings[normalizeJid(target)] || []
      const list = rows.map((row, i) => `${i + 1}. ${new Date(row.at).toISOString().slice(0, 10)} — ${row.reason}`).join('\n')
      return sock.sendMessage(from, { text: rows.length ? `Warnings for @${target.split('@')[0]} (${rows.length}):\n${list}` : `No warnings are recorded for @${target.split('@')[0]}.`, mentions: [target] }, { quoted: msg })
    }
  },
  {
    name: 'clearwarn', aliases: ['resetwarn'], description: 'Group admins: clear a member’s warnings.', category: 'Group', groupOnly: true, adminOnly: true,
    execute: async ({ sock, from, msg, sender, isOwner, text }) => {
      if (!await requireGroup({ sock, from, msg, sender, isOwner, admin: true })) return
      const target = targetsFrom(msg, text)[0]
      if (!target) return sock.sendMessage(from, { text: 'Usage: .clearwarn @member' }, { quoted: msg })
      await clearGroupWarnings(from, target)
      return sock.sendMessage(from, { text: `✅ Cleared warnings for @${target.split('@')[0]}.`, mentions: [target] }, { quoted: msg })
    }
  },
  {
    name: 'slowmode', aliases: ['slow'], description: 'Group admins: limit how often non-admin members can post.', category: 'Group', groupOnly: true, adminOnly: true,
    execute: async ({ sock, from, msg, sender, isOwner, text }) => {
      const roles = await requireGroup({ sock, from, msg, sender, isOwner, admin: true })
      if (!roles) return
      const value = String(text || '').trim().toLowerCase()
      if (value === 'off' || value === '0') {
        await updateGroupSecurity(from, state => { state.slowmodeSeconds = 0 })
        return sock.sendMessage(from, { text: '✅ Slow mode is off.' }, { quoted: msg })
      }
      const seconds = Number(value)
      if (!Number.isInteger(seconds) || seconds < 5 || seconds > 3600) return sock.sendMessage(from, { text: 'Usage: .slowmode 5–3600 (seconds), or .slowmode off' }, { quoted: msg })
      if (!roles.botIsAdmin) return sock.sendMessage(from, { text: '❌ Make BLACK PANTHER a group admin first so it can remove messages posted during slow mode.' }, { quoted: msg })
      await updateGroupSecurity(from, state => { state.slowmodeSeconds = seconds })
      return sock.sendMessage(from, { text: `✅ Slow mode set to one message every ${seconds} seconds for non-admin members.` }, { quoted: msg })
    }
  },
  {
    name: 'setrules', aliases: ['grouprules'], description: 'Group admins: set or replace the group rules.', category: 'Group', groupOnly: true, adminOnly: true,
    execute: async ({ sock, from, msg, sender, isOwner, text }) => {
      if (!await requireGroup({ sock, from, msg, sender, isOwner, admin: true })) return
      const rules = String(text || '').trim()
      if (!rules) return sock.sendMessage(from, { text: 'Usage: .setrules Write the group rules here' }, { quoted: msg })
      if (rules.length > 1500) return sock.sendMessage(from, { text: 'Rules are limited to 1,500 characters.' }, { quoted: msg })
      await updateGroupSecurity(from, state => { state.rules = rules })
      return sock.sendMessage(from, { text: '✅ Group rules saved. Members can view them with .rules.' }, { quoted: msg })
    }
  },
  {
    name: 'rules', aliases: ['grouprule'], description: 'Show the current group rules.', category: 'Group', groupOnly: true,
    execute: async ({ sock, from, msg }) => {
      if (!from?.endsWith('@g.us')) return sock.sendMessage(from, { text: 'This command only works in a group.' }, { quoted: msg })
      const rules = getGroupSecurity(from).rules
      return sock.sendMessage(from, { text: rules ? `📜 *GROUP RULES*\n\n${rules}` : 'No group rules have been set yet. Admins can use .setrules.' }, { quoted: msg })
    }
  },
  {
    name: 'report', aliases: ['reportadmin'], description: 'Privately report a group issue to the group admins.', category: 'Group', groupOnly: true,
    execute: async ({ sock, from, msg, sender, text }) => {
      if (!from?.endsWith('@g.us')) return sock.sendMessage(from, { text: 'Use .report inside the group you are reporting.' }, { quoted: msg })
      const reportText = String(text || '').trim()
      if (reportText.length < 3) return sock.sendMessage(from, { text: 'Usage: .report Describe the issue for the group admins.' }, { quoted: msg })
      let metadata
      try { metadata = await sock.groupMetadata(from) }
      catch { return sock.sendMessage(from, { text: '❌ Could not contact the group admins right now.' }, { quoted: msg }) }
      const admins = (metadata.participants || []).filter(p => p.admin).map(p => normalizeJid(p.phoneNumber || p.id || p.lid)).filter(Boolean)
      const botJids = new Set([sock.user?.id, sock.user?.lid].filter(Boolean).map(normalizeJid))
      const uniqueAdmins = [...new Set(admins)].filter(jid => !botJids.has(jid))
      if (!uniqueAdmins.length) return sock.sendMessage(from, { text: '❌ No reachable group admins were found.' }, { quoted: msg })
      const report = await addGroupReport(from, { reporter: sender, text: reportText })
      let delivered = 0
      for (const adminJid of uniqueAdmins) {
        try {
          await sock.sendMessage(adminJid, { text: `📥 *GROUP REPORT ${report.id}*\nGroup: ${metadata.subject || from}\nFrom: @${String(sender || '').split('@')[0]}\n\n${reportText}\n\nUse .inbox in the group to review reports.`, mentions: sender ? [sender] : [] })
          delivered++
        } catch { /* report remains in the group inbox for admins to retrieve */ }
      }
      return sock.sendMessage(from, { text: `✅ Your report was saved to the group admin inbox${delivered ? ' and sent privately to the admins' : ''}. Reference: ${report.id}.`, quoted: msg })
    }
  },
  {
    name: 'inbox', aliases: ['reports'], description: 'Group admins: review or clear member reports for this group.', category: 'Group', groupOnly: true, adminOnly: true,
    execute: async ({ sock, from, msg, sender, isOwner, text }) => {
      if (!await requireGroup({ sock, from, msg, sender, isOwner, admin: true })) return
      const action = String(text || '').trim().toLowerCase()
      if (action === 'clear') {
        await clearGroupReports(from)
        return sock.sendMessage(from, { text: '✅ Group report inbox cleared.' }, { quoted: msg })
      }
      const reports = getGroupSecurity(from).reports.slice(-10).reverse()
      if (!reports.length) return sock.sendMessage(from, { text: '📥 No reports are waiting in this group inbox.' }, { quoted: msg })
      const lines = reports.map(row => `• ${row.id} — @${row.reporter.split('@')[0]} — ${new Date(row.at).toISOString().replace('T', ' ').slice(0, 16)}\n  ${row.text.replace(/\s+/g, ' ').slice(0, 180)}`)
      const recipient = normalizeJid(sender)
      if (!recipient) return sock.sendMessage(from, { text: '❌ Could not identify your private inbox address.' }, { quoted: msg })
      try {
        await sock.sendMessage(recipient, { text: `📥 *GROUP INBOX — ${reports.length} latest report(s)*\n\n${lines.join('\n')}`, mentions: reports.map(row => row.reporter) })
        return sock.sendMessage(from, { text: '📥 The latest group reports were sent privately to your inbox.' }, { quoted: msg })
      } catch {
        return sock.sendMessage(from, { text: '❌ I could not deliver the inbox to your private chat. Start a private chat with the bot, then try again.' }, { quoted: msg })
      }
    }
  },
  {
    name: 'admins', aliases: ['gadmins', 'adminlist'], description: 'List and mention the current group admins.', category: 'Group', groupOnly: true,
    execute: async ({ sock, from, msg }) => {
      if (!from?.endsWith('@g.us')) return sock.sendMessage(from, { text: 'This command only works in a group.' }, { quoted: msg })
      try {
        const metadata = await sock.groupMetadata(from)
        const admins = (metadata.participants || []).filter(p => p.admin)
        if (!admins.length) return sock.sendMessage(from, { text: 'No group admins were returned.' }, { quoted: msg })
        const ids = admins.map(p => normalizeJid(p.id || p.lid || p.phoneNumber)).filter(Boolean)
        const rows = admins.map((p, i) => {
          const jid = normalizeJid(p.id || p.lid || p.phoneNumber)
          const label = jid ? `${jid.split('@')[0]}${isLidJid(jid) ? ' (LID)' : ''}` : 'Unknown'
          return `${i + 1}. @${label}`
        }).join('\n')
        return sock.sendMessage(from, { text: `👮 *${metadata.subject || 'Group'} ADMINS*\n${rows}`, mentions: ids }, { quoted: msg })
      } catch {
        return sock.sendMessage(from, { text: '❌ Could not read group admins.' }, { quoted: msg })
      }
    }
  }
].map(command => command.adminOnly ? { ...command, permissionHandled: true } : command)
