import {
  exchangeRates,
  imdbSearch,
  emojimix,
  getRandomDevice,
  getFakeFiles,
  randomIP,
  progressSteps,
  hackMessages,
  getLoveEmoji,
  delay,
  sleep,
  MESSAGES
} from '../france/index.js';

import axios from 'axios';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import CONFIG from '../../Guru Tech/config.js';

export const commands = [
  {
    name: 'exchange',
    aliases: ['rate', 'rates'],
    category: 'Finance',
    description: 'Convert currency using live exchange rate',
    execute: async ({ sock, from, text, msg }) => {
      const args = text.trim().split(/\s+/);
      if (args.length < 3) {
        return sock.sendMessage(from, {
          text: MESSAGES.exchange.usage
        }, { quoted: msg });
      }

      const [amountRaw, fromCurrency, toCurrency] = args;
      const amount = parseFloat(amountRaw);

      if (isNaN(amount)) {
        return sock.sendMessage(from, {
          text: MESSAGES.exchange.invalid
        }, { quoted: msg });
      }

      try {
        const data = await exchangeRates(fromCurrency);
        const rates = data.rates;

        if (!rates[toCurrency.toUpperCase()]) {
          return sock.sendMessage(from, {
            text: 'Currency conversion rate not available.'
          }, { quoted: msg });
        }

        const convertedAmount = (amount * rates[toCurrency.toUpperCase()]).toFixed(2);
        return sock.sendMessage(from, {
          text: `${amount} ${fromCurrency.toUpperCase()} = ${convertedAmount} ${toCurrency.toUpperCase()}`
        }, { quoted: msg });
      } catch (error) {
        return sock.sendMessage(from, {
          text: MESSAGES.exchange.error
        }, { quoted: msg });
      }
    }
  },
  {
    name: 'currency',
    description: 'Converts one currency to another using live exchange rates',
    category: 'Finance',
    execute: async ({ sock, from, text, msg }) => {
      const args = text.trim().split(/\s+/);
      if (!args[0] || args.length < 3) {
        return sock.sendMessage(from, {
          text: MESSAGES.currency.usage
        }, { quoted: msg });
      }

      const [amountRaw, fromCurrency, toCurrency] = args;
      const amount = parseFloat(amountRaw);

      if (isNaN(amount)) {
        return sock.sendMessage(from, {
          text: MESSAGES.currency.invalid
        }, { quoted: msg });
      }

      try {
        const data = await exchangeRates(fromCurrency);
        const rates = data.rates;

        if (!rates[toCurrency.toUpperCase()]) {
          return sock.sendMessage(from, {
            text: MESSAGES.currency.invalidTarget.replace('{currency}', toCurrency.toUpperCase())
          }, { quoted: msg });
        }

        const convertedAmount = (amount * rates[toCurrency.toUpperCase()]).toFixed(2);
        const updateDate = new Date(data.time_last_updated * 1000);

        const info = MESSAGES.currency.result
          .replace('{base}', data.base)
          .replace('{date}', `${updateDate.toLocaleDateString()} - ${updateDate.toLocaleTimeString()}`)
          .replace('{amount}', amount)
          .replace('{from}', fromCurrency.toUpperCase())
          .replace('{converted}', convertedAmount)
          .replace('{to}', toCurrency.toUpperCase())
          .replace('{rate}', rates[toCurrency.toUpperCase()]);

        await sock.sendMessage(from, { text: info }, { quoted: msg });
      } catch (error) {
        await sock.sendMessage(from, {
          text: MESSAGES.currency.error
        }, { quoted: msg });
      }
    }
  },
  {
    name: 'imdb',
    aliases: ['movie', 'film'],
    description: 'Search for a movie or series using IMDb API',
    category: 'Search',
    execute: async ({ sock, from, text, msg }) => {
      if (!text) {
        return sock.sendMessage(from, {
          text: MESSAGES.imdb.noQuery
        }, { quoted: msg });
      }

      try {
        const imdb = await imdbSearch(text);

        if (imdb.Response === 'False') {
          return sock.sendMessage(from, {
            text: MESSAGES.imdb.notFound.replace('{query}', text)
          }, { quoted: msg });
        }

        let info = "⚍⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚍\n";
        info += " ``` 𝕀𝕄𝔻𝔹 𝕊𝔼𝔸ℝℂℍ```\n";
        info += "⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎⚎\n";
        info += `🎬 Title: ${imdb.Title}\n`;
        info += `📅 Year: ${imdb.Year}\n`;
        info += `⭐ Rated: ${imdb.Rated}\n`;
        info += `📆 Release: ${imdb.Released}\n`;
        info += `⏳ Runtime: ${imdb.Runtime}\n`;
        info += `🌀 Genre: ${imdb.Genre}\n`;
        info += `👨🏻‍💻 Director: ${imdb.Director}\n`;
        info += `✍ Writers: ${imdb.Writer}\n`;
        info += `👨 Actors: ${imdb.Actors}\n`;
        info += `📃 Synopsis: ${imdb.Plot}\n`;
        info += `🌐 Language: ${imdb.Language}\n`;
        info += `🌍 Country: ${imdb.Country}\n`;
        info += `🎖️ Awards: ${imdb.Awards}\n`;
        info += `📦 Box Office: ${imdb.BoxOffice}\n`;
        info += `🏙️ Production: ${imdb.Production}\n`;
        info += `🌟 IMDb Rating: ${imdb.imdbRating}\n`;
        info += `❎ IMDb Votes: ${imdb.imdbVotes}\n`;
        info += `🎥 Watch Online: https://www.google.com/search?q=watch+${encodeURIComponent(imdb.Title)}+online\n`;

        await sock.sendMessage(from, {
          image: { url: imdb.Poster },
          caption: info
        }, { quoted: msg });
      } catch (error) {
        return sock.sendMessage(from, {
          text: MESSAGES.imdb.error
        }, { quoted: msg });
      }
    }
  },
  {
    name: 'emomix',
    aliases: ['emojimix'],
    category: 'Converter',
    description: 'Mixes two emojis into one sticker',
    execute: async ({ sock, from, text, msg }) => {
      if (!text || !text.includes(';')) {
        return sock.sendMessage(from, {
          text: MESSAGES.emomix.usage
        }, { quoted: msg });
      }

      const emojis = text.split(';');
      if (emojis.length !== 2) {
        return sock.sendMessage(from, {
          text: MESSAGES.emomix.invalid
        }, { quoted: msg });
      }

      const emoji1 = emojis[0].trim();
      const emoji2 = emojis[1].trim();

      try {
        const response = await emojimix(emoji1, emoji2);

        if (response.data?.status) {
          const stickerMess = new Sticker(response.data.result, {
            pack: 'BLACK PANTHER',
            type: StickerTypes.CROPPED,
            categories: ['🤩', '🎉'],
            id: '12345',
            quality: 70,
            background: 'transparent'
          });
          const buffer = await stickerMess.toBuffer();
          await sock.sendMessage(from, {
            sticker: buffer
          }, { quoted: msg });
        } else {
          return sock.sendMessage(from, {
            text: MESSAGES.emomix.error
          }, { quoted: msg });
        }
      } catch (err) {
        return sock.sendMessage(from, {
          text: MESSAGES.emomix.apiError.replace('{error}', err.message)
        }, { quoted: msg });
      }
    }
  },
  {
    name: 'hack',
    aliases: ['fakehack', 'h4ck'],
    description: 'Fake hack for fun 😈',
    category: 'Fun',
    execute: async ({ sock, from, text, msg }) => {
      const ownerNumber = (CONFIG.OWNER_NUMBER || globalThis.BOT_NUMBER || '').replace(/\D/g, '');
      const senderJid = msg.key?.participant || msg.key?.remoteJid || from;
      const senderNumber = senderJid.replace(/\D/g, '');

      if (ownerNumber && ownerNumber === senderNumber) {
        return sock.sendMessage(from, {
          text: MESSAGES.hack.creator
        }, { quoted: msg });
      }

      await sock.sendMessage(from, {
        text: `💻 Hacking progress:\n${progressSteps[0]}`
      }, { quoted: msg });

      for (let i = 1; i < progressSteps.length; i++) {
        await delay(1000);
        await sock.sendMessage(from, {
          text: `💻 Hacking progress:\n${progressSteps[i]}`
        }, { quoted: msg });
      }

      for (const line of hackMessages) {
        await delay(1500);
        let message = line;

        if (line.includes('{device}')) {
          message = line.replace('{device}', getRandomDevice());
        } else if (line.includes('{ip}')) {
          message = line.replace('{ip}', await randomIP());
        } else if (line.includes('{file1}')) {
          message = line.replace('{file1}', getFakeFiles());
        } else if (line.includes('{file2}')) {
          message = line.replace('{file2}', getFakeFiles());
        }

        await sock.sendMessage(from, {
          text: message
        }, { quoted: msg });
      }
    }
  },
  {
    name: 'love',
    aliases: ['compatibility', 'lovetest'],
    description: 'Calculate love compatibility between two people ❤️',
    category: 'Fun',
    execute: async ({ sock, from, text, msg }) => {
      const senderName = msg.pushName || 'User';
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const quotedName = msg.message?.extendedTextMessage?.contextInfo?.participant || '';

      let user1 = senderName;
      let user2 = '';

      if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        user2 = quotedName.replace(/@s\.whatsapp\.net$/, '');
      } else if (text) {
        user2 = text;
      } else {
        return sock.sendMessage(from, {
          text: MESSAGES.love.usage
        }, { quoted: msg });
      }

      const percentage = Math.floor(Math.random() * 101);
      const emoji = getLoveEmoji(percentage);

      const response = MESSAGES.love.result
        .replace('{user1}', user1)
        .replace('{user2}', user2)
        .replace('{percentage}', percentage)
        .replace('{emoji}', emoji);

      await sock.sendMessage(from, { text: response }, { quoted: msg });
    }
  },
  {
    name: 'flip',
    aliases: ['coin', 'toss'],
    description: 'Toss a coin and get HEADS or TAILS 🪙',
    category: 'Fun',
    execute: async ({ sock, from, text, msg }) => {
      await sock.sendMessage(from, {
        text: '🪙 Tossing the coin in the air...'
      }, { quoted: msg });

      await delay(1000);
      await sock.sendMessage(from, {
        text: '🌀 The coin is spinning... spinning...'
      }, { quoted: msg });

      await delay(1500);

      const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
      const finalText = `🪙 The coin has landed!\n\nResult: It's *${result}*!`;

      await sock.sendMessage(from, { text: finalText }, { quoted: msg });
    }
  }
];
