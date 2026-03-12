import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { EMOTION_COLORS, EMOTION_KEYS } from '../../utils/emotionUtils'

export default function EmotionDonut({ name, avgEmotions = {} }) {
  const data = EMOTION_KEYS
    .map((k) => ({ name: k, value: Math.round((avgEmotions[k] || 0) * 100) }))
    .filter((d) => d.value > 0)

  if (!data.length) return null

  return (
    <div className="card p-4 flex flex-col items-center">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={45} outerRadius={70}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={EMOTION_COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }}
            formatter={(v, name) => [`${v}%`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-xs font-semibold text-gray-400 mt-1 text-center">{name}</p>
    </div>
  )
}
