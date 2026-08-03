import axios from 'axios';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default async (context) => {
    const { client, m } = context;
    try {
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });
        const { data } = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 8000 });
        const fact = data?.text;
        if (!fact) throw new Error('no fact');
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
        await sendInteractive(client, m, `⚡ ──「 RANDOM FACT 」──
▢ ${fact}\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`);
    } catch {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
        sendInteractive(client, m, `▢ Couldn't fetch a fact. The universe said no.\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`);
    }
};
