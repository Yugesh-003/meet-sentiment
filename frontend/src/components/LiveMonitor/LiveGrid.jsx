import ParticipantCard from './ParticipantCard'

export default function LiveGrid({ participants, historyMap = {} }) {
  if (!participants?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-600">
        <span className="text-5xl mb-4">🎥</span>
        <p className="text-lg font-semibold">No participants detected yet</p>
        <p className="text-sm mt-1">Make sure Google Meet captions are enabled and the extension is active</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {participants.map((p) => (
        <ParticipantCard
          key={p.participant_name}
          participant={p}
          history={historyMap[p.participant_name] || []}
        />
      ))}
    </div>
  )
}
