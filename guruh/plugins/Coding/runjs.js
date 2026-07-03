import { sendInteractive } from '../../lib/sendInteractive.js';
    import { node } from 'compile-run';
export default async (context) => {
    const { m, text } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    let code = text;

    if (m.quoted && m.quoted.text) {
        code = m.quoted.text;
    }

    if (!code) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, `⚡ ──「 JS COMPILER 」──
▢ Provide JavaScript code or quote one.\n▢ Example: .runjs console.log("hello")\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    }

    try {
        let result = await node.runSource(code);
        console.log(result);
        
        let output = result.stdout || 'No output';
        let error = result.stderr ? `▢ stderr: ${result.stderr}\n` : '';
        
        sendInteractive(client, m, `⚡ ──「 JS OUTPUT 」──
▢ ${output}\n${error}└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
        
    } catch (err) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        console.log(err);
        sendInteractive(client, m, `⚡ ──「 JS ERROR 」──
▢ ${err.stderr || err.message}\n└──✦ 𝐁𝐋𝐀𝐂𝐊 𝐏𝐀𝐍𝐓𝐇𝐄𝐑 ┃ ᴹᴰ ✦──`);
    }
};