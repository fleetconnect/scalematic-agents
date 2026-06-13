import type { StuckTask } from '../types/dashboard'
import StatusBadge from './StatusBadge'

interface Props {
  tasks: StuckTask[]
}

const agentNames: Record<string, string> = {
  strategy: 'Strategy',
  research: 'Research',
  messaging: 'Messaging',
  content: 'Content',
  sales: 'Sales',
  crm: 'CRM',
  ops: 'Ops',
  metrics: 'Metrics',
  governance: 'Governance',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m ago`
  return `${m}m ago`
}

export default function StuckTaskMonitor({ tasks }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Stuck Tasks</p>
        <p className="text-sm text-gray-600">No stuck tasks — system running clean.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-600 uppercase tracking-widest">Stuck Tasks</p>
        <span className="text-xs text-red-400 font-medium">{tasks.length} need attention</span>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm text-white font-medium">{task.taskName}</p>
              <StatusBadge status={task.stuckReason} />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
              <span>{agentNames[task.agentId] ?? task.agentId} Agent</span>
              {task.workflowId && <span>· {task.workflowId}</span>}
              <span>· {timeAgo(task.stuckSince)}</span>
            </div>
            <p className="text-xs text-amber-400/90">{task.suggestedFix}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
