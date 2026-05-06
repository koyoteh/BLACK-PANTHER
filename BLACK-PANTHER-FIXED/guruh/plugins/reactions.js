'use strict';
// ╭─────────────────────────────────────────╮
//   BLACK PANTHER MD  ·  reactions.js
//   Anime reaction stickers (waifu.pics)
// ╰─────────────────────────────────────────╯

const axios   = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { addCmd } = require('../../guru/handlers/loader');
const config    = require('../../guru/config/settings');

/**
 * Fetch a random image for the given waifu.pics SFW endpoint
 * and send it as a WebP sticker to the chat.
 */
async function sendReactionSticker(ctx, endpoint) {
    try {
        const { data } = await axios.get(
            `https://api.waifu.pics/sfw/${endpoint}`,
            { timeout: 15_000 }
        );
        if (!data?.url) throw new Error('No image returned');

        const sticker = new Sticker(data.url, {
            pack:    config.PACK_NAME,
            author:  config.PACK_AUTHOR,
            type:    StickerTypes.FULL,
            quality: 60,
        });
        const buffer = await sticker.toBuffer();

        await ctx.sock.sendMessage(
            ctx.from,
            { sticker: buffer },
            { quoted: ctx.m }
        );
    } catch (err) {
        await ctx.reply(`❌ Couldn't fetch *${endpoint}* reaction right now.`)
            .catch(() => {});
    }
}

// Mapping: command name (and aliases) → waifu.pics endpoint
const reactions = [
    { names: ['kiss', 'cium', 'beso'],     endpoint: 'kiss'      },
    { names: ['cry'],                      endpoint: 'cry'       },
    { names: ['blush'],                    endpoint: 'blush'     },
    { names: ['dance'],                    endpoint: 'dance'     },
    { names: ['kill'],                     endpoint: 'kill'      },
    { names: ['hug'],                      endpoint: 'hug'       },
    { names: ['kick'],                     endpoint: 'kick'      },
    { names: ['slap'],                     endpoint: 'slap'      },
    { names: ['happy'],                    endpoint: 'happy'     },
    { names: ['bully'],                    endpoint: 'bully'     },
    { names: ['pat', 'headpat'],           endpoint: 'pat'       },
    { names: ['wink'],                     endpoint: 'wink'      },
    { names: ['poke'],                     endpoint: 'poke'      },
    { names: ['cuddle'],                   endpoint: 'cuddle'    },
    { names: ['highfive', 'hi5'],          endpoint: 'highfive'  },
    { names: ['smile'],                    endpoint: 'smile'     },
    { names: ['wave'],                     endpoint: 'wave'      },
    { names: ['bite'],                     endpoint: 'bite'      },
    { names: ['lick'],                     endpoint: 'lick'      },
    { names: ['bonk'],                     endpoint: 'bonk'      },
    { names: ['yeet'],                     endpoint: 'yeet'      },
    { names: ['glomp'],                    endpoint: 'glomp'     },
    { names: ['nom'],                      endpoint: 'nom'       },
    { names: ['handhold', 'holdhands'],    endpoint: 'handhold'  },
    { names: ['awoo'],                     endpoint: 'awoo'      },
    { names: ['smug'],                     endpoint: 'smug'      },
    { names: ['cringe'],                   endpoint: 'cringe'    },
    { names: ['neko'],                     endpoint: 'neko'      },
    { names: ['waifu'],                    endpoint: 'waifu'     },
    { names: ['shinobu'],                  endpoint: 'shinobu'   },
    { names: ['megumin'],                  endpoint: 'megumin'   },
];

for (const r of reactions) {
    const [name, ...aliases] = r.names;
    addCmd({
        name,
        aliases,
        desc:     `Send a random *${name}* reaction sticker.`,
        usage:    name,
        category: 'reactions',
        handler:  async (ctx) => sendReactionSticker(ctx, r.endpoint),
    });
}
