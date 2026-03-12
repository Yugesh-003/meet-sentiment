import { getEmotionEmoji, getEmotionColor } from '../../utils/emotionUtils'
import { formatTime } from '../../utils/formatters'

/** Find top-N stress spikes: frames with highest angry+fear+disgust combined score */
function findSpikes(logs, n = 3) {
  return logs
    .map((log) => ({
      ...log,
      stressScore: (log.angry || 0) + (log.fear || 0) + (log.disgust || 0),
    }))
    .sort((a, b) => b.stressScore - a.stressScore)
    .slice(0, n)
}

export default function StressSpikes({ logs = [] }) {
  const spikes = findSpikes(logs)

  if (!spikes.length) {
    return (
      <div className="card p-6 text-center text-gray-600 text-sm">No stress spikes detected 🎉</div>
    )
  }

  return (
    <div className="card divide-y divide-gray-800">
      {spikes.map((spike, i) => {
        const emotion = spike.dominant_emotion || 'neutral'
        const color = getEmotionColor(emotion)
        const emoji = getEmotionEmoji(emotion)
        const conf = Math.round(spike.confidence * 100)
        return (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="text-red-500 text-xl shrink-0">⚠️</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-200 truncate">{spike.participant_name}</span>
                <span className="text-xs font-mono text-gray-500">{formatTime(spike.timestamp)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg">{emoji}</span>
                <span className="text-xs font-semibold capitalize" style={{ color }}>{emotion}</span>
                <span className="text-xs text-gray-500">{conf}% confidence</span>
              </div>
            </div>
            {/* Stress bar */}
            <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden shrink-0">
              <div
                className="h-full rounded-full bg-red-500"
                style={{ width: `${Math.round(spike.stressScore * 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
