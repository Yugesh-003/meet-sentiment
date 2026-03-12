import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LivePage    from './pages/LivePage'
import ReportPage  from './pages/ReportPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/"                    element={<Navigate to="/history" replace />} />
        <Route path="/history"             element={<HistoryPage />} />
        <Route path="/live/:meeting_id"    element={<LivePage />} />
        <Route path="/report/*"            element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  )
}
