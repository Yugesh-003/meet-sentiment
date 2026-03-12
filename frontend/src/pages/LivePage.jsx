import { useParams, Link } from 'react-router-dom'
import Navbar from '../components/shared/Navbar'
import LiveGrid from '../components/LiveMonitor/LiveGrid'
import { useLiveEmotions } from '../hooks/useLiveEmotions'
import { useRef, useEffect, useState } from 'react'

export default function LivePage() {
  const { meeting_id } = useParams()
  const { participants, loading, error } = useLiveEmotions(meeting_id)

  // Keep a simple history per participant for sparklines
  const [historyMap, setHistoryMap] = useState({})
  useEffect(() => {
    if (!participants.length) return
    setHistoryMap((prev) => {
      const next = { ...prev }
      participants.forEach((p) => {
        const key = p.participant_name
        const entry = p.avg_emotions || {}
        next[key] = [...(prev[key] || []).slice(-20), entry]
      })
      return next
    })
  }, [participants])

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar meetingId={meeting_id}>
        {/* Live indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Recording
        </div>
      </Navbar>

      <main className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Hero */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-100">Live Emotion Monitor</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Connecting...' : error ? `Error: ${error}` : `${participants.length} participant(s) detected`}
            </p>
          </div>
        </div>

        {/* Grid */}
        <LiveGrid participants={participants} historyMap={historyMap} />

        {/* Footer CTA */}
        <div className="border-t border-gray-800 pt-4 flex justify-end">
          <Link
            to={`/report/${meeting_id}`}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-sm font-semibold rounded-xl transition-colors text-gray-300"
          >
            Meeting ended? View Full Report →
          </Link>
        </div>
      </main>
    </div>
  )
}
