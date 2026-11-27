import axios from 'axios'
import yts from 'yt-search'

// Existing download-provider chain (EllyTube -> Apiziaul -> Ryuu -> Sidycoders),
// same flow (react ⌛, send the info card, send the audio, react ✅), with the table-style card.
const RYUU_KEY = process.env.RYUU_API_KEY || ''
const ELLYTUBE_KEY = process.env.ELLYTUBE_API_KEY || ''
const SIDYCODERS_KEY = process.env.SIDYCODERS_API_KEY || ''
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const REFERER = 'https://ellytube.web.id/'

const short = e => String((e && e.message) || e || 'error').replace(/\s+/g, ' ').slice(0, 110)
const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s))

// ------------------------------------------------------------------ API helpers
function pickMedia(data) {
  if (!data || typeof data !== 'object') return null
  const layers = [data?.result?.result, data?.result?.data, data?.data?.result, data?.result, data?.data, data]
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue
    const link = layer.link || layer.url || layer.download || layer.downloadUrl || layer.cdn || layer.media || layer.audio || layer.mp3
    if (link && typeof link === 'string' && /^https?:\/\//i.test(link)) {
      return {
        title: layer.title || data?.result?.title || 'Untitled',
        duration: layer.duration || layer.durationSeconds || '',
        thumbnail: layer.thumbnail || layer.thumb || '',
        channel: layer.channel || layer.author || '',
        link
      }
    }
  }
  return null
}

async function fetchJson(url, headers = {}, timeout = 90000) {
  const res = await axios.get(url, {
    timeout,
    headers: { Accept: 'application/json', 'User-Agent': UA, ...headers },
    validateStatus: () => true,
    responseType: 'text',
    transformResponse: r => r
  })
  let data
  try { data = JSON.parse(res.data) } catch { throw new Error(`invalid JSON (${res.status})`) }
  if (res.status === 401) throw new Error('API key invalid')
  if (res.status === 429) throw new Error('API rate limited')
  return { ok: res.status >= 200 && res.status < 300, status: res.status, data }
}

async function tryEllyTube(url) {
  if (!ELLYTUBE_KEY) throw new Error('ELLYTUBE_API_KEY is not configured')
  const params = new URLSearchParams({ url, type: 'audio', quality: '320kbps', apikey: ELLYTUBE_KEY })
  const { ok, status, data } = await fetchJson(`https://ellytube.web.id/api/v1/youtube/download?${params}`)
  if (!ok || data?.status === false) throw new Error(`EllyTube HTTP ${status}`)
  const media = pickMedia(data)
  if (!media) throw new Error('EllyTube: no media link')
  media.provider = 'ellytube'
  media.channel = media.channel || data?.result?.author || ''
  media.duration = media.duration || data?.result?.duration || ''
  media.thumbnail = media.thumbnail || data?.result?.thumbnail || ''
  return media
}

async function tryApiziaulByUrl(url) {
  try {
    const { ok, data } = await fetchJson(`https://apiziaul.vercel.app/api/downloader/ytmp3?url=${encodeURIComponent(url)}`)
    const media = ok && pickMedia(data)
    if (media) { media.provider = 'apiziaul-url'; return media }
  } catch { /* try the query endpoint */ }
  const { ok, status, data } = await fetchJson(`https://apiziaul.vercel.app/api/downloader/ytplaymp3?query=${encodeURIComponent(url)}`)
  if (!ok) throw new Error(`apiziaul HTTP ${status}`)
  const media = pickMedia(data)
  if (!media) throw new Error('apiziaul: no media link')
  media.provider = 'apiziaul'
  return media
}

async function tryApiziaulQuery(query) {
  const { ok, status, data } = await fetchJson(`https://apiziaul.vercel.app/api/downloader/ytplaymp3?query=${encodeURIComponent(query)}`)
  if (!ok) throw new Error(`apiziaul query HTTP ${status}`)
  const media = pickMedia(data)
  if (!media) throw new Error('apiziaul query: no media link')
  media.provider = 'apiziaul-query'
  return media
}

