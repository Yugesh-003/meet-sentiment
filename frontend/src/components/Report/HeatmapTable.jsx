import { EMOTION_KEYS, EMOTION_COLORS } from '../../utils/emotionUtils'

const POSITIVE_EMOTIONS = new Set(['happy', 'surprise'])

function cellBg(emotion, value) {
  const intensity = Math.round(value * 2.55) // 0→255
  const hex = intensity.toString(16).padStart(2, '0')
  const color = POSITIVE_EMOTIONS.has(emotion) ? `#22c55e${hex}` : `#ef4444${hex}`
  return color
}

export default function HeatmapTable({ perParticipant = [] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
              Participant
            </th>
            {EMOTION_KEYS.map((k) => (
              <th key={k} className="px-3 py-3 text-xs font-semibold uppercase tracking-wider capitalize"
                style={{ color: EMOTION_COLORS[k] }}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {perParticipant.map((p, i) => (
            <tr key={p.participant_name} className={i % 2 === 0 ? 'bg-gray-900/50' : ''}>
              <td className="px-4 py-3 text-xs font-medium text-gray-300 font-mono truncate max-w-[8rem]">
                {p.participant_name}
              </td>
              {EMOTION_KEYS.map((k) => {
                const val = Math.round((p.avg_emotions?.[k] || 0) * 100)
                return (
                  <td key={k} className="px-3 py-3 text-center text-xs font-semibold"
                    style={{ background: cellBg(k, val / 100) }}>
                    {val}%
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
