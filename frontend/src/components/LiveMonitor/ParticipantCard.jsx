import { useState, useRef, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import EmotionBadge from '../shared/EmotionBadge'
import { getEmotionColor, getEmotionEmoji, EMOTION_KEYS } from '../../utils/emotionUtils'

export default function ParticipantCard({ participant, history = [] }) {
  const { participant_name, dominant_emotion, confidence } = participant
  const prevEmotion = useRef(dominant_emotion)
  const [pulse, setPulse] = useState(false)

  // Pulse animation when emotion changes
  useEffect(() => {
    if (dominant_emotion !== prevEmotion.current) {
      prevEmotion.current = dominant_emotion
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 700)
      return () => clearTimeout(t)
    }
  }, [dominant_emotion])

  const conf = Math.round((confidence || 0) * 100)
  const color = getEmotionColor(dominant_emotion)
  const emoji = getEmotionEmoji(dominant_emotion)

  // Sparkline data — last 10 dominant emotion confidence readings
  const sparkData = history.slice(-10).map((h) => ({
    v: Math.round((h[dominant_emotion] || 0)),
  }))

  return (
    <div className="card p-4 flex flex-col gap-3 transition-all duration-500">
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Emoji */}
        <span
          className={`text-4xl select-none transition-transform duration-300 ${pulse ? 'scale-125' : 'scale-100'}`}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
        >
          {emoji}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate">{participant_name}</p>
          <div className="mt-1">
            <EmotionBadge emotion={dominant_emotion} size="sm" />
          </div>
        </div>

        <span className="text-xs font-mono text-gray-500 mt-1">{conf}%</span>
      </div>

      {/* Confidence bar */}
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${conf}%`, background: color }}
        />
      </div>

      {/* Sparkline */}
      {sparkData.length > 1 && (
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', fontSize: 10 }}
                formatter={(v) => [`${v}%`]}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
