import Obf from 'javascript-obfuscator';
import { sendInteractive } from '../../lib/sendInteractive.js';
export default async (context) => {
    const { client, m } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });


    
    if (m.quoted && m.quoted.text) {
        const forq = m.quoted.text;

       
        const obfuscationResult = Obf.obfuscate(forq, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 1,
            numbersToExpressions: true,
            simplify: true,
            stringArrayShuffle: true,
            splitStrings: true,
            stringArrayThreshold: 1
        });

        console.log("Successfully encrypted the code");
        sendInteractive(client, m, `⚡ ──「 ENCRYPTED 」──
▢ ${obfuscationResult.getObfuscatedCode()}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    } else {
        sendInteractive(client, m, `⚡ ──「 ENCRYPT 」──
▢ Tag a valid JavaScript code to encrypt!\n▢ Stop wasting my time.\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    }
};