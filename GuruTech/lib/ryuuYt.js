import { proxyFetch } from './proxyFetch.js';
import { RYUU_API_KEY, ELLYTUBE_API_KEY, SIDYCODERS_API_KEY } from '../keys.js';
import { assertCompleteMp3 } from './audioIntegrity.js';
import { buildDaveTechApiUrl, buildDaveTechAudioDownloadUrl, buildDaveTechAudioStreamUrl, extractYouTubeVideoId, isYouTubeUrl, parseDaveTechMusicSearch, parseDaveTechMusicSong, parseDaveTechPlayResponse, youtubeWatchUrl } from './daveTechMusic.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const RYUU_KEY = RYUU_API_KEY;
const RYUU_BASE = 'https://api.ryuu-dev.my.id/downloader/youtube';
let ytDlpPromise = null;

async function getYtDlp() {
  if (ytDlpPromise) return ytDlpPromise;
  ytDlpPromise = (async () => {
    const module = await import('yt-dlp-wrap');
    const YTDlpWrap = module.default?.default || module.default || module;
    const binaryPath = process.env.YTDLP_PATH || path.join(os.tmpdir(), 'ultra-guru-yt-dlp');
    try {
      await fs.access(binaryPath);
    } catch {
      await fs.mkdir(path.dirname(binaryPath), { recursive: true });
      await YTDlpWrap.downloadFromGithub(binaryPath);
    }
    return new YTDlpWrap(binaryPath);
  })().catch((error) => {
    ytDlpPromise = null;
    throw error;
  });
  return ytDlpPromise;
}

function pickMedia(data) {
  if (!data || typeof data !== 'object') return null;
  const layers = [
    data?.result?.result,
    data?.result?.data,
    data?.data?.result,
    data?.result,
    data?.data,
    data
  ];
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const link =
      layer.link ||
      layer.url ||
      layer.download ||
      layer.downloadUrl ||
      layer.download_url ||
      layer.cdn ||
      layer.media ||
      layer.audio ||
      layer.mp3;
    if (link && typeof link === 'string' && /^https?:\/\//i.test(link)) {
      return {
        title: layer.title || data?.result?.title || 'Untitled',
        views: layer.views || '',
        duration: layer.duration || layer.durationSeconds || '',
        thumbnail: layer.thumbnail || layer.thumb || '',
        channel: layer.channel || layer.author || '',
        filename: layer.filename || '',
        link,
        format: layer.format || layer.selectedFormat || '',
        source: layer
      };
    }
  }
  return null;
}

async function fetchJson(url, headers = {}, timeout = 90000) {
  const res = await proxyFetch(
    url,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers
      },
      timeout
    },
    { maxProxyAttempts: 5, preferProxy: false }
  );
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`invalid JSON (${res.status})`);
  }
  if (res.status === 401) throw new Error('API key invalid');
  if (res.status === 429) throw new Error('API rate limited');
  return { ok: res.ok, status: res.status, data };
}

async function tryRyuu(url, format) {
  if (!RYUU_KEY) throw new Error('RYUU_API_KEY is not configured');
  const endpoint = `${RYUU_BASE}?url=${encodeURIComponent(url)}&format=${encodeURIComponent(format)}`;
  const { ok, status, data } = await fetchJson(endpoint, { 'X-RYUU-APIKEY': RYUU_KEY }, 95000);
  if (!ok) throw new Error(`Ryuu HTTP ${status}`);
  const media = pickMedia(data);
  if (!media) throw new Error('Ryuu: no media link');
  media.provider = 'ryuu';
  return media;
}

async function tryEllyTube(url, format = 'mp3') {
  if (!ELLYTUBE_API_KEY) throw new Error('ELLYTUBE_API_KEY is not configured');
  const isAudio = String(format).toLowerCase() === 'mp3' || String(format).toLowerCase() === 'audio';
  const params = new URLSearchParams({
    url,
    type: isAudio ? 'audio' : 'video',
    quality: isAudio ? '320kbps' : String(format || '720'),
    apikey: ELLYTUBE_API_KEY
  });
  const endpoint = `https://ellytube.web.id/api/v1/youtube/download?${params.toString()}`;
  const { ok, status, data } = await fetchJson(endpoint, {}, 95000);
  if (!ok || data?.status === false) throw new Error(`EllyTube HTTP ${status}`);
  const media = pickMedia(data);
  if (!media) throw new Error('EllyTube: no media link');
  media.provider = 'ellytube';
  media.channel = media.channel || data?.result?.author || '';
  media.duration = media.duration || data?.result?.duration || '';
  media.thumbnail = media.thumbnail || data?.result?.thumbnail || '';
  return media;
}

