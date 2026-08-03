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
▢ Provide JavaScript code or quote one.\n▢ Example: .runjs console.log("hello")\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`);
    }

    try {
        let result = await node.runSource(code);
        console.log(result);
        
        let output = result.stdout || 'No output';
        let error = result.stderr ? `▢ stderr: ${result.stderr}\n` : '';
        
        sendInteractive(client, m, `⚡ ──「 JS OUTPUT 」──
▢ ${output}\n${error}└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`);
        
    } catch (err) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        console.log(err);
        sendInteractive(client, m, `⚡ ──「 JS ERROR 」──
▢ ${err.stderr || err.message}\n└──✦ 𝐓𝐄𝐇𝐒𝐄𝐄𝐍 𝐓𝐄𝐂𝐇 ✦──`);
    }
};