import { getGroupSettings, getGroupSettingsFresh, updateGroupSetting, getWarnLimit } from '../../database/config.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

const VALID_MODES = ['off', 'delete', 'warn', 'kick'];
const fmt = (msg) => `╭─❏ 「 ANTIPROMO 」\n│ ${msg}\n╰───────────────`;

export default {
    name: 'antipromo',
    aliases: ['businessfilter', 'antibusiness', 'antiscam'],
    description: 'Detect promotional business and income-hype spam in groups. Usage: .antipromo warn|delete|kick|off',
    run: async (context) => {
        const { client, m, args = [], prefix = '.' } = context;
        if (!m.chat?.endsWith('@g.us')) {
            return sendInteractive(client, m, fmt('This protection is available in groups only.'));
        }
        if (!(context.isAdmin || m.isAdmin)) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, fmt('Only group admins can configure this filter.'));
        }

        const settings = await getGroupSettings(m.chat);
        const current = settings?.antipromo || 'off';
        const input = String(args[0] || '').trim().toLowerCase();
        if (!input) {
            const warnLimit = await getWarnLimit(m.chat);
            return sendInteractive(client, m, fmt(
                `Status: *${current.toUpperCase()}*\n│ Detects income-hype and business offers\n│ paired with a contact, join, link, or\n│ urgency prompt. Plain business talk is\n│ ignored.\n│ \n│ Usage: *${prefix}antipromo warn|delete|kick|off*\n│ warn = delete + warn; repeat kicks at ${warnLimit}\n│ delete = delete only; kick = instant removal`
            ));
        }

        const mode = ['on', 'enable', 'enabled', 'true', 'yes'].includes(input) ? 'warn'
            : ['disable', 'disabled', 'false', 'no', '0'].includes(input) ? 'off'
            : input;
        if (!VALID_MODES.includes(mode)) {
            return sendInteractive(client, m, fmt(`Choose *warn*, *delete*, *kick*, or *off*.\n│ Usage: ${prefix}antipromo warn`));
        }
        if (mode === current) return sendInteractive(client, m, fmt(`Already set to *${mode.toUpperCase()}*.`));

        await updateGroupSetting(m.chat, 'antipromo', mode);
        await getGroupSettingsFresh(m.chat);
        const confirmation = mode === 'off' ? 'Protection is OFF.'
            : mode === 'delete' ? 'Promotional posts will be deleted without warnings.'
            : mode === 'kick' ? 'Matching promotional posts will be deleted and the sender kicked immediately.'
            : `Matching posts will be deleted and warned; repeat offenders are kicked at ${await getWarnLimit(m.chat)} warnings.`;
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, fmt(`ANTIPROMO set to *${mode.toUpperCase()}*.\n│ ${confirmation}`));
    }
};