async function tryApiziaulByUrl(url) {
  const endpoint = `https://apiziaul.vercel.app/api/downloader/ytmp3?url=${encodeURIComponent(url)}`;
  try {
    const { ok, data } = await fetchJson(endpoint, {}, 90000);
    if (ok) {
      const media = pickMedia(data);
      if (media) {
        media.provider = 'apiziaul-url';
        return media;
      }
    }
  } catch {}
  const endpoint2 = `https://apiziaul.vercel.app/api/downloader/ytplaymp3?query=${encodeURIComponent(url)}`;
  const { ok, status, data } = await fetchJson(endpoint2, {}, 90000);
  if (!ok) throw new Error(`apiziaul HTTP ${status}`);
  const media = pickMedia(data);
  if (!media) throw new Error('apiziaul: no media link');
  media.provider = 'apiziaul';
  return media;
}

async function tryApiziaulQuery(query) {
  const endpoint = `https://apiziaul.vercel.app/api/downloader/ytplaymp3?query=${encodeURIComponent(query)}`;
  const { ok, status, data } = await fetchJson(endpoint, {}, 90000);
  if (!ok) throw new Error(`apiziaul query HTTP ${status}`);
  const media = pickMedia(data);
  if (!media) throw new Error('apiziaul query: no media link');
  if (data?.result?.videoUrl) media.videoUrl = data.result.videoUrl;
  media.provider = 'apiziaul-query';
  return media;
}

async function trySidy(url) {
  if (!SIDYCODERS_API_KEY) throw new Error('SIDYCODERS_API_KEY is not configured');
  const endpoint = `https://api.sidycoders.xyz/api/ytdl?url=${encodeURIComponent(url)}&format=mp3&apikey=${encodeURIComponent(SIDYCODERS_API_KEY)}`;
  const { ok, status, data } = await fetchJson(endpoint, {}, 60000);
  if (!ok) throw new Error(`sidy HTTP ${status}`);
  const link = data?.cdn || data?.result?.cdn || data?.url;
  if (!link) throw new Error('sidy: no media link');
  return {
    title: data?.title || data?.result?.title || 'Untitled',
    views: '',
    duration: data?.duration || '',
    thumbnail: data?.thumbnail || '',
    channel: '',
    filename: '',
    link,
    format: 'mp3',
    provider: 'sidycoders'
  };
}

async function tryNexrayVideo(url, format = '720') {
  const quality = /^\d{3,4}$/.test(String(format)) ? String(format) : '720';
  const endpoint = `https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(url)}&resolusi=${encodeURIComponent(quality)}`;
  const { ok, status, data } = await fetchJson(endpoint, {}, 90000);
  const result = data?.result;
  const link = result?.url || result?.download_url || result?.downloadUrl;
  if (!ok || !data?.status || typeof link !== 'string' || !/^https?:\/\//i.test(link)) {
    throw new Error(data?.message || `NexRay video HTTP ${status || 'failed'}`);
  }
  return {
    title: result?.title || 'YouTube video',
    views: '',
    duration: result?.duration || '',
    thumbnail: result?.thumbnail || '',
    channel: result?.channel || result?.author || '',
    filename: result?.filename || '',
    link,
    format: 'mp4',
    provider: 'nexray'
  };
}

