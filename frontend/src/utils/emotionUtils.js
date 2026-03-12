export const EMOTION_COLORS = {
  happy:    '#22c55e',
  sad:      '#3b82f6',
  angry:    '#ef4444',
  fear:     '#f97316',
  surprise: '#a855f7',
  disgust:  '#84cc16',
  neutral:  '#94a3b8',
}

export const EMOTION_EMOJI = {
  happy:    '😊',
  sad:      '😢',
  angry:    '😠',
  fear:     '😨',
  surprise: '😲',
  neutral:  '😐',
  disgust:  '🤢',
}

export const EMOTION_KEYS = ['happy', 'sad', 'angry', 'fear', 'surprise', 'disgust', 'neutral']

/** Engagement Score 0–100 */
export const engagementScore = (emotions = {}) => {
  const val = Math.round(
    (emotions.happy + emotions.surprise) * 100 -
    (emotions.sad + emotions.angry + emotions.disgust) * 50
  )
  return Math.max(0, Math.min(100, val))
}

/** Stress Index 0–100 */
export const stressIndex = (emotions = {}) => {
  const val = Math.round((emotions.angry + emotions.fear + emotions.disgust) * 100)
  return Math.max(0, Math.min(100, val))
}

export function getEmotionColor(emotion) {
  return EMOTION_COLORS[emotion?.toLowerCase()] || '#94a3b8'
}

export function getEmotionEmoji(emotion) {
  return EMOTION_EMOJI[emotion?.toLowerCase()] || '😐'
}
