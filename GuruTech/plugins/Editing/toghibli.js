import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from 'fs';
import path from 'path';
import { sendInteractive } from '../../lib/sendInteractive.js';
import { FGSI_API_KEY } from '../../keys.js';

async function uploadImage(buffer) {
    const tempFilePath = path.join(__dirname, `temp_${Date.now()}.jpg`);
    fs.writeFileSync(tempFilePath, buffer);

    const form = new FormData();
    form.append('files[]', fs.createReadStream(tempFilePath));

    try {
        const response = await axios.post('https://qu.ax/upload.php', form, {
            headers: form.getHeaders() });

        const link = response.data?.files?.[0]?.url;
        if (!link) throw new Error('No URL returned in response');

        fs.unlinkSync(tempFilePath);
        return { url: link };
    } catch (error) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        throw new Error(`Upload error: ${error.message}`);
    }
}

export default async (context) => {
    const { client, mime, m } = context;
    await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

    const quoted = m.quoted ? m.quoted : m;
    const quotedMime = quoted.mimetype || mime || '';

    if (!/image/.test(quotedMime)) {
        await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        return sendInteractive(client, m, `╭─❏ 「 TO GHIBLI」
│ Please reply to or send an image\n│ with this command, genius.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
    }

    await sendInteractive(client, m, `╭─❏ 「 TO GHIBLI」
│ Creating your Ghibli-style artwork...\n│ Please wait.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);

    try {
        if (!FGSI_API_KEY) return sendInteractive(client, m, 'Set FGSI_API_KEY in the host environment to use image transformations.');
        const media = await quoted.download();
        if (!media) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 FAILED」
│ Failed to download the image.\n│ Try again, loser.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
        }

        if (media.length > 10 * 1024 * 1024) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭─❏ 「 FAILED」
│ The image is too large (max 10MB).\n│ Compress it, you hoarder.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
        }

        const { url: imageUrl } = await uploadImage(media);

        const response = await axios.get('https://fgsi.koyeb.app/api/ai/image/toGhibli', {
            params: {
                apikey: FGSI_API_KEY,
                url: imageUrl },
            responseType: 'arraybuffer' });

        const ghibliImage = Buffer.from(response.data);

        await client.sendMessage(
            m.chat,
            {
                image: ghibliImage,
                caption: `╭─❏ 「 GHIBLI STYLE」
│ Your image has been reimagined in\n│ *Studio Ghibli* style!\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER` }
        );
    } catch (err) {
    await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
        await sendInteractive(client, m, `╭─❏ 「 ERROR」
│ Error while generating Ghibli-style\n│ image generation failed.\n╰───────────────\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 BLACK PANTHER`);
    }
};
