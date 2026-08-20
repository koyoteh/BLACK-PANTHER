import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const EMOJI      = '☁️';
const LABEL      = 'HEROKU';
const CHUNK_SIZE = 3500;
const PLUGIN_DIR = path.join(__dirname, '..', 'Heroku');

export default {
    name: 'herokumenu',
    aliases: ['heroku', 'herokucmds'],
    description: 'Displays the Heroku commands menu',
    run: async (context) => {
        const { client, m, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        let commandFiles = [];
        try { commandFiles = fs.readdirSync(PLUGIN_DIR).filter(f => f.endsWith('.js')); } catch {}

        const p      = prefix || '.';
        const header = `⚡ ──「 ${EMOJI} *${LABEL}* 」──\n▢ ${commandFiles.length} commands available\n\n`;
        const footer = `\n└──✦ _Powered by GuruTech_ ✦──`;

        const lines = commandFiles.map((file, i) =>
            `▢ ${String(i + 1).padStart(2, ' ')}. *${p}${file.replace('.js', '')}*`
        );

        const chunks = [];
        let current  = header;
        let isFirst  = true;
        for (const line of lines) {
            const candidate = current + line + '\n';
            if (!isFirst && candidate.length + footer.length > CHUNK_SIZE) {
                chunks.push(current + footer);
                current = `⚡ ──「 ${EMOJI} *${LABEL}* (cont.) 」──\n\n`;
            }
            current += line + '\n';
            isFirst = false;
        }
        chunks.push(current + footer);

        for (const chunk of chunks) {
            await client.sendMessage(m.chat, { text: chunk });
        }
        await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
    }
};
