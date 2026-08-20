import { sendInteractive } from '../../lib/sendInteractive.js';
export default async (context) => {
  const { client, m, chatUpdate, store, isBotAdmin, isAdmin } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

  if (!m.isGroup) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, `⚡ ──「 ERROR 」──
▢ Yo, dumbass, this command's\n▢ for groups only.\n▢ Stop screwing around.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
  }

  if (!isAdmin) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, `⚡ ──「 ERROR 」──
▢ Nice try, loser. You need\n▢ admin powers to pull this off.\n▢ Get lost.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
  }

  if (!isBotAdmin) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, `⚡ ──「 ERROR 」──
▢ I ain't got admin rights, moron.\n▢ Make me admin or quit\n▢ wasting my time.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
  }

  const responseList = await client.groupRequestParticipantsList(m.chat);

  if (responseList.length === 0) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    return sendInteractive(client, m, `⚡ ──「 NO REQUESTS 」──
▢ What a surprise, no one's\n▢ begging to join this dumpster fire.\n▢ No pending requests, idiot.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
  }

  await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });

  for (const participant of responseList) {
    try {
      const response = await client.groupRequestParticipantsUpdate(
        m.chat,
        [participant.jid],
        "approve"
      );
      console.log(response);
    } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      console.error('Error approving participant:', error);
      return sendInteractive(client, m, `⚡ ──「 ERROR 」──
▢ Shit hit the fan, couldn't approve\n▢ @${participant.jid.split('@')[0]}.\n▢ Fix your group, dumbass.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`, { mentions: [participant.jid] });
    }
  }

  sendInteractive(client, m, `⚡ ──「 APPROVED 」──
▢ Ugh, fine, all the desperate\n▢ wannabes got approved.\n▢ Happy now, you pest?\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
};
