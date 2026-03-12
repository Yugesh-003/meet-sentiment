const BASE = 'http://localhost:8000'

async function get(path, signal) {
  const res = await fetch(`${BASE}${path}`, signal ? { signal } : {})
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

async function download(path, filename) {
  try {
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) {
      const text = await res.text()
      console.error(`Download failed: ${res.status}`, text)
      throw new Error(`Download failed: ${res.status}`)
    }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch (err) {
    console.error('Download error:', err)
    alert(`Download failed: ${err.message}`)
    throw err
  }
}

export const meetingApi = {
  getLive:    (id) => get(`/live/${encodeURIComponent(id)}`),
  getReport: (id, signal) => get(`/report/${encodeURIComponent(id)}`, signal),
  getMeetings: ()  => get('/meetings'),

  downloadRaw:      (id) => download(`/report/${encodeURIComponent(id)}/download/raw`, 'emotions_raw.csv'),
  downloadSummary:  (id) => download(`/report/${encodeURIComponent(id)}/download/summary`, 'emotions_summary.csv'),
  downloadMetadata: (id) => download(`/report/${encodeURIComponent(id)}/download/metadata`, 'meeting_metadata.json'),
  downloadZip:      (id) => download(`/report/${encodeURIComponent(id)}/download/zip`, 'meetmind_dataset.zip'),
  downloadAllMeetings: () => download('/meetings/download/all', 'meetmind_all.csv'),
}
