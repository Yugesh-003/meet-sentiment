import { getEmotionEmoji, getEmotionColor } from '../../utils/emotionUtils'
import { scoreColor, cap, formatDuration } from '../../utils/formatters'

function Card({ label, value, sub, colorClass = 'text-violet-400' }) {
  return (
    <div className="card p-5 flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-extrabold ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </div>
  )
}

function PersonCard({ p }) {
  const engColor = scoreColor(p.engagement_score)
  const stressColor = p.stress_index > 60 ? 'text-red-400' : 'text-green-400'
  const emoji = getEmotionEmoji(p.dominant_emotion)
  const color = getEmotionColor(p.dominant_emotion)
  return (
    <div className="card p-4 flex flex-col gap-2">
      <p className="text-sm font-bold text-gray-200 truncate">{p.participant_name}</p>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <span className="text-xs font-semibold capitalize" style={{ color }}>{p.dominant_emotion}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mt-1">
        <div><span className="text-gray-500">Engagement</span><br/>
          <span className={`font-bold ${engColor}`}>{p.engagement_score}</span>/100</div>
        <div><span className="text-gray-500">Stress</span><br/>
          <span className={`font-bold ${stressColor}`}>{p.stress_index}</span>/100</div>
        <div><span className="text-gray-500">Frames</span><br/>
          <span className="font-bold text-gray-300">{p.frame_count}</span></div>
      </div>
    </div>
  )
}

export default function ScoreCards({ summary = {}, perParticipant = [], session = {} }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Top-level summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card label="Participants" value={summary.total_participants ?? '—'} />
        <Card label="Duration" value={formatDuration(session?.started_at, session?.ended_at)} sub="mm:ss" colorClass="text-blue-400" />
        <Card
          label="Engagement Score"
          value={`${summary.engagement_score ?? '—'}`}
          sub="avg across participants"
          colorClass={scoreColor(summary.engagement_score ?? 0)}
        />
        <Card
          label="Stress Index"
          value={`${summary.stress_index ?? '—'}`}
          sub="avg across participants"
          colorClass={summary.stress_index > 50 ? 'text-red-400' : 'text-green-400'}
        />
      </div>

      {/* Per-person scorecards */}
      {perParticipant.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {perParticipant.map((p) => <PersonCard key={p.participant_name} p={p} />)}
        </div>
      )}
    </div>
  )
}
