import type { Agent } from '../types/dashboard'
import StatusBadge from './StatusBadge'

interface Props {
  agent: Agent
  onClick: (agent: Agent) => void
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 23) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ${m}m ago`
  return `${m}m ago`
}

export default function AgentStatusCard({ agent, onClick }: Props) {
  const hasFailed = agent.tasksFailed > 0
  const border = hasFailed
    ? 'border-red-900/60 hover:border-red-700'
    : agent.status === 'running'
    ? 'border-violet-800/60 hover:border-violet-600'
    : agent.status === 'waiting_for_approval'
    ? 'border-amber-800/60 hover:border-amber-600'
    : 'border-gray-800 hover:border-gray-700'

  return (
    <button
      onClick={() => onClick(agent)}
      className={`w-full text-left bg-gray-900 border ${border} rounded-xl p-4 transition-colors group`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors">
            {agent.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{agent.role}</p>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{agent.tasksCompletedToday}</p>
          <p className="text-xs text-gray-600">Done</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-amber-400">{agent.tasksPending}</p>
          <p className="text-xs text-gray-600">Pending</p>
        </div>
        <div className="text-center">
          <p className={`text-lg font-semibold ${hasFailed ? 'text-red-400' : 'text-gray-600'}`}>
            {agent.tasksFailed}
          </p>
          <p className="text-xs text-gray-600">Failed</p>
        </div>
      </div>

      {agent.currentWorkflow && (
        <div className="mb-2 px-2 py-1 bg-violet-950/40 border border-violet-900/40 rounded text-xs text-violet-400 truncate">
          Running: {agent.currentWorkflow}
        </div>
      )}

      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{agent.recentOutputSummary}</p>

      <p className="text-xs text-gray-700 mt-2">Last run: {timeAgo(agent.lastRunAt)}</p>
    </button>
  )
}
