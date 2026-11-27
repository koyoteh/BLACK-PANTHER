import { xenc01 } from '../france/Answers.js';
import { MESSAGES } from '../france/config.js';

export const commands = [
  {
    name: 'gpt',
    aliases: ['ask', 'chat'],
    description: 'Chat with GPT model using text prompts.',
    category: 'AI',
    execute: async ({ sock, from, text, msg }) => {
      const prompt = text.trim();

      if (!prompt) {
        return sock.sendMessage(
          from,
          { text: MESSAGES.gpt.noPrompt },
          { quoted: msg }
        );
      }

      try {
        const result = await xenc01(prompt);
        const responseText = result.response || '⚠️ No response from GPT.';

        await sock.sendMessage(
          from,
          { text: responseText },
          { quoted: msg }
        );
      } catch (err) {
        await sock.sendMessage(
          from,
          { text: MESSAGES.gpt.error },
          { quoted: msg }
        );
      }
    }
  }
];
