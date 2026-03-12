import { Link, useLocation } from 'react-router-dom'

export default function Navbar({ meetingId, subtitle, children }) {
  const { pathname } = useLocation()

  const navLink = (to, label) => (
    <Link to={to}
      className={`text-sm font-medium transition-colors ${
        pathname.startsWith(to) ? 'text-violet-400' : 'text-gray-500 hover:text-gray-200'
      }`}>
      {label}
    </Link>
  )

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-violet-400 font-bold text-lg shrink-0">
          <span className="text-2xl">🧠</span>
          <span className="hidden sm:inline">MeetMind</span>
        </Link>

        <div className="flex items-center gap-4 ml-1">
          {navLink('/history', 'History')}
          {/* {navLink('/live', 'Live')} */}
        </div>

        {meetingId && (
          <span className="font-mono text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full border border-gray-700 hidden md:block truncate max-w-[160px]"
            title={meetingId}>
            {meetingId.includes('/') ? meetingId.split('/').pop().slice(0, 12) : meetingId}
          </span>
        )}
        {subtitle && <span className="text-sm text-gray-600 hidden lg:block">{subtitle}</span>}

        <div className="ml-auto flex items-center gap-3">{children}</div>
      </div>
    </nav>
  )
}
