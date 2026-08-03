import { sendInteractive } from '../../lib/sendInteractive.js';
export default async (context) => {
  const { client, m } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

  const message = `⚡ ──「 Sᴜᴘᴘᴏʀᴛ Lɪɴᴋs 」──
▢ *Owner*
▢ https:
▢ 
▢ *Channel Link*
▢ https:
▢ 
▢ *Group*
▢ https:
└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`;

  try {
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
    await client.sendMessage(
      m.chat,
      { text: message }
    );
  } catch (error) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
    console.error("Support command error:", error);
    await sendInteractive(client, m, `⚡ ──「 Eʀʀᴏʀ 」──
▢ Failed to send support links.\n▢ Try again, you impatient fool.\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`);
  }
};
