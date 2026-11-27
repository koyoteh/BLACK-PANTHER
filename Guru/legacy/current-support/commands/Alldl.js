import {
  alldlDownload,
  MESSAGES
} from '../france/index.js';

export const commands = [
  {
    name: 'alldl',
    aliases: ['alldown', 'dl', 'download'],
    description: 'Download media from various social platforms.',
    category: 'Download',
    execute: async ({ sock, from, text, msg }) => {
      if (!text) {
        return await sock.sendMessage(from, {
          text: MESSAGES.alldl.noUrl
        });
      }

      try {
        const data = await alldlDownload(text);

        if (data.result) {
          const isImage = data.result.endsWith('.jpg') || data.result.endsWith('.png');
          const caption = MESSAGES.alldl.caption.replace('{url}', text);

          const messageContent = {
            [isImage ? 'image' : 'video']: { url: data.result },
            caption: caption
          };

          await sock.sendMessage(from, messageContent);
          await sock.sendMessage(from, { text: MESSAGES.alldl.complete });
        } else {
          await sock.sendMessage(from, { text: MESSAGES.alldl.noMedia });
        }
      } catch (error) {
        console.error('[ALLDL ERROR]', error);
        await sock.sendMessage(from, {
          text: MESSAGES.alldl.error
        });
      }
    }
  }
];
