import ownerMiddleware from '../../utils/botUtil/Ownermiddleware.js';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    await ownerMiddleware(context, async () => {
        const { client, m, store } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        if (!m?.chat) return;

        if (m.chat.endsWith('@broadcast') || m.chat.endsWith('@newsletter')) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 DELETE 」
│ Cannot delete this type of chat.
╰───────────────
> ©BLACK PANTHER`);
        }

        try {
            let lastMessages;
            if (store?.chats?.[m.chat] && Array.isArray(store.chats[m.chat]) && store.chats[m.chat].length) {
                lastMessages = store.chats[m.chat].slice(-1);
            }

            if (typeof client.deleteChat === 'function') {
                await client.deleteChat(m.chat, lastMessages);
            } else {
                await client.chatModify({ delete: true, lastMessages }, m.chat);
            }
            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } }).catch(() => {});
            await sendInteractive(client, m, `╭─❏ 「 DELETED 」
│ Chat deleted.
╰───────────────
> ©BLACK PANTHER`);
        } catch (err) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            const msg = String(err?.message || err || '');
            if (msg.includes('myAppStateKey') || msg.includes('App state not ready') || msg.includes('app-state') || err?.output?.statusCode === 404) {
                return sendInteractive(client, m, `╭─❏ 「 NOT READY 」
│ App state still syncing after connect.
│ Wait a few seconds then try again.
╰───────────────
> ©BLACK PANTHER`);
            }
            await sendInteractive(client, m, `╭─❏ 「 ERROR 」
│ Failed to delete chat.
╰───────────────
> ©BLACK PANTHER`);
        }
    });
};
