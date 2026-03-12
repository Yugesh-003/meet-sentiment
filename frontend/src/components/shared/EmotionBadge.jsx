import { getEmotionColor } from '../../utils/emotionUtils'

const sizeClasses = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1', lg: 'text-base px-4 py-1.5' }

export default function EmotionBadge({ emotion, size = 'md' }) {
  const color = getEmotionColor(emotion)
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full capitalize ${sizeClasses[size]}`}
      style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}
    >
      {emotion || 'neutral'}
    </span>
  )
}
