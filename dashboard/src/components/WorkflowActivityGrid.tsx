import type { WorkflowDefinitionMeta } from '../types/dashboard'
import StatusBadge from './StatusBadge'
import { runWorkflowManually } from '../services/dashboardService'
import { useState } from 'react'

interface Props {
  workflows: WorkflowDefinitionMeta[]
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 23) return `${Math.floor(h / 24)}d ago`
  if (h > 0) return `${h}h ${m}m ago`
  return `${m}m ago`
}

function WorkflowCard({ wf }: { wf: WorkflowDefinitionMeta }) {
  const [running, setRunning] = useState(false)
  const run = wf.lastRun

  async function handleRun() {
    setRunning(true)
    await runWorkflowManually(wf.id)
    setTimeout(() => setRunning(false), 1200)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{wf.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{wf.description}</p>
        </div>
        {run && <StatusBadge status={run.status} />}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-semibold text-gray-200">{run?.itemsProcessed ?? '—'}</p>
          <p className="text-xs text-gray-600">Items</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-200">{run?.outputsCreated ?? '—'}</p>
          <p className="text-xs text-gray-600">Outputs</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-400">{run?.approvalsGenerated ?? '—'}</p>
          <p className="text-xs text-gray-600">Approvals</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>Trigger: {wf.trigger}</span>
        <span>Last: {timeAgo(run?.startedAt)}</span>
      </div>

      <div className="flex gap-2 pt-1 border-t border-gray-800">
        <button className="flex-1 px-2 py-1.5 text-xs text-gray-400 bg-gray-800/60 hover:bg-gray-800 rounded transition-colors">
          View Logs
        </button>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex-1 px-2 py-1.5 text-xs text-violet-300 bg-violet-900/30 hover:bg-violet-900/50 border border-violet-800/40 rounded transition-colors disabled:opacity-50"
        >
          {running ? 'Queued...' : 'Run Manually'}
        </button>
      </div>
    </div>
  )
}

export default function WorkflowActivityGrid({ workflows }: Props) {
  return (
    <section>
      <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Workflow Activity</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {workflows.map((wf) => (
          <WorkflowCard key={wf.id} wf={wf} />
        ))}
      </div>
    </section>
  )
}
