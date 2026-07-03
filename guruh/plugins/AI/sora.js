import fetch from 'node-fetch';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
    name: 'sora',
    aliases: ['soraai', 'genvideo', 'aifilm'],
    description: 'Generate an AI cinematic image scene from a text prompt',
    run: async (context) => {
        const { client, m, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        const prompt = m.body.replace(new RegExp(`^${prefix}(sora|soraai|genvideo|aifilm)\\s*`, 'i'), '').trim();

        if (!prompt) {
            return sendInteractive(client, m, `⚡ ──「 Sᴏʀᴀ AI 」──
▢ Describe a scene to generate.\n▢ Example: ${prefix}sora a dragon flying over Tokyo\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }

        try {
            await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

            const cinemaPrompt = `cinematic film scene, ultra detailed, 8k, ${prompt}, dramatic lighting, movie quality, epic composition`;
            const seed = Math.floor(Math.random() * 999999);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cinemaPrompt)}?width=1280&height=720&model=flux&nologo=true&seed=${seed}`;

            const imgRes = await fetch(imageUrl, { timeout: 60000 });
            if (!imgRes.ok) throw new Error('Scene generation failed');
            const buffer = Buffer.from(await imgRes.arrayBuffer());

            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
            await client.sendMessage(m.chat, {
                image: buffer,
                caption: `⚡ ──「 Sᴏʀᴀ AI Sᴄᴇɴᴇ 」──
▢ Prompt: ${prompt}\n▢ Resolution: 1280×720\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`
            });

        } catch (error) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
            await sendInteractive(client, m, `⚡ ──「 Fᴀɪʟᴇᴅ 」──
▢ Could not generate scene.\n▢ Try a different prompt.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        }
    }
};
