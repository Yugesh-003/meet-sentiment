import { useState, useEffect, useRef } from 'react'
import { meetingApi } from '../api/meetingApi'

/**
 * Polls /live/:meeting_id every intervalMs and returns current participants.
 */
export function useLiveEmotions(meeting_id, intervalMs = 3000) {
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  async function fetch() {
    try {
      const data = await meetingApi.getLive(meeting_id)
      setParticipants(data.participants || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!meeting_id) return
    fetch()
    timerRef.current = setInterval(fetch, intervalMs)
    return () => clearInterval(timerRef.current)
  }, [meeting_id])

  return { participants, loading, error }
}