async function tryRyuu(url) {
  if (!RYUU_KEY) throw new Error('RYUU_API_KEY is not configured')
  const { ok, status, data } = await fetchJson(
    `https://api.ryuu-dev.my.id/downloader/youtube?url=${encodeURIComponent(url)}&format=mp3`,
    { 'X-RYUU-APIKEY': RYUU_KEY }, 95000)
  if (!ok) throw new Error(`Ryuu HTTP ${status}`)
  const media = pickMedia(data)
  if (!media) throw new Error('Ryuu: no media link')
  media.provider = 'ryuu'
  return media
}

async function trySidy(url) {
  if (!SIDYCODERS_KEY) throw new Error('SIDYCODERS_API_KEY is not configured')
  const params = new URLSearchParams({ url, format: 'mp3', apikey: SIDYCODERS_KEY })
  const { ok, status, data } = await fetchJson(
    `https://api.sidycoders.xyz/api/ytdl?${params}`, {}, 60000)
  if (!ok) throw new Error(`sidy HTTP ${status}`)
  const link = data?.cdn || data?.result?.cdn || data?.url
  if (!link) throw new Error('sidy: no media link')
  return {
    title: data?.title || data?.result?.title || 'Untitled', duration: data?.duration || '',
    thumbnail: data?.thumbnail || '', channel: '', link, provider: 'sidycoders'
  }
}

// seconds from "3:20", "01:03:20" or a plain number
function toSeconds(d) {
  if (!d) return 0
  if (typeof d === 'number') return d
  const parts = String(d).split(':').map(Number)
  if (parts.some(Number.isNaN)) return Number(d) || 0
  return parts.reduce((a, n) => a * 60 + n, 0)
}

// Download the file and make sure it is really audio (HTML pages and tiny stubs are rejected).
async function downloadBuffer(link, seconds = 0) {
  const res = await axios.get(link, {
    responseType: 'arraybuffer', timeout: 120000,
    maxContentLength: 80 * 1048576, maxBodyLength: 80 * 1048576,
    headers: { 'User-Agent': UA, Accept: '*/*', Referer: REFERER },
    validateStatus: () => true
  })
  if (res.status < 200 || res.status >= 300) throw new Error(`Media download failed: ${res.status}`)
  const buf = Buffer.from(res.data)
  const sample = buf.slice(0, 64).toString('utf8').toLowerCase()
  if (sample.includes('<!doctype') || sample.includes('<html')) throw new Error('link returned a web page, not audio')
  const minBytes = Math.max(30000, seconds * 3000)
  if (buf.length < minBytes) throw new Error(`file too small (${Math.round(buf.length / 1024)} KB)`)
  return buf
}

// Try each source in order; the first one whose file really downloads wins.
async function getAudio(url, seconds = 0) {
  const errors = []
  const sources = [
    ['ellytube', () => tryEllyTube(url)],
    ['apiziaul', () => tryApiziaulByUrl(url)],
    ['ryuu', () => tryRyuu(url)],
    ['sidycoders', () => trySidy(url)]
  ]
  for (const [name, fn] of sources) {
    try {
      const media = await fn()
      const buffer = await downloadBuffer(media.link, seconds || toSeconds(media.duration))
      return { media, buffer }
    } catch (e) { errors.push(`${name}: ${short(e)}`) }
  }
  const err = new Error('all download sources failed')
  err.attempts = errors
  throw err
}

