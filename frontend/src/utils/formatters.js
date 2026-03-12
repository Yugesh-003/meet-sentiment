/** Format an ISO timestamp to HH:MM:SS */
export function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'Z') // treat as UTC
  return d.toLocaleTimeString('en-US', { hour12: false })
}

/** Format duration between two ISO strings as mm:ss */
export function formatDuration(startIso, endIso) {
  if (!startIso) return '—'
  const end = endIso ? new Date(endIso + 'Z') : new Date()
  const start = new Date(startIso + 'Z')
  const secs = Math.max(0, Math.floor((end - start) / 1000))
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/** Format a 0–100 score to a colour class */
export function scoreColor(score) {
  if (score >= 70) return 'text-green-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

/** Capitalise first letter */
export function cap(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Clamp a value between min and max */
export function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val))
}