export async function ryuuYoutube(url, format = 'mp3') {
  const errors = [];
  const normalizedFormat = String(format || 'mp3').toLowerCase();
  const audioRequested = ['mp3', 'audio', 'm4a', 'aac', 'ogg'].includes(normalizedFormat) || normalizedFormat.startsWith('audio/');
  const attempts = [() => tryEllyTube(url, format)];
  if (audioRequested) attempts.push(() => tryApiziaulByUrl(url));
  attempts.push(() => tryRyuu(url, format));
  if (!audioRequested) attempts.push(() => tryNexrayVideo(url, format));
  if (audioRequested) attempts.push(() => trySidy(url));
  for (const fn of attempts) {
    try {
      const media = await fn();
      await assertDownloadable(media);
      const mediaFormat = String(media.format || '').toLowerCase();
      if (!audioRequested && (mediaFormat.startsWith('audio/') || ['mp3', 'm4a', 'aac', 'ogg'].includes(mediaFormat))) {
        throw new Error(`${media.provider || 'source'} returned audio instead of video`);
      }
      return media;
    } catch (e) {
      errors.push(e?.message || String(e));
    }
  }
  throw new Error(`All download sources failed: ${errors.join(' | ')}`);
}

async function assertDownloadable(media, { strict = false } = {}) {
  if (!media?.link) throw new Error('no link');
  const headish = await proxyFetch(
    media.link,
    {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*',
        Range: 'bytes=0-2047',
        Referer: 'https://ellytube.web.id/'
      },
      timeout: 25000
    },
    { maxProxyAttempts: 2, preferProxy: false }
  ).catch((error) => {
    if (strict) throw new Error(`${media.provider || 'source'}: audio URL check failed (${error?.message || error})`);
    return null;
  });

  if (!headish) return media;

  const ctype = (headish.headers.get('content-type') || '').toLowerCase();
  if (!headish.ok) throw new Error(`${media.provider || 'source'}: audio URL returned HTTP ${headish.status}`);
  const buf = Buffer.from(await headish.arrayBuffer());
  const sample = buf.slice(0, 64).toString('utf8').toLowerCase();
  if (sample.includes('<!doctype') || sample.includes('<html') || ctype.includes('text/html') || ctype.includes('application/json') || ctype.startsWith('text/')) {
    throw new Error(`${media.provider || 'source'}: link returned a text response, not media`);
  }
  if (ctype.startsWith('audio/')) media.format = ctype;
  if (buf.length > 0 && buf.length < 500 && !ctype.includes('audio') && !ctype.includes('video') && !ctype.includes('octet')) {
    throw new Error(`${media.provider || 'source'}: media too small/invalid`);
  }
  return media;
}

const SEARCH_CACHE = new Map();
const SEARCH_TTL_MS = 60 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shortError = (e) => String(e?.message || e || 'failed').slice(0, 160);

function withTimeout(promise, ms, label = 'timed out') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })
  ]).finally(() => clearTimeout(timer));
}

function toTrack(song = {}, videoId) {
  return {
    title: song?.title || 'YouTube track',
    artist: song?.artist || song?.channel || '',
    channel: song?.channel || song?.artist || '',
    duration: song?.duration || '',
    thumbnail: song?.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videoId,
    videoUrl: youtubeWatchUrl(videoId)
  };
}

async function searchWithYtSearch(input) {
  const yts = (await import('yt-search')).default;
  const search = await yts(input);
  const videos = (search?.videos || []).filter((item) => extractYouTubeVideoId(item?.url));
  const video = videos.find((item) => item.seconds > 0 && item.seconds <= 20 * 60) || videos[0];
  if (!video) throw new Error('yt-search: no results');
  return {
    title: video.title || '',
    artist: video.author?.name || '',
    duration: video.timestamp || '',
    thumbnail: video.thumbnail || '',
    videoId: extractYouTubeVideoId(video.url)
  };
}

async function searchWithDaveTech(input) {
  const searchUrl = buildDaveTechApiUrl('/youtube/music/search', { q: input, type: 'songs', limit: 3 });
  const { ok, status, data } = await fetchJson(searchUrl, {}, 12000);
  if (!ok || data?.status !== true) throw new Error(data?.error || `Dave Tech search HTTP ${status}`);
  const song = parseDaveTechMusicSearch(data).find((item) => extractYouTubeVideoId(youtubeWatchUrl(item.videoId)));
  if (!song) throw new Error('Dave Tech search: no results');
  return song;
}

async function searchWithApiziaul(input) {
  const media = await tryApiziaulQuery(input);
  const videoId = extractYouTubeVideoId(media.videoUrl || '');
  if (!videoId) throw new Error('apiziaul search: no video id');
  return { title: media.title || '', artist: media.channel || '', duration: media.duration || '', thumbnail: media.thumbnail || '', videoId };
}

