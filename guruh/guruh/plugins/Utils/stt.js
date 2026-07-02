import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import axios from 'axios';
import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import os from 'os';
import FormData from 'form-data';
import { sendInteractive } from '../../lib/sendInteractive.js';

export default {
    name: 'stt',
    aliases: ['speechtotext', 'transcribe', 'voicetotext'],
    description: 'Transcribes voice notes and audio messages to text',
    run: async (context) => {
        const { client, m, prefix } = context;
        await client.sendMessage(m.chat, { react: { text: '⌛', key: m.reactKey } });

        let _km = {};
        try { _km = await import('../../keys.js'); } catch {}
        const _groqKeys = _km.GROQ_API_KEYS?.length ? _km.GROQ_API_KEYS : [_km.GROQ_API_KEY || process.env.GROQ_KEY_1 || process.env.GROQ_API_KEY || ''].filter(Boolean);
        if (!_groqKeys.length) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } }).catch(() => {});
            return sendInteractive(client, m, `╭━⬣ 「 STT」
┃ No GROQ key set. Add GROQ_KEY_1 to env vars.\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
        }
        let GROQ_API_KEY = _km.getNextGroqKey?.() || _groqKeys[0];

        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const directAudio = m.message?.audioMessage;
        const quotedAudio = quoted?.audioMessage;
        const audioMsg = directAudio || quotedAudio;

        if (!audioMsg) {
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
            return sendInteractive(client, m, `╭━⬣ 「 STT」
┃ Reply to a voice note or audio message,\n┃ you muppet. I'm not magic — I can't\n┃ transcribe thin air.\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
        }

        await client.sendMessage(m.chat, { react: { text: '👂', key: m.reactKey } });

        const tmpFile = path.join(os.tmpdir(), `stt_${Date.now()}.ogg`);

        try {
            const stream = await downloadContentFromMessage(audioMsg, 'audio');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            await fsPromises.writeFile(tmpFile, buffer);

            const form = new FormData();
            form.append('file', fs.createReadStream(tmpFile), { filename: 'audio.ogg', contentType: 'audio/ogg' });
            form.append('model', 'whisper-large-v3');
            form.append('response_format', 'json');

            let response;
            for (let _i = 0; _i < _groqKeys.length; _i++) {
                const _k = _km.getNextGroqKey?.() || _groqKeys[_i];
                if (!_k) continue;
                try {
                    response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
                        headers: { ...form.getHeaders(), Authorization: `Bearer ${_k}` } });
                    break;
                } catch (e) {
                    if ((e.response?.status === 429 || e.response?.status === 401 || e.response?.status === 403) && _groqKeys.length > 1) {
                        _km.markKeyFailed?.(_k);
                        continue;
                    }
                    throw e;
                }
            }
            if (!response) throw new Error('All GROQ keys exhausted');

            const transcribed = response.data?.text?.trim();

            if (!transcribed) {
                await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
                return sendInteractive(client, m, `╭━⬣ 「 STT」
┃ I listened to that rubbish and got\n┃ absolutely nothing. Either you mumbled\n┃ or you sent silence. Both are equally\n┃ useless.\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
            }

            await client.sendMessage(m.chat, { react: { text: '✅', key: m.reactKey } });
            await sendInteractive(client, m, `╭━⬣ 「 STT」
┃ 👂 *Transcription:*\n┃ \n┃ ${transcribed}\n┃ \n┃ _You're welcome. Now learn to type\n┃ next time._\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);

        } catch (error) {
            console.error('STT error:', error);
            await client.sendMessage(m.chat, { react: { text: '❌', key: m.reactKey } });
            await sendInteractive(client, m, `╭━⬣ 「 STT」
┃ Transcription crashed. Whisper took one\n┃ listen and gave up — honestly can't\n┃ blame it.\n┃ \n┃ Error: ${error.message}\n╰━━━━━━━━━━━━━━━\n> ©𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐆𝐔𝐑𝐔𝐓𝐄𝐂𝐇`);
        } finally {
            fsPromises.unlink(tmpFile).catch(() => {});
        }
    }
};
