import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/shared/Navbar'
import { meetingApi } from '../api/meetingApi'

const EMOJI = { happy:'😊', sad:'😢', angry:'😠', fear:'😨', surprise:'😲', neutral:'😐', disgust:'🤢' };
const COLORS = { happy:'#22c55e', sad:'#3b82f6', angry:'#ef4444', fear:'#f97316', surprise:'#a855f7', disgust:'#84cc16', neutral:'#94a3b8' };

function Initials({ name }) {
  const parts = name.trim().split(/\s+/)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-violet-800/60 text-violet-200 text-xs font-bold uppercase shrink-0 border border-violet-700/40">
      {letters.toUpperCase()}
    </span>
  )
}

function MeetingCard({ meeting }) {
  const {
    conference_id, started_at, ended_at, duration_seconds,
    participant_names = [], total_frames, dominant_emotions = {},
  } = meeting

  const dateStr = started_at
    ? new Date(started_at + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
  const timeStr = started_at
    ? new Date(started_at + 'Z').toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : ''
  const durMin = Math.floor((duration_seconds || 0) / 60)
  const durSec = (duration_seconds || 0) % 60
  const durStr = duration_seconds ? `${durMin}m ${durSec}s` : '—'

  return (
    <div className="group card p-5 flex flex-col gap-4 hover:border-violet-700/60 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-100">{dateStr} <span className="text-gray-600">·</span> {timeStr}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>⏱ {durStr}</span>
            <span>🎞 {total_frames} frames</span>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-950/60 border border-green-800/40 px-2.5 py-1 rounded-full shrink-0">
          ✅ Analysed
        </span>
      </div>

      {/* Participants + their dominant emotions */}
      {participant_names.length > 0 && (
        <div className="flex flex-col gap-2">
          {participant_names.map((name, i) => {
            const emotion = (dominant_emotions[name] || 'neutral').toLowerCase()
            const emoji = EMOJI[emotion] || '😐'
            const color = COLORS[emotion] || '#94a3b8'
            return (
              <div key={i} className="flex items-center gap-2.5">
                <Initials name={name} />
                <span className="text-xs text-gray-300 font-medium truncate">{name}</span>
                <span className="ml-auto text-sm">{emoji}</span>
                <span className="text-xs font-semibold capitalize" style={{ color }}>{emotion}</span>
              </div>
            )
          })}
        </div>
      )}

      <Link
        to={`/report/${encodeURIComponent(conference_id)}`}
        className="mt-auto inline-flex items-center gap-2 px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold rounded-xl transition-colors w-fit"
      >
        View Report →
      </Link>
    </div>
  )
}

export default function HistoryPage() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    meetingApi.getMeetings()
      .then(data => setMeetings(data.meetings || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleExportAll() {
    setExporting(true)
    try { await meetingApi.downloadAllMeetings() } finally { setExporting(false) }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar>
        {meetings.length > 0 && (
          <button onClick={handleExportAll} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-sm font-semibold rounded-xl transition-colors">
            {exporting ? '⏳ Exporting...' : '⬇ Export All Data'}
          </button>
        )}
      </Navbar>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-100">Meeting History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading...' : `${meetings.length} analysed meeting(s)`}
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-24 text-gray-600">
            <div className="text-center"><div className="text-4xl mb-3 animate-spin">⚙️</div><p>Loading...</p></div>
          </div>
        )}

        {error && (
          <div className="card p-6 text-center text-red-400"><p className="text-xl mb-2">⚠️</p><p>{error}</p></div>
        )}

        {!loading && !error && meetings.length === 0 && (
          <div className="card p-12 text-center flex flex-col items-center gap-3">
            <span className="text-5xl">🎥</span>
            <p className="text-lg font-semibold text-gray-400">No analysed meetings yet</p>
            <p className="text-sm text-gray-600">Turn on MeetMind during a Google Meet call to start capturing.</p>
          </div>
        )}

        {!loading && meetings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.map(m => <MeetingCard key={m.conference_id} meeting={m} />)}
          </div>
        )}
      </main>
    </div>
  )
}