async function lookupVideoMetadata(videoId) {
  const tasks = [
    (async () => {
      const yts = (await import('yt-search')).default;
      const video = await yts({ videoId });
      if (!video?.title) throw new Error('no metadata');
      return { title: video.title, artist: video.author?.name || '', duration: video.timestamp || '', thumbnail: video.thumbnail || '' };
    })(),
    getDaveTechMusicMetadata(videoId).then((song) => {
      if (!song?.title) throw new Error('no metadata');
      return song;
    })
  ];
  return withTimeout(Promise.any(tasks), 8000).catch(() => ({}));
}

export async function searchPlayTrack(query) {
  const input = String(query || '').trim();
  if (!input) throw new Error('Give a song name or YouTube link.');

  const requestedVideoId = extractYouTubeVideoId(input);
  if (requestedVideoId) return toTrack(await lookupVideoMetadata(requestedVideoId), requestedVideoId);

  const cacheKey = input.toLowerCase();
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.track;

  const cleaned = input
    .replace(/[([{].*?[)\]}]/g, ' ')
    .replace(/\b(official|video|audio|lyrics?|mp3|download|hd|4k)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const variants = [input];
  if (cleaned && cleaned.toLowerCase() !== cacheKey) variants.push(cleaned);
  variants.push(`${cleaned || input} song`);

  const errors = [];
  let song = null;
  for (const variant of variants) {
    const davePromise = searchWithDaveTech(variant);
    const ytsPromise = searchWithYtSearch(variant);
    davePromise.catch(() => {});
    ytsPromise.catch(() => {});
    // Match BLACK-PANTHER: yt-search is the primary result source, while Dave Tech remains a fallback.
    song = await withTimeout(ytsPromise, 15000, 'yt-search timed out').catch((e) => { errors.push(shortError(e)); return null; });
    if (!song) song = await withTimeout(davePromise, 4500, 'Dave Tech search timed out').catch((e) => { errors.push(shortError(e)); return null; });
    if (song?.videoId) break;
  }
  if (!song?.videoId) {
    song = await withTimeout(searchWithApiziaul(input), 25000, 'apiziaul search timed out').catch((e) => { errors.push(shortError(e)); return null; });
  }

  const videoId = extractYouTubeVideoId(youtubeWatchUrl(song?.videoId));
  if (!videoId) {
    console.error('[play] search failed:', errors.join(' | '));
    throw new Error('No matching YouTube track was found. Try a clearer title or a YouTube link.');
  }
  const track = toTrack(song, videoId);
  SEARCH_CACHE.set(cacheKey, { at: Date.now(), track });
  if (SEARCH_CACHE.size > 200) SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value);
  return track;
}

function buildPlaySources(videoId, videoUrl, meta) {
  return [
    { name: 'nayan', delay: 0, run: () => tryNayan(videoUrl) },
    { name: 'dave-download', delay: 0, run: () => tryDaveTechMusicDownload(videoId, meta, videoUrl) },
    { name: 'ellytube', delay: 0, run: () => tryEllyTube(videoUrl, 'mp3') },
    { name: 'apiziaul', delay: 0, run: () => tryApiziaulByUrl(videoUrl) },
    { name: 'ryuu', delay: 800, run: () => tryRyuu(videoUrl, 'mp3') },
    { name: 'sidycoders', delay: 800, run: () => trySidy(videoUrl) },
    { name: 'dave-play', delay: 1500, run: () => tryDaveTechPlay(videoUrl) },
    { name: 'dave-stream', delay: 3000, run: () => tryDaveTechMusicStream(videoId, meta, videoUrl) },
    { name: 'yt-dlp', delay: 5000, run: () => tryYtDlp(videoUrl, meta) }
  ];
}

