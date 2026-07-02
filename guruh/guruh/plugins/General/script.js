import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
  name: 'script',
  aliases: ['repo', 'source', 'github', 'git', 'gh', 'src', 'code', 'sourcecode'],
  description: 'Show GitHub repository info for BLACK-PANTHER-MD',
  run: async (context) => {
    const { client, m, botname, prefix = '' } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    try {
      const repoUrl = 'https://api.github.com/repos/koyoteh/BLACK-PANTHER';
      const response = await fetch(repoUrl);
      const repoData = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch repository data');
      }

      const repoInfo = {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        lastUpdate: repoData.updated_at,
        owner: repoData.owner.login,
        createdAt: repoData.created_at,
        htmlUrl: repoData.html_url
      };

      const createdDate = new Date(repoInfo.createdAt).toLocaleDateString('en-GB');
      const lastUpdateDate = new Date(repoInfo.lastUpdate).toLocaleDateString('en-GB');

      const replyText = `╭━⬣ 「 Repository」
┃ 🔗 GitHub:\n┃ https://github.com/koyoteh/BLACK-PANTHER\n┃ \n┃ 🌐 Hosting:\n┃ https://wa.me/254105521300\n┃ \n┃ ⭐ Stars : ${repoInfo.stars}\n┃ 🍴 Forks : ${repoInfo.forks}\n┃ 📅 Created : ${createdDate}\n┃ 🔄 Last Update : ${lastUpdateDate}\n┃ 👤 Owner : ${repoInfo.owner}\n╰━━━━━━━━━━━━━━━\n> 🌐 Hosted by GuruTech Hosting\n> 🔗 hosting.wa.me/254105521300`;

      await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });

      try {
        const msg = generateWAMessageFromContent(m.chat, proto.Message.fromObject({
          interactiveMessage: {
            body: { text: replyText },
            footer: { text: '🌐 hosting.wa.me/254105521300' },
            header: { hasMediaAttachment: false },
            contextInfo: {
              externalAdReply: {
                showAdAttribution: false,
                title: `${botname}`,
                body: `Hosted by GuruTech Hosting`,
                sourceUrl: `https://wa.me/254105521300`,
                mediaType: 1,
                renderLargerThumbnail: true
              }
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: 'GitHub Repo',
                    url: repoInfo.htmlUrl,
                    merchant_url: repoInfo.htmlUrl
                  })
                },
                {
                  name: 'cta_url',
                  buttonParamsJson: JSON.stringify({
                    display_text: 'GuruTech Hosting',
                    url: 'https://wa.me/254105521300',
                    merchant_url: 'https://wa.me/254105521300'
                  })
                }
              ]
            }
          }
        }), { userJid: client.user.id });
        await client.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
      } catch {
        await client.sendMessage(m.chat, {
          text: replyText,
          viewOnce: true,
          contextInfo: {
            externalAdReply: {
              showAdAttribution: false,
              title: `${botname}`,
              body: `Hosted by GuruTech Hosting`,
              sourceUrl: `https://wa.me/254105521300`,
              mediaType: 1,
              renderLargerThumbnail: true
            }
          }
        });
      }

    } catch (error) {
      await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
      await sendInteractive(client, m, `╭━⬣ 「 Eʀʀᴏʀ」
┃ Couldn't fetch repo data\n┃ ${error.message}\n╰━━━━━━━━━━━━━━━\n> 🌐 hosting.wa.me/254105521300`);
    }
  }
};