async function playSearchDownload(query) {
  const errors = []
  try {
    const media = await tryApiziaulQuery(query)
    const buffer = await downloadBuffer(media.link, toSeconds(media.duration))
    return { media, buffer }
  } catch (e) { errors.push(`apiziaul-search: ${short(e)}`) }

  const search = await yts(query)
  const video = search?.videos?.[0]
  if (!video?.url) throw Object.assign(new Error('No YouTube results found'), { attempts: errors })
  try {
    const { media, buffer } = await getAudio(video.url, video.seconds || 0)
    media.title = media.title && media.title !== 'Untitled' ? media.title : video.title
    media.thumbnail = media.thumbnail || video.thumbnail
    media.channel = media.channel || video.author?.name || ''
    media.duration = media.duration || video.timestamp || ''
    return { media, buffer }
  } catch (e) {
    throw Object.assign(new Error(e.message), { attempts: [...errors, ...(e.attempts || [])] })
  }
}

const safeFileName = name =>
  (String(name || 'audio').replace(/[^\w\s\-.()[\]]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'audio') + '.mp3'

// ------------------------------------------------------------------ the command
export async function runPlay({ sock, from, text, msg, config }) {
  const botName = config?.BOT_NAME || 'BLACK PANTHER'
  const ownerName = config?.OWNER_NAME || 'GuruTech'
  const q = { quoted: msg }
  const react = async emoji => { try { await sock.sendMessage(from, { react: { text: emoji, key: msg.key } }) } catch {} }
  const query = String(text || '').trim()

  await react('⌛')
  if (!query) {
    await react('❌')
    return sock.sendMessage(from, { text: 'Give a song name OR a YouTube link.\nExample: .play harlem shake' }, q)
  }

  try {
    const isLink = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/)/i.test(query)
    const { media, buffer } = isLink ? await getAudio(query) : await playSearchDownload(query)

    const title = clip(media.title || query, 60)
    const channel = clip(media.channel || 'Unknown', 40)
    const duration = media.duration ? String(media.duration) : '—'
    const sizeMb = (buffer.length / 1048576).toFixed(1)

    // Same look as the bot menu (╭─⌈ ⌋ header, │ rows with ›, ╰⊷ footer), with ├ dividers so the
    // rows read as a connected table. Every line starts with "> " to keep WhatsApp's grey quote block.
    const divider = '> ├──────────────'
    const caption = [
      `> ╭─⌈ 🔥 *${botName}*  ·  _MUSIC PLAYER_ ⌋`,
      `> │ 🎵 *Title*  ›  ${title}`,
      divider,
      `> │ 👤 *Channel*  ›  ${channel}`,
      divider,
      `> │ ⏱️ *Duration*  ›  ${duration}`,
      divider,
      `> │ 🔊 *Audio*  ›  MP3 · ${sizeMb} MB`,
      `> ╰⊷ ✨ _Powered by ${ownerName}_`
    ].join('\n')

    try {
      if (media.thumbnail) await sock.sendMessage(from, { image: { url: media.thumbnail }, caption }, q)
      else await sock.sendMessage(from, { text: caption }, q)
    } catch { try { await sock.sendMessage(from, { text: caption }, q) } catch {} }

    await sock.sendMessage(from, {
      audio: buffer, mimetype: 'audio/mpeg', ptt: false, fileName: safeFileName(media.title || query)
    }, q)
    await react('✅')
  } catch (error) {
    console.error('[PLAY] failed:', (error.attempts || [short(error)]).join(' | '))
    await react('❌')
    const detail = (error.attempts || []).slice(0, 6).map(a => `• ${a}`).join('\n')
    await sock.sendMessage(from, {
      text: [
        `> ╭─⌈ 🔥 *${botName}*  ·  _MUSIC PLAYER_ ⌋`,
        `> │ ❌ *Play failed*  ›  ${error.message || error}`,
        ...(detail ? ['> ├──────────────', ...(error.attempts || []).slice(0, 6).map(a => `> │ ▫️ ${a}`)] : []),
        `> ╰⊷ ✨ _Powered by ${ownerName}_`
      ].join('\n')
    }, q)
  }
}

export const commands = [
  {
    name: 'play',
    description: 'Search and download a song from YouTube.',
    category: 'Search',
    execute: runPlay
  }
]
