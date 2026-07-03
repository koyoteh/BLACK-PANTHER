import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
  name: 'script',
  aliases: ['repo', 'source', 'github', 'git', 'gh', 'src', 'code', 'sourcecode'],
  description: 'Show GitHub repository info for BLACK-PANTHER-MD',
  run: async (context) => {
    const { client, m } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    try {
      const response = await fetch('https://api.github.com/repos/koyoteh/BLACK-PANTHER');
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'GitHub API error');

      const createdDate = new Date(data.created_at).toLocaleDateString('en-GB');
      const updatedDate = new Date(data.updated_at).toLocaleDateString('en-GB');

      const replyText =
`╔══════════════════════════════════╗
║  ✦ ──『 Repository 』── ⚝
╠══════════════════════════════════╣
║  🔗 GitHub :
║  https://github.com/koyoteh/BLACK-PANTHER
╠══════════════════════════════════╣
║  ⭐ Stars       : ${data.stargazers_count}
║  🍴 Forks       : ${data.forks_count}
║  📅 Created     : ${createdDate}
║  🔄 Last Update : ${updatedDate}
║  👤 Owner       : ${data.owner.login}
╠══════════════════════════════════╣
║  🌐 Hosting :
║  https://wa.me/254105521300
╚══════════════════════════════════╝
> ✪ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✪`;

      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
      await sendInteractive(client, m, replyText);

    } catch (error) {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      await sendInteractive(client, m,
`✦ ──『 Eʀʀᴏʀ 』── ⚝
▢ Couldn't fetch repo data
▢ ${error.message}
└──✪ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✪──`);
    }
  }
};
