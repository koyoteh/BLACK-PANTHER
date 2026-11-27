import { sendInteractive } from '../../lib/sendInteractive.js';
import { buildRepositoryInfoText, sendRepositoryInfoCard } from '../../lib/menuNavigation.js';

export default {
  name: 'script',
  aliases: ['repo', 'source', 'github', 'git', 'gh', 'src', 'code', 'sourcecode'],
  description: 'Show GitHub repository info for BLACK PANTHER',
  run: async (context) => {
    const { client, m } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    try {
      const response = await fetch('https://api.github.com/repos/cleanplata/BLACK-PANTHER');
      const repoData = await response.json();
      if (!response.ok) throw new Error('Failed to fetch repository data');

      const repoInfo = {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        lastUpdate: repoData.updated_at,
        owner: repoData.owner.login,
        createdAt: repoData.created_at
      };

      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
      await sendRepositoryInfoCard(client, m.chat, buildRepositoryInfoText(repoInfo));
    } catch (error) {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      await sendInteractive(client, m, '╭─⛓ *BLACK PANTHER · 𝗿𝗲𝗽𝗼* ⛓─╮\n⛓ ▣ Could not fetch repository details. Try again later.\n╰─⛓──────────────⛓─╯');
    }
  }
};
