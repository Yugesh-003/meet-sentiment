import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from 'recharts'
import { EMOTION_COLORS, EMOTION_KEYS } from '../../utils/emotionUtils'

export default function EmotionDonut({ name, avgEmotions = {} }) {
  const data = EMOTION_KEYS
    .map((k) => ({ name: k, value: Math.round((avgEmotions[k] || 0) * 100) }))
    .filter((d) => d.value > 0)

  if (!data.length) return null

  const renderLabel = (entry) => {
    // Only show label on slice if value is >= 10%
    if (entry.value >= 10) {
      return `${entry.value}%`
    }
    return ''
  }

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
            label={renderLabel}
            labelLine={false}
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
      
      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center mt-3">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: EMOTION_COLORS[entry.name] }}
            />
            <span className="text-gray-300 capitalize">{entry.name}</span>
            <span className="text-gray-500">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
