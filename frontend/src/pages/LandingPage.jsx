import { Link } from 'react-router-dom'

const EMOTIONS = [
  { name: 'Happy',    emoji: '😊', color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  glow: 'shadow-green-500/10' },
  { name: 'Sad',      emoji: '😢', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   glow: 'shadow-blue-500/10' },
  { name: 'Angry',    emoji: '😠', color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    glow: 'shadow-red-500/10' },
  { name: 'Fear',     emoji: '😨', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', glow: 'shadow-orange-500/10' },
  { name: 'Surprise', emoji: '😲', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', glow: 'shadow-purple-500/10' },
  { name: 'Disgust',  emoji: '🤢', color: 'text-lime-400',   bg: 'bg-lime-500/10',   border: 'border-lime-500/20',   glow: 'shadow-lime-500/10' },
  { name: 'Neutral',  emoji: '😐', color: 'text-gray-400',   bg: 'bg-gray-500/10',   border: 'border-gray-500/20',   glow: 'shadow-gray-500/10' },
]

const FEATURES = [
  { icon: '🎥', title: 'Live Emotion Detection',    desc: "Captures facial expressions from every participant's camera feed every 3 seconds using DeepFace + OpenCV." },
  { icon: '📊', title: 'Per-Person Reports',         desc: 'Detailed emotion timeline, engagement score, stress index, and dominant emotion breakdown for each participant.' },
  { icon: '📁', title: 'Dataset Export',              desc: 'Download raw CSV data, summary statistics, and meeting metadata from every session for your own analysis.' },
]

const STEPS = [
  { num: '01', title: 'Install the Chrome Extension',                    desc: 'Load the MeetMind extension from chrome://extensions in developer mode.' },
  { num: '02', title: 'Join a Google Meet call',                          desc: 'Open meet.google.com and join any meeting as usual.' },
  { num: '03', title: 'Toggle MeetMind ON',                               desc: 'Click the MeetMind popup icon and flip the toggle to start capturing.' },
  { num: '04', title: 'View your emotion report',                         desc: 'When the meeting ends, open the dashboard to see the full sentiment analysis.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 scroll-smooth">
      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center gap-6">
          <span className="flex items-center gap-2 text-violet-400 font-bold text-lg shrink-0 select-none">
            <span className="text-2xl">🧠</span> MeetMind
          </span>
          <div className="hidden sm:flex items-center gap-5 ml-4 text-sm font-medium text-gray-500">
            <a href="#features" className="hover:text-gray-200 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-200 transition-colors">How It Works</a>
            <Link to="/history" className="hover:text-gray-200 transition-colors">Dashboard</Link>
          </div>
          <Link to="/history"
            className="ml-auto px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
            Open Dashboard →
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Floating emoji background */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
          {['😊','😢','😠','😨','😲','😐','🤢'].map((e, i) => (
            <span key={i}
              className="absolute text-5xl opacity-[0.06] animate-bounce"
              style={{
                left: `${10 + i * 13}%`,
                top: `${15 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.4}s`,
                animationDuration: `${2.5 + i * 0.3}s`,
              }}>
              {e}
            </span>
          ))}
        </div>

        <div className="max-w-4xl mx-auto px-4 pt-24 pb-20 text-center relative">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Know What Your Meeting
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Really Felt Like
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            MeetMind analyses facial emotions of every participant in real time
            and delivers a full sentiment report the moment your call ends.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/history"
              className="px-7 py-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors text-sm shadow-lg shadow-violet-600/20">
              View Dashboard →
            </Link>
            <a href="#how-it-works"
              className="px-7 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl transition-colors text-sm border border-gray-700">
              See How It Works ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ───────────────────────────────────────────────── */}
      <section className="border-y border-gray-800/60 bg-gray-900/30">
        <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { value: 'Real-time',     label: 'Analysis every 3 seconds' },
            { value: 'Per-Person',    label: 'Individual reports & scores' },
            { value: '7 Emotions',    label: 'Tracked simultaneously' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl font-extrabold text-violet-400">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
          Everything You Need to <span className="text-violet-400">Understand Emotions</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={i}
              className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800/60 hover:border-violet-700/40 transition-colors">
              <span className="text-4xl">{f.icon}</span>
              <h3 className="mt-4 text-lg font-bold text-gray-100">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-gray-900/30 border-y border-gray-800/60">
        <div className="max-w-5xl mx-auto px-4 py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-14">
            Get Started in <span className="text-violet-400">4 Simple Steps</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <div key={i} className="relative p-5 rounded-2xl bg-gray-950 border border-gray-800/60">
                <span className="text-4xl font-black text-violet-500/20 absolute top-3 right-4 select-none">
                  {s.num}
                </span>
                <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm mb-4">
                  {s.num}
                </div>
                <h3 className="text-sm font-bold text-gray-100">{s.title}</h3>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Emotion Showcase ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
          <span className="text-violet-400">7 Emotions</span> Detected in Real Time
        </h2>
        <p className="text-center text-sm text-gray-500 mb-12">Powered by DeepFace + OpenCV</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {EMOTIONS.map((e) => (
            <div key={e.name}
              className={`flex flex-col items-center gap-3 p-5 rounded-2xl border ${e.border} ${e.bg} shadow-lg ${e.glow} hover:scale-105 transition-transform duration-200`}>
              <span className="text-4xl">{e.emoji}</span>
              <span className={`text-sm font-bold ${e.color}`}>{e.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800/60 bg-gray-900/20">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <span className="flex items-center gap-2 text-violet-400 font-bold text-lg justify-center sm:justify-start">
              <span className="text-2xl">🧠</span> MeetMind
            </span>
            <p className="text-xs text-gray-600 mt-1.5 max-w-xs">
              Emotions don't lie. Now neither does your meeting data.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link to="/history" className="hover:text-gray-200 transition-colors">Dashboard</Link>
            <Link to="/history" className="hover:text-gray-200 transition-colors">History</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
              className="hover:text-gray-200 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
