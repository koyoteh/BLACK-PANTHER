const BITRATES = {
  '1-3': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0],
  '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
  '1-1': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  '2-3': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
  '2-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
  '2-1': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
};
const SAMPLE_RATES = [44100, 48000, 32000];

function frameHeader(buffer, offset) {
  if (offset + 4 > buffer.length || buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) return null;
  const version = (buffer[offset + 1] >> 3) & 0x03;
  const layer = (buffer[offset + 1] >> 1) & 0x03;
  const bitrateIndex = (buffer[offset + 2] >> 4) & 0x0f;
  const sampleRateIndex = (buffer[offset + 2] >> 2) & 0x03;
  if (version === 1 || layer === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return null;

  const mpegVersion = version === 3 ? 1 : 2;
  const layerName = layer === 3 ? 3 : layer;
  const bitrateKbps = BITRATES[`${mpegVersion}-${layerName}`]?.[bitrateIndex];
  const sampleRate = SAMPLE_RATES[sampleRateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
  if (!bitrateKbps || !sampleRate) return null;

  const padding = (buffer[offset + 2] >> 1) & 0x01;
  const samplesPerFrame = layer === 3 ? 384 : layer === 2 ? 1152 : (version === 3 ? 1152 : 576);
  const coefficient = layer === 3 ? 12 : (layer === 1 && version !== 3 ? 72 : 144);
  const frameLength = layer === 3
    ? (Math.floor((coefficient * bitrateKbps * 1000) / sampleRate) + padding) * 4
    : Math.floor((coefficient * bitrateKbps * 1000) / sampleRate) + padding;
  if (frameLength < 4) return null;
  return { frameLength, seconds: samplesPerFrame / sampleRate };
}

function firstAudioFrameOffset(buffer) {
  if (buffer.length >= 10 && buffer.subarray(0, 3).toString('ascii') === 'ID3') {
    const size = (buffer[6] & 0x7f) * 2097152
      + (buffer[7] & 0x7f) * 16384
      + (buffer[8] & 0x7f) * 128
      + (buffer[9] & 0x7f);
    return 10 + size + ((buffer[3] === 4 && (buffer[5] & 0x10)) ? 10 : 0);
  }
  return 0;
}

export function mp3DurationSeconds(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
  let offset = firstAudioFrameOffset(buffer);
  let duration = 0;
  let frames = 0;
  while (offset + 4 <= buffer.length) {
    const header = frameHeader(buffer, offset);
    if (!header || offset + header.frameLength > buffer.length) break;
    duration += header.seconds;
    frames += 1;
    offset += header.frameLength;
  }
  return frames ? duration : null;
}

export function durationSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (/^\d+(?::\d{1,2}){1,2}$/.test(text)) {
    return text.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
  }
  return null;
}

export function assertCompleteMp3(buffer, expectedDuration) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const signatureIsMp3 = bytes.subarray(0, 3).toString('ascii') === 'ID3' || frameHeader(bytes, firstAudioFrameOffset(bytes));
  if (!signatureIsMp3) return { checked: false, duration: null };

  const actual = mp3DurationSeconds(bytes);
  if (!actual) throw new Error('Downloaded MP3 contains no complete MPEG audio frames');
  const expected = durationSeconds(expectedDuration);
  if (!expected) return { checked: false, duration: actual };

  const allowedShortfall = Math.max(3, expected * 0.02);
  if (actual < expected - allowedShortfall) {
    throw new Error(`Downloaded MP3 is incomplete: decoded ${actual.toFixed(2)}s of expected ${expected.toFixed(2)}s`);
  }
  return { checked: true, duration: actual, expectedDuration: expected };
}