// Starts every source at once (slower ones slightly staggered). The first source that returns a link is
// downloaded and verified; if that file is bad or stalls, the next ready source is tried immediately.
async function raceSources(sources, meta) {
  const errors = [];
  const ready = [];
  let pending = sources.length;
  let waiter = null;
  let finished = false;
  const notify = () => { if (waiter) { const wake = waiter; waiter = null; wake(); } };

  for (const source of sources) {
    (async () => {
      try {
        if (source.delay) await sleep(source.delay);
        if (finished) return;
        const media = await withTimeout(source.run(), 40000, `${source.name} timed out`);
        if (!media?.link && !Buffer.isBuffer(media?.buffer)) throw new Error('no media');
        media.provider = media.provider || source.name;
        if (!finished) ready.push(media);
      } catch (e) {
        errors.push(`${source.name}: ${shortError(e)}`);
      } finally {
        pending -= 1;
        notify();
      }
    })();
  }

  try {
    while (true) {
      while (ready.length) {
        const media = ready.shift();
        try {
          return await withTimeout(preparePlayMedia(media, meta), 60000, `${media.provider} download timed out`);
        } catch (e) {
          errors.push(`${media.provider}: ${shortError(e)}`);
        }
      }
      if (pending === 0) break;
      await new Promise((resolve) => { waiter = resolve; });
    }
  } finally {
    finished = true;
  }
  throw new Error(`Play failed: ${errors.join(' | ')}`);
}

export async function playSearchDownload(query, track = {}) {
  const input = String(query || '').trim();
  if (!input) throw new Error('Give a song name or YouTube link.');

  let meta = track && typeof track === 'object' ? { ...track } : {};
  let videoId = extractYouTubeVideoId(input);
  if (!videoId) {
    meta = await searchPlayTrack(input);
    videoId = meta.videoId;
  } else if (!meta.title) {
    meta = { ...(await lookupVideoMetadata(videoId)), ...meta };
  }
  const videoUrl = youtubeWatchUrl(videoId);
  return raceSources(buildPlaySources(videoId, videoUrl, meta), meta);
}

async function tryDaveTechPlay(queryOrUrl) {
  const endpoint = buildDaveTechApiUrl('/downloader/ytplay', { q: queryOrUrl });
  const { ok, status, data } = await fetchJson(endpoint, {}, 95000);
  if (!ok || data?.status !== true) throw new Error(data?.error || `Dave Tech Play HTTP ${status}`);
  const media = parseDaveTechPlayResponse(data);
  if (!media) throw new Error('Dave Tech Play: no audio URL');
  return media;
}

async function tryNayan(videoUrl) {
  const endpoint = String(process.env.NAYAN_YOUTUBE_API || 'https://nayan-video-downloader.vercel.app/ytdown').trim();
  const url = new URL(endpoint);
  url.searchParams.set('url', videoUrl);
  const { ok, status, data } = await fetchJson(url.toString(), {}, 30000);
  const result = data?.data || data?.result || {};
  if (!ok || data?.status !== true || typeof result.audio !== 'string' || !/^https?:\/\//i.test(result.audio)) {
    throw new Error(data?.error || `Nayan HTTP ${status}`);
  }
  return {
    title: result.title || 'YouTube audio',
    channel: result.channel || '',
    duration: result.duration || result.durationSeconds || '',
    thumbnail: result.thumb || result.thumbnail || '',
    link: result.audio,
    format: 'mp3',
    provider: 'nayan',
    videoId: extractYouTubeVideoId(videoUrl),
    videoUrl
  };
}

