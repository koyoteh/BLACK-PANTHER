export const DEFAULT_STATUS_REACTIONS = [
  '❤️', '🔥', '😂', '😍', '👏', '🥰', '💯', '😭', '🤣', '🙏', '👌', '💪',
  '🤩', '😎', '🥳', '✨', '💀', '🤯', '😤', '💅', '👀', '🎉', '😈', '🤫', '🫶'
]

export function isSingleEmoji(value) {
  const emoji = String(value || '').trim()
  if (!emoji || !Intl.Segmenter) return false
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(emoji)]
  return graphemes.length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(emoji)
}

export function normalizeStatusReaction(value) {
  const setting = String(value || '').trim()
  if (!setting || setting.toLowerCase() === 'random' || !isSingleEmoji(setting)) return 'random'
  return setting
}

export function chooseStatusReactionEmoji(setting = 'random', random = Math.random, customPool = []) {
  const normalized = normalizeStatusReaction(setting)
  if (normalized !== 'random') return normalized
  const configuredPool = Array.isArray(customPool) ? customPool.map(value => String(value || '').trim()).filter(Boolean) : []
  const pool = configuredPool.length ? configuredPool : DEFAULT_STATUS_REACTIONS
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length))
  return pool[index]
}
