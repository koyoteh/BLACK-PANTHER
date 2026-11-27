export const DAVE_TECH_API_ORIGIN = String(
  process.env.DAVE_TECH_API_ORIGIN || 'https://obitotechapis.devs.surf'
).trim().replace(/\/+$/, '');

export function buildDaveTechApiUrl(path, params = {}) {
  const route = String(path || '').replace(/^\/+/, '');
  const url = new URL(route, `${DAVE_TECH_API_ORIGIN}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function parseDaveTechMusicSearch(data) {
  if (!data || data.status !== true) return [];
  const results = data.result?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      title: item.title || '',
      artist: item.artist?.name || item.artists?.map(artist => artist?.name).filter(Boolean).join(', ') || '',
      duration: item.duration_seconds || item.duration || '',
      thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || '',
      videoId: item.video_id || item.videoId || (item.type === 'song' ? item.id : '') || ''
    }));
}

export function parseDaveTechMusicSong(data) {
  if (!data || data.status !== true || !data.result || typeof data.result !== 'object') return null;
  const item = data.result;
  const videoId = item.video_id || item.videoId || (item.type === 'song' ? item.id : '') || '';
  if (!videoId) return null;
  return {
    title: item.title || '',
    artist: item.artist?.name || item.artists?.map(artist => artist?.name).filter(Boolean).join(', ') || '',
    duration: item.duration_seconds || item.duration || '',
    thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || '',
    videoId
  };
}

export function parseDaveTechPlayResponse(data) {
  if (!data || data.status !== true) return null;
  const layers = [data.result?.result, data.result?.data, data.result, data.data, data];
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const link = layer.download_url || layer.downloadUrl || layer.link || layer.url || layer.audio;
    if (typeof link !== 'string' || !/^https?:\/\//i.test(link)) continue;
    return {
      title: layer.title || 'Untitled',
      channel: layer.channel || layer.artist || layer.author || '',
      duration: layer.duration || layer.duration_seconds || '',
      thumbnail: layer.thumbnail || layer.thumb || '',
      filename: layer.filename || '',
      link,
      format: String(layer.format || layer.mimeType || layer.mimetype || '').toLowerCase(),
      provider: 'dave-tech'
    };
  }
  return null;
}

export function isYouTubeUrl(value) {
  return /(?:https?:\/\/)?(?:youtu\.be\/|(?:(?:www|m|music)\.)?youtube\.com\/)/i.test(String(value || '').trim());
}

export function youtubeWatchUrl(videoId) {
  const id = String(videoId || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return '';
  return `https://www.youtube.com/watch?v=${id}`;
}

export function extractYouTubeVideoId(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0]?.match(/^[A-Za-z0-9_-]{11}$/)?.[0] || '';
    if (!['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) return '';
    const queryId = url.searchParams.get('v');
    if (queryId && /^[A-Za-z0-9_-]{11}$/.test(queryId)) return queryId;
    const pathId = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
    return pathId?.[1] || '';
  } catch {
    return '';
  }
}

export function buildDaveTechAudioStreamUrl(videoId) {
  const id = String(videoId || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return '';
  return buildDaveTechApiUrl(`/stream/audio/${id}`);
}

export function buildDaveTechAudioDownloadUrl(videoId, format = 'mp3') {
  const id = String(videoId || '').trim();
  const normalizedFormat = String(format || '').toLowerCase();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id) || !['mp3', 'm4a'].includes(normalizedFormat)) return '';
  return buildDaveTechApiUrl(`/download/audio/${id}`, { format: normalizedFormat });
}

export function audioMimeType(format) {
  const normalized = String(format || '').toLowerCase().split(/[;\s]/)[0];
  if (normalized.includes('/')) return normalized;
  if (normalized === 'webm' || normalized.includes('opus')) return 'audio/webm';
  if (normalized === 'm4a' || normalized === 'mp4' || normalized === 'aac') return 'audio/mp4';
  if (normalized === 'ogg' || normalized === 'oga') return 'audio/ogg';
  if (normalized === 'wav') return 'audio/wav';
  return 'audio/mpeg';
}

export function audioFileExtension(mimetype) {
  const normalized = String(mimetype || '').toLowerCase().split(/[;\s]/)[0];
  if (normalized === 'audio/webm' || normalized === 'video/webm') return 'webm';
  if (normalized === 'audio/mp4' || normalized === 'audio/x-m4a') return 'm4a';
  if (normalized === 'audio/ogg' || normalized === 'audio/opus') return 'ogg';
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return 'wav';
  return 'mp3';
}