async function tryYtDlp(videoUrl, fallbackMetadata = {}) {
  const ytDlp = await getYtDlp();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ultra-guru-play-'));
  const outputTemplate = path.join(workDir, 'audio.%(ext)s');

  try {
    const args = [
      videoUrl,
      '--no-playlist',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--output', outputTemplate,
      '--quiet',
      '--no-warnings',
      '--no-progress',
      '--force-overwrites'
    ];
    if (process.env.FFMPEG_PATH) args.push('--ffmpeg-location', process.env.FFMPEG_PATH);
    await withTimeout(ytDlp.execPromise(args), 110000, 'yt-dlp timed out');

    const files = await fs.readdir(workDir);
    const audioFile = files.find((file) => /\.(mp3|m4a|webm|opus|ogg|wav)$/i.test(file));
    if (!audioFile) throw new Error('yt-dlp produced no audio file');

    const buffer = await fs.readFile(path.join(workDir, audioFile));
    if (!buffer.length) throw new Error('yt-dlp produced an empty audio file');
    return {
      buffer,
      title: fallbackMetadata.title || 'YouTube audio',
      channel: fallbackMetadata.artist || fallbackMetadata.channel || '',
      duration: fallbackMetadata.duration || '',
      thumbnail: fallbackMetadata.thumbnail || '',
      format: path.extname(audioFile).slice(1).toLowerCase() || 'mp3',
      provider: 'yt-dlp',
      videoId: fallbackMetadata.videoId || extractYouTubeVideoId(videoUrl),
      videoUrl
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function transcodeToMp3(buffer, extension = 'bin') {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ultra-guru-transcode-'));
  const inputPath = path.join(workDir, `source.${extension || 'bin'}`);
  const outputPath = path.join(workDir, 'audio.mp3');
  try {
    await fs.writeFile(inputPath, buffer);
    let ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    if (!process.env.FFMPEG_PATH) {
      try {
        const module = await import('@ffmpeg-installer/ffmpeg');
        ffmpegPath = module.default?.path || module.path || ffmpegPath;
      } catch {}
    }
    await execFileAsync(ffmpegPath, [
      '-y', '-i', inputPath, '-vn',
      '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2',
      '-f', 'mp3', outputPath
    ], { timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
    const output = await fs.readFile(outputPath);
    if (!output.length) throw new Error('FFmpeg produced an empty MP3');
    return output;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getDaveTechMusicMetadata(videoId, fallbackMetadata = {}) {
  let song = { ...fallbackMetadata };
  if (!song?.title || !song?.artist || !song?.duration || !song?.thumbnail) {
    try {
      const songUrl = buildDaveTechApiUrl(`/youtube/music/song/${encodeURIComponent(videoId)}`);
      const { ok, status, data } = await fetchJson(songUrl, {}, 6000);
      if (!ok || data?.status !== true) throw new Error(data?.error || `Dave Tech song metadata HTTP ${status}`);
      song = { ...parseDaveTechMusicSong(data), ...song };
    } catch {}
  }
  return song;
}

async function tryDaveTechMusicDownload(videoId, fallbackMetadata = {}, videoUrl = youtubeWatchUrl(videoId)) {
  const song = await getDaveTechMusicMetadata(videoId, fallbackMetadata);
  const link = buildDaveTechAudioDownloadUrl(videoId, 'mp3');
  if (!link) throw new Error('Dave Tech download: invalid YouTube video ID');
  return {
    title: song?.title || 'YouTube audio',
    channel: song?.artist || '',
    duration: song?.duration || '',
    thumbnail: song?.thumbnail || '',
    link,
    format: 'mp3',
    provider: 'dave-tech-music-download',
    videoId,
    videoUrl
  };
}

async function tryDaveTechMusicStream(videoId, fallbackMetadata = {}, videoUrl = youtubeWatchUrl(videoId)) {
  const song = await getDaveTechMusicMetadata(videoId, fallbackMetadata);

  const link = buildDaveTechAudioStreamUrl(videoId);
  if (!link) throw new Error('Dave Tech stream: invalid YouTube video ID');
  const media = {
    title: song?.title || 'YouTube audio',
    channel: song?.artist || '',
    duration: song?.duration || '',
    thumbnail: song?.thumbnail || '',
    link,
    format: 'webm',
    provider: 'dave-tech-music-stream',
    videoId,
    videoUrl
  };
  await assertDownloadable(media, { strict: true });
  return media;
}

async function preparePlayMedia(media, meta = {}) {
  if (!Buffer.isBuffer(media.buffer)) media.buffer = await downloadBuffer(media.link);
  if (media.provider === 'nayan' || !/^mp3$|^audio\/mpeg$/i.test(String(media.format || ''))) {
    media.buffer = await transcodeToMp3(media.buffer, media.format || 'bin');
    media.format = 'mp3';
  }
  assertCompleteMp3(media.buffer, media.duration || meta.duration);
  if (meta.title && (!media.title || /^(untitled|youtube (audio|track))$/i.test(media.title))) media.title = meta.title;
  media.channel = media.channel || meta.artist || meta.channel || '';
  media.duration = media.duration || meta.duration || '';
  media.thumbnail = media.thumbnail || meta.thumbnail || '';
  media.videoId = media.videoId || meta.videoId || '';
  media.videoUrl = media.videoUrl || meta.videoUrl || '';
  return media;
}

export async function downloadBuffer(url, timeoutMs = 120000) {
  const pathname = (() => {
    try { return new URL(url).pathname; } catch { return ''; }
  })();
  if (/\/stream\/audio\/[A-Za-z0-9_-]{11}$/.test(pathname)) {
    return downloadDaveTechAudioRanges(url, timeoutMs);
  }

  const res = await proxyFetch(
    url,
    {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*',
        Referer: 'https://ellytube.web.id/'
      },
      timeout: timeoutMs
    },
    { maxProxyAttempts: 4, preferProxy: false }
  );
  if (!res.ok) throw new Error(`Media download failed: ${res.status}`);
  const contentLength = Number(res.headers?.get?.('content-length'));
  const contentEncoding = String(res.headers?.get?.('content-encoding') || '').toLowerCase();
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (!buf.length) throw new Error('Media download empty');
  if (Number.isSafeInteger(contentLength) && contentLength > 0 && (!contentEncoding || contentEncoding === 'identity') && buf.length !== contentLength) {
    throw new Error(`Media download incomplete: expected ${contentLength} bytes, received ${buf.length}`);
  }
  const sample = buf.slice(0, 64).toString('utf8').toLowerCase();
  if (sample.includes('<!doctype') || sample.includes('<html')) {
    throw new Error('Media download returned HTML instead of file');
  }
  if (buf.length < 10000) {
    throw new Error(`Media file too small (${buf.length} bytes)`);
  }
  return buf;
}

async function downloadDaveTechAudioRanges(url, timeoutMs) {
  const chunkSize = 1024 * 1024;
  const chunks = [];
  let totalBytes = null;
  let offset = 0;

  while (totalBytes === null || offset < totalBytes) {
    const end = totalBytes === null
      ? offset + chunkSize - 1
      : Math.min(offset + chunkSize - 1, totalBytes - 1);
    let response = null;
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await proxyFetch(
          url,
          {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              Accept: '*/*',
              Range: `bytes=${offset}-${end}`,
              Referer: 'https://ellytube.web.id/'
            },
            timeout: timeoutMs
          },
          { maxProxyAttempts: 2, preferProxy: false }
        );
        if (response.ok) break;
        const detail = (await response.text()).slice(0, 240);
        lastError = new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      } catch (error) {
        lastError = error;
      }
      response = null;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
    }

    if (!response) throw new Error(`Dave Tech audio range ${offset}-${end} failed: ${lastError?.message || 'unknown error'}`);
    if (response.status !== 206) throw new Error(`Dave Tech audio range ${offset}-${end} returned HTTP ${response.status}, expected 206`);

    const contentRange = response.headers.get('content-range') || '';
    const match = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
    if (!match) throw new Error(`Dave Tech audio range returned invalid Content-Range: ${contentRange || 'missing'}`);
    const [, rangeStart, rangeEnd, rangeTotal] = match.map(Number);
    if (rangeStart !== offset || rangeEnd > end || rangeEnd < offset) {
      throw new Error(`Dave Tech audio range mismatch: requested ${offset}-${end}, received ${contentRange}`);
    }
    if (totalBytes !== null && rangeTotal !== totalBytes) {
      throw new Error(`Dave Tech audio size changed during download (${totalBytes} to ${rangeTotal})`);
    }
    if (rangeTotal > 100 * 1024 * 1024) throw new Error(`Dave Tech audio exceeds the 100 MB download limit (${rangeTotal} bytes)`);

    const chunk = Buffer.from(await response.arrayBuffer());
    const expectedBytes = rangeEnd - rangeStart + 1;
    if (chunk.length !== expectedBytes || chunk.length === 0) {
      throw new Error(`Dave Tech audio range length mismatch: expected ${expectedBytes}, received ${chunk.length}`);
    }
    totalBytes = rangeTotal;
    chunks.push(chunk);
    offset = rangeEnd + 1;
  }

  const audio = Buffer.concat(chunks, totalBytes || undefined);
  if (audio.length < 10000) throw new Error(`Dave Tech audio file too small (${audio.length} bytes)`);
  const signature = audio.subarray(0, 4).toString('hex');
  if (signature !== '1a45dfa3') throw new Error('Dave Tech stream does not have a valid WebM/EBML header');
  return audio;
}

export default ryuuYoutube;
