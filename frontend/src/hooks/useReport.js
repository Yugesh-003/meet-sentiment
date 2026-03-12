import { useState, useEffect } from 'react'
import { meetingApi } from '../api/meetingApi'

const TIMEOUT_MS = 10000

/**
 * Fetches the full session report from /report/:meeting_id.
 * - 10 second timeout → error state (not infinite spinner)
 * - Handles empty data gracefully
 */
export function useReport(meeting_id) {
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!meeting_id) {
      setLoading(false)
      setError('No meeting ID provided')
      return
    }

    setLoading(true)
    setError(null)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    meetingApi.getReport(meeting_id, controller.signal)
      .then((data) => {
        if (!data || (!data.logs?.length && !data.per_participant?.length)) {
          setReport(data)
          setError('empty')  // special flag for "no data" state
        } else {
          setReport(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          setError('Could not load report. Please check if backend is running.')
        } else {
          setError(err.message || 'Failed to load report')
        }
      })
      .finally(() => {
        clearTimeout(timer)
        setLoading(false)
      })

    return () => { controller.abort(); clearTimeout(timer) }
  }, [meeting_id])

  return { report, loading, error }
}
