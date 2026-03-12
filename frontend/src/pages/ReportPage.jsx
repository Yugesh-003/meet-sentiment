import { useState } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import Navbar from '../components/shared/Navbar'
import ExportButton from '../components/shared/ExportButton'
import ScoreCards from '../components/Report/ScoreCards'
import EmotionTimeline from '../components/Report/EmotionTimeline'
import EmotionDonut from '../components/Report/EmotionDonut'
import HeatmapTable from '../components/Report/HeatmapTable'
import StressSpikes from '../components/Report/StressSpikes'
import { useReport } from '../hooks/useReport'
import { meetingApi } from '../api/meetingApi'

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-bold text-gray-200 border-b border-gray-800 pb-2">{title}</h2>
      {children}
    </section>
  )
}

function DownloadMenu({ meeting_id }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)

  async function dl(key, fn) {
    setBusy(key)
    try { await fn() } finally { setBusy(null); setOpen(false) }
  }

  const items = [
    { key: 'zip',      label: '📦 Full ZIP (CSV + JSON)',  fn: () => meetingApi.downloadZip(meeting_id) },
    { key: 'raw',      label: '📄 Raw Emotions CSV',       fn: () => meetingApi.downloadRaw(meeting_id) },
    { key: 'summary',  label: '📊 Summary CSV',            fn: () => meetingApi.downloadSummary(meeting_id) },
    { key: 'metadata', label: '🗂 Meeting Metadata JSON',  fn: () => meetingApi.downloadMetadata(meeting_id) },
  ]

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-xl transition-colors border border-gray-700">
        ⬇ Download Dataset <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-50 py-1">
          {items.map(({ key, label, fn }) => (
            <button key={key} onClick={() => dl(key, fn)} disabled={busy === key}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {busy === key ? '⏳ Downloading...' : label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Extract the conference_id from the URL.
 * Route is /report/* so useParams gives { '*': 'conferenceRecords/xyz' }
 * NOT { meeting_id: '...' }. We read the splat param to get the full ID.
 */
function useConferenceId() {
  const params   = useParams()
  const location = useLocation()

  // Primary: read the splat (*) param — this is what /report/* gives us
  if (params['*']) return decodeURIComponent(params['*'])

  // Fallback: parse from pathname directly
  const match = location.pathname.match(/\/report\/(.+)/)
  if (match) return decodeURIComponent(match[1])

  return null
}

export default function ReportPage() {
  const meeting_id = useConferenceId()
  const { report, loading, error } = useReport(meeting_id)

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-spin">⚙️</div>
          <p>Loading report...</p>
        </div>
      </div>
    )
  }

  // Error: no data recorded
  if (error === 'empty') {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <div className="max-w-md mx-auto mt-24 text-center">
          <div className="card p-8 flex flex-col items-center gap-4">
            <span className="text-5xl">⚠️</span>
            <h2 className="text-lg font-bold text-gray-200">Report Unavailable</h2>
            <p className="text-sm text-gray-500">No emotion data was recorded for this meeting.</p>
            <Link to="/history"
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold rounded-xl transition-colors">
              ← Back to History
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Error: network / timeout / other
  if (error) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <div className="max-w-md mx-auto mt-24 text-center">
          <div className="card p-8 flex flex-col items-center gap-4">
            <span className="text-5xl">⚠️</span>
            <h2 className="text-lg font-bold text-gray-200">Report Unavailable</h2>
            <p className="text-sm text-gray-500">{error}</p>
            <Link to="/history"
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold rounded-xl transition-colors">
              ← Back to History
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { session, summary, per_participant = [], logs = [] } = report || {}

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar meetingId={meeting_id} subtitle="Post-Meeting Report">
        {/* <DownloadMenu meeting_id={meeting_id} /> */}
        <ExportButton targetId="report-root" filename={`meetmind-report`} />
      </Navbar>

      <main id="report-root" className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-10">
        <Section title="📊 Summary">
          <ScoreCards summary={summary} perParticipant={per_participant} session={session} />
        </Section>
        <Section title="📈 Emotion Timeline">
          <div className="flex flex-col gap-4">
            {per_participant.map(p => (
              <EmotionTimeline key={p.participant_name} name={p.participant_name} timeline={p.timeline} />
            ))}
          </div>
        </Section>
        <Section title="🍩 Dominant Emotion Breakdown">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {per_participant.map(p => (
              <EmotionDonut key={p.participant_name} name={p.participant_name} avgEmotions={p.avg_emotions} />
            ))}
          </div>
        </Section>
        <Section title="🌡️ Emotion Heatmap">
          <HeatmapTable perParticipant={per_participant} />
        </Section>
        <Section title="⚠️ Stress Spikes">
          <StressSpikes logs={logs} />
        </Section>
        <Section title="🏆 Individual Scorecards">
          <ScoreCards summary={{}} perParticipant={per_participant} session={session} />
        </Section>
      </main>
    </div>
  )
}
