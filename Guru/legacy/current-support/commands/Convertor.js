import {
  downloadMedia,
  delay,
  MESSAGES,
  LIMITS
} from '../france/index.js';

import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { getViewOnceBuffer, getViewOnceMedia, getViewOnceMediaById, getViewOnceSourceMessage } from '../../Guru Tech/viewOnceAutoSave.js';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { tmpdir } from 'os';
import { Sticker } from 'wa-sticker-formatter';
import ffmpegStatic from 'ffmpeg-static';
import fluentFfmpeg from 'fluent-ffmpeg';
import axios from 'axios';

const execPromise = util.promisify(exec);
const ffmpeg = fluentFfmpeg;
ffmpeg.setFfmpegPath(ffmpegStatic);

export const commands = [
  {
    name: 'trim',
    description: 'Trim quoted audio or video.',
    category: 'Converter',
    execute: async ({ sock, from, text, msg }) => {
      const args = text ? text.split(' ') : [];
      const start = parseInt(args[0]);
      const end = parseInt(args[1]);

      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isVideo = quoted?.videoMessage;
      const isAudio = quoted?.audioMessage;

      if (!(isVideo || isAudio)) {
        return sock.sendMessage(from, {
          text: MESSAGES.trim.error
        });
      }

      if (isNaN(start) || isNaN(end) || end <= start) {
        return sock.sendMessage(from, {
          text: MESSAGES.trim.invalid
        });
      }

      try {
        const buffer = await downloadMediaMessage(
          { message: quoted },
          'buffer',
          {},
          { logger: console }
        );

        const ext = isVideo ? 'mp4' : 'mp3';
        const input = path.join(tmpdir(), `input_${Date.now()}.${ext}`);
        const output = path.join(tmpdir(), `output_${Date.now()}.${ext}`);
        fs.writeFileSync(input, buffer);

        ffmpeg(input)
          .setStartTime(start)
          .setDuration(end - start)
          .output(output)
          .on('end', async () => {
            const trimmed = fs.readFileSync(output);
            await sock.sendMessage(from, {
              [isVideo ? 'video' : 'audio']: trimmed,
              mimetype: isVideo ? 'video/mp4' : 'audio/mp4',
              ptt: !isVideo
            });
            fs.unlinkSync(input);
            fs.unlinkSync(output);
          })
          .on('error', async () => {
            await sock.sendMessage(from, {
              text: MESSAGES.trim.failed
            });
            if (fs.existsSync(input)) fs.unlinkSync(input);
            if (fs.existsSync(output)) fs.unlinkSync(output);
          })
          .run();
      } catch (error) {
        await sock.sendMessage(from, {
          text: MESSAGES.trim.downloadError
        });
      }
    }
  },
{
  name: 'quotly',
  aliases: ['quote', 'q'],
  description: 'Create a quote sticker with text and username',
  category: 'General',
  execute: async ({ sock, from, text, msg }) => {
    if (!text) {
      return sock.sendMessage(from, {
        text: '❌ *Please provide text and username.*\n\nExample: `.quotly am the best by GuruTech`'
      });
    }

    try {
      const byIndex = text.toLowerCase().indexOf(' by ');

      if (byIndex === -1) {
        return sock.sendMessage(from, {
          text: '❌ *Invalid format.*\n\nUse: `.quotly your message by username`\nExample: `.quotly am the best by GuruTech`'
        });
      }

      const message = text.substring(0, byIndex).trim();
      const username = text.substring(byIndex + 4).trim();

      if (!message || !username) {
        return sock.sendMessage(from, {
          text: '❌ *Both message and username are required.*'
        });
      }

      await sock.sendMessage(from, {
        text: '🖼️ *Generating quote sticker...* Please wait.'
      });

      const pfpUrl = 'https://telegra.ph/file/e991bb4b535a0f1425aa0.jpg';
      const apiUrl = `https://weeb-api.vercel.app/quotly?pfp=${encodeURIComponent(pfpUrl)}&username=${encodeURIComponent(username)}&text=${encodeURIComponent(message)}`;

      const response = await axios.get(apiUrl, {
        responseType: 'arraybuffer',
        timeout: 15000
      });

      if (response.status !== 200 || response.data.length < 1000) {
        return sock.sendMessage(from, {
          text: '❌ *API returned invalid image.* Please try again.'
        });
      }

      const imageBuffer = Buffer.from(response.data);

      const { Sticker, StickerTypes } = await import('wa-sticker-formatter');

      const sticker = new Sticker(imageBuffer, {
        pack: 'BLACK PANTHER',
        author: username,
        type: StickerTypes.FULL,
        quality: 100
      });

      const stickerBuffer = await sticker.toBuffer();

      await sock.sendMessage(from, {
        sticker: stickerBuffer
      });

    } catch (error) {
      console.error('Quotly error:', error.message);
      await sock.sendMessage(from, {
        text: '❌ *Failed to generate quote sticker.* Please try again.'
      });
    }
  }
},
  {
    name: 'toimg',
    aliases: ['photo'],
    description: 'Convert static sticker to image.',
    category: 'Converter',
    execute: async ({ sock, from, text, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted?.stickerMessage) {
        return sock.sendMessage(from, {
          text: MESSAGES.toimg.noSticker
        });
      }

      if (
        quoted.stickerMessage.isAnimated ||
        quoted.stickerMessage.isLottie ||
        quoted.stickerMessage.mimetype !== 'image/webp'
      ) {
        return sock.sendMessage(from, {
          text: MESSAGES.toimg.unsupported
        });
      }

      const tmpPath = './temp/sticker.webp';
      const outPath = './temp/image.jpg';

      try {
        const buffer = await downloadMediaMessage(
          { message: quoted },
          'buffer',
          {},
          { logger: console }
        );

        fs.ensureDirSync('./temp');
        fs.writeFileSync(tmpPath, buffer);

        await execPromise(`"${ffmpegStatic}" -y -i "${tmpPath}" "${outPath}"`);
        await sock.sendMessage(from, {
          image: fs.readFileSync(outPath),
          caption: MESSAGES.toimg.success
        });
      } catch (err) {
        await sock.sendMessage(from, {
          text: `${MESSAGES.toimg.error}\n\n${err.message}`
        });
      } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      }
    }
  },
  {
    name: 'sticker',
    aliases: ['s', 'tosticker'],
    description: 'Convert image, video, or view-once image/video to sticker',
    category: 'Converter',
    execute: async ({ sock, from, text, msg, downloaders = {} }) => {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;
      const messageId = contextInfo?.stanzaId || msg.key?.id;
      const viewOnce = (contextInfo?.stanzaId ? getViewOnceMediaById(contextInfo.stanzaId, quoted, from) : null) || getViewOnceMedia(msg.message);
      const quotedImage = quoted?.imageMessage;
      const quotedVideo = quoted?.videoMessage;
      const directImage = msg.message?.imageMessage;
      const directVideo = msg.message?.videoMessage;

      try {
        let type;
        let buffer;
        if (viewOnce) {
          type = viewOnce.type;
          if (!['imageMessage', 'videoMessage'].includes(type)) {
            return sock.sendMessage(from, { text: '❌ Only view-once images and videos can be converted to stickers.' }, { quoted: msg });
          }
          const sourceMessage = getViewOnceSourceMessage(messageId) || (quoted
            ? { key: { id: messageId, remoteJid: from, participant: contextInfo?.participant, participantAlt: contextInfo?.participantAlt, fromMe: Boolean(contextInfo?.fromMe) }, message: quoted }
            : msg);
          buffer = await getViewOnceBuffer(messageId, type, viewOnce.media, sock, downloaders, sourceMessage);
          if (!buffer?.length) throw new Error('The view-once source could not be recovered.');
        } else if (quotedImage || directImage) {
          type = 'imageMessage';
          const sourceMessage = quotedImage ? { key: { id: contextInfo?.stanzaId, remoteJid: from, participant: contextInfo?.participant, participantAlt: contextInfo?.participantAlt, fromMe: Boolean(contextInfo?.fromMe) }, message: quoted } : msg;
          buffer = await (downloaders.downloadMediaMessage || downloadMediaMessage)(sourceMessage, 'buffer', {}, { logger: console });
        } else if (quotedVideo || directVideo) {
          type = 'videoMessage';
          const sourceMessage = quotedVideo ? { key: { id: contextInfo?.stanzaId, remoteJid: from, participant: contextInfo?.participant, participantAlt: contextInfo?.participantAlt, fromMe: Boolean(contextInfo?.fromMe) }, message: quoted } : msg;
          buffer = await (downloaders.downloadMediaMessage || downloadMediaMessage)(sourceMessage, 'buffer', {}, { logger: console });
        } else {
          return sock.sendMessage(from, { text: MESSAGES.sticker.noMedia }, { quoted: msg });
        }

        if (type === 'imageMessage') {
          const sticker = new Sticker(buffer, {
            pack: 'BLACK PANTHER',
            author: msg.pushName || 'User',
            type: text?.includes('crop') ? 'cropped' : 'full',
            quality: 70
          });
          return await sock.sendMessage(from, { sticker: await sticker.toBuffer() }, { quoted: msg });
        }

        const inputPath = path.join(tmpdir(), `ultra-guru-video-${Date.now()}.mp4`);
        const outputPath = path.join(tmpdir(), `ultra-guru-sticker-${Date.now()}.webp`);
        await fs.writeFile(inputPath, buffer);
        try {
          await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
              .setFfmpegPath(ffmpegStatic)
              .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', 'fps=15,scale=512:512:force_original_aspect_ratio=decrease',
                '-loop', '0',
                '-preset', 'default',
                '-an',
                '-vsync', '0'
              ])
              .output(outputPath)
              .on('end', resolve)
              .on('error', reject)
              .run();
          });
          const sticker = new Sticker(await fs.readFile(outputPath), {
            pack: 'BLACK PANTHER',
            author: msg.pushName || 'User',
            type: 'full',
            quality: 70
          });
          await sock.sendMessage(from, { sticker: await sticker.toBuffer() }, { quoted: msg });
        } finally {
          if (await fs.pathExists(inputPath)) await fs.unlink(inputPath);
          if (await fs.pathExists(outputPath)) await fs.unlink(outputPath);
        }
      } catch (err) {
        console.error('[TOSTICKER] Conversion failed:', err.message);
        return await sock.sendMessage(from, { text: MESSAGES.sticker.error.replace('{error}', err.message) }, { quoted: msg });
      }
    }
  },
  {
    name: 'tomp3',
    aliases: ['toaudio', 'audio'],
    description: 'Convert video to audio (mp3)',
    category: 'Converter',
    execute: async ({ sock, from, text, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isQuotedVideo = quoted?.videoMessage;
      const isDirectVideo = msg.message?.videoMessage;

      if (!isQuotedVideo && !isDirectVideo) {
        return await sock.sendMessage(from, { text: MESSAGES.tomp3.noVideo });
      }

      const inputPath = `./video_${Date.now()}.mp4`;
      const outputPath = `./audio_${Date.now()}.mp3`;

      try {
        const sourceMsg = isQuotedVideo ? { message: quoted } : { message: msg.message };
        const buffer = await downloadMediaMessage(sourceMsg, 'buffer', {}, { logger: console });
        await fs.writeFile(inputPath, buffer);

        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .setFfmpegPath(ffmpegStatic)
            .output(outputPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });

        const audio = await fs.readFile(outputPath);
        await sock.sendMessage(from, { audio, mimetype: 'audio/mpeg' });

      } catch (err) {
        return await sock.sendMessage(from, { text: MESSAGES.tomp3.error.replace('{error}', err.message) });
      } finally {
        if (await fs.pathExists(inputPath)) await fs.unlink(inputPath);
        if (await fs.pathExists(outputPath)) await fs.unlink(outputPath);
      }
    }
  },
  {
    name: 'compress',
    aliases: ['compressvideo', 'reducevideo'],
    description: 'Compress and re-encode a replied-to or captioned video as WhatsApp-compatible MP4.',
    category: 'Converter',
    execute: async ({ sock, from, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedVideo = quoted?.videoMessage;
      const directVideo = msg.message?.videoMessage;
      if (!quotedVideo && !directVideo) {
        return sock.sendMessage(from, { text: 'Reply to a video with .compress, or send .compress as the video caption.' }, { quoted: msg });
      }
      if (!ffmpegStatic) {
        return sock.sendMessage(from, { text: '❌ Video conversion is unavailable on this deployment.' }, { quoted: msg });
      }

      let tempDir;
      try {
        await sock.sendMessage(from, { text: '⏳ Compressing your video for WhatsApp…' }, { quoted: msg });
        const sourceMsg = quotedVideo ? { message: quoted } : { message: msg.message };
        const inputBuffer = await downloadMediaMessage(sourceMsg, 'buffer', {}, { logger: console });
        if (inputBuffer.length > 150 * 1024 * 1024) {
          return sock.sendMessage(from, { text: '❌ The source video is too large to process (150 MB maximum).' }, { quoted: msg });
        }

        tempDir = await fs.mkdtemp(path.join(tmpdir(), 'ultra-guru-compress-'));
        const inputPath = path.join(tempDir, 'input-video');
        const outputPath = path.join(tempDir, 'compressed.mp4');
        await fs.writeFile(inputPath, inputBuffer);

        await new Promise((resolve, reject) => {
          let command;
          let settled = false;
          const finish = (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            error ? reject(error) : resolve();
          };
          const timer = setTimeout(() => {
            command?.kill('SIGKILL');
            finish(new Error('Video compression timed out.'));
          }, 180000);
          command = ffmpeg(inputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .audioBitrate('96k')
            .outputOptions(['-map 0:v:0', '-map 0:a?', '-preset veryfast', '-crf 28', '-movflags +faststart'])
            .format('mp4')
            .on('end', () => finish())
            .on('error', error => finish(error));
          command.save(outputPath);
        });

        const outputStats = await fs.stat(outputPath);
        if (outputStats.size > 64 * 1024 * 1024) {
          return sock.sendMessage(from, { text: '❌ The compressed video is still over 64 MB. Try a shorter clip.' }, { quoted: msg });
        }
        const videoBuffer = await fs.readFile(outputPath);
        await sock.sendMessage(from, {
          video: videoBuffer,
          mimetype: 'video/mp4',
          fileName: 'ultra-guru-compressed.mp4',
          caption: '✅ Compressed to WhatsApp-compatible MP4.'
        }, { quoted: msg });
      } catch (error) {
        console.error('[COMPRESS] Video conversion failed:', error.message);
        await sock.sendMessage(from, { text: '❌ Could not compress this video. Try a smaller or standard MP4 file.' }, { quoted: msg });
      } finally {
        if (tempDir && await fs.pathExists(tempDir)) await fs.remove(tempDir);
      }
    }
  },
  {
    name: 'take',
    description: 'Take sticker with custom pack name',
    category: 'Converter',
    execute: async ({ sock, from, text, msg }) => {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isQuotedImage = quoted?.imageMessage;
      const isQuotedVideo = quoted?.videoMessage;
      const isQuotedSticker = quoted?.stickerMessage;

      if (!quoted || !(isQuotedImage || isQuotedVideo || isQuotedSticker)) {
        return await sock.sendMessage(from, { text: MESSAGES.take.noMedia });
      }

      let filePath;

      try {
        const buffer = await downloadMediaMessage(
          { message: quoted },
          'buffer',
          {},
          { logger: console }
        );

        filePath = `./temp_${Date.now()}`;
        await fs.writeFile(filePath, buffer);

        const pack = text || msg.pushName || 'BLACK PANTHER';

        const sticker = new Sticker(buffer, {
          pack,
          type: 'full',
          categories: ["🤩", "🎉"],
          id: "12345",
          quality: 70,
          background: "transparent"
        });

        const stickerBuffer = await sticker.toBuffer();
        await sock.sendMessage(from, { sticker: stickerBuffer });

      } catch (err) {
        return await sock.sendMessage(from, { text: MESSAGES.take.error.replace('{error}', err.message) });
      } finally {
        if (filePath && await fs.pathExists(filePath)) await fs.unlink(filePath);
      }
    }
  }
];
