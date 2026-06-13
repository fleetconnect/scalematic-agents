import type { Agent, AgentTask } from '../types/dashboard'
import StatusBadge from './StatusBadge'
import { runAgentManually } from '../services/dashboardService'
import { useState } from 'react'

interface Props {
  agent: Agent | null
  tasks: AgentTask[]
  onClose: () => void
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m ago`
  return `${m}m ago`
}

function durationLabel(ms: number | undefined): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function AgentDetailDrawer({ agent, tasks, onClose }: Props) {
  const [triggering, setTriggering] = useState(false)

  if (!agent) return null

  async function handleRun() {
    setTriggering(true)
    await runAgentManually(agent!.id)
    setTimeout(() => setTriggering(false), 1200)
  }

  const recentTasks = tasks.slice(0, 10)
  const recentOutputs = tasks.filter((t) => t.outputSummary).slice(0, 5)
  const errors = tasks.filter((t) => t.error).slice(0, 5)

  const totalDuration = tasks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0)
  const avgDuration = tasks.length > 0 ? totalDuration / tasks.length : 0
  const estTokens = Math.round((totalDuration / 1000) * 12)
  const estCostUsd = (estTokens * 0.000003).toFixed(4)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-900 border-l border-gray-800 z-50 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">{agent.id}</p>
            <h2 className="text-base font-semibold text-white">{agent.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{agent.role}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none mt-1">×</button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Status + meta */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={agent.status} size="md" />
            {agent.approvalRequired && (
              <span className="px-2 py-0.5 text-xs rounded bg-amber-900/40 text-amber-400 border border-amber-800/40">
                Approval required
              </span>
            )}
            <span className="text-xs text-gray-600">Last run: {timeAgo(agent.lastRunAt)}</span>
          </div>

          {/* Perf stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Completed', value: agent.tasksCompletedToday, color: 'text-white' },
              { label: 'Pending', value: agent.tasksPending, color: 'text-amber-400' },
              { label: 'Failed', value: agent.tasksFailed, color: agent.tasksFailed > 0 ? 'text-red-400' : 'text-gray-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-800/60 rounded-lg p-3 text-center">
                <p className={`text-xl font-semibold ${color}`}>{value}</p>
                <p className="text-xs text-gray-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Token / cost estimate */}
          <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3 flex gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Est. tokens used</p>
              <p className="text-sm font-medium text-gray-200">{estTokens.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Est. cost</p>
              <p className="text-sm font-medium text-gray-200">${estCostUsd}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Avg. duration</p>
              <p className="text-sm font-medium text-gray-200">{durationLabel(avgDuration)}</p>
            </div>
          </div>

          {/* Tools */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Allowed Tools</p>
            <div className="flex flex-wrap gap-1.5">
              {agent.toolsAllowed.map((t) => (
                <span key={t} className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-400 border border-gray-700">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Recent tasks */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Last 10 Tasks</p>
            <div className="space-y-1">
              {recentTasks.length === 0 && (
                <p className="text-xs text-gray-600">No tasks yet.</p>
              )}
              {recentTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusBadge status={t.status} />
                    <span className="text-xs text-gray-400 truncate">{t.type}</span>
                  </div>
                  <span className="text-xs text-gray-600 flex-shrink-0">{timeAgo(t.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent outputs */}
          {recentOutputs.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Recent Outputs</p>
              <div className="space-y-2">
                {recentOutputs.map((t) => (
                  <div key={t.id} className="bg-gray-800/40 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 mb-1">{t.type}</p>
                    <p className="text-xs text-gray-300 leading-relaxed">{t.outputSummary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error log */}
          {errors.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Error Log</p>
              <div className="space-y-2">
                {errors.map((t) => (
                  <div key={t.id} className="bg-red-950/30 border border-red-900/40 rounded-lg p-2.5">
                    <p className="text-xs text-red-400 leading-relaxed">{t.error}</p>
                    <p className="text-xs text-gray-600 mt-1">{timeAgo(t.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="px-5 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
          <button
            onClick={handleRun}
            disabled={triggering}
            className="w-full py-2.5 text-sm font-medium text-violet-300 bg-violet-900/40 hover:bg-violet-900/60 border border-violet-800/50 rounded-xl transition-colors disabled:opacity-50"
          >
            {triggering ? 'Queued...' : 'Run Agent Manually'}
          </button>
        </div>
      </aside>
    </>
  )
}
