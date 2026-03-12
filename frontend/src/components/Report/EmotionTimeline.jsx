import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { EMOTION_COLORS, EMOTION_KEYS } from '../../utils/emotionUtils'
import { formatTime } from '../../utils/formatters'

export default function EmotionTimeline({ name, timeline = [] }) {
  if (!timeline.length) return null

  const data = timeline.map((entry) => ({
    time: formatTime(entry.timestamp),
    ...Object.fromEntries(EMOTION_KEYS.map((k) => [k, Math.round(entry[k] * 100) / 100])),
  }))

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">{name}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }}
            formatter={(v, name) => [`${v}%`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 10 }}
            formatter={(value) => <span style={{ color: EMOTION_COLORS[value] }}>{value}</span>}
          />
          {EMOTION_KEYS.map((k) => (
            <Line key={k} type="monotone" dataKey={k} stroke={EMOTION_COLORS[k]}
              strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
