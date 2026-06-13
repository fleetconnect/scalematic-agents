import { useEffect, useState } from 'react'
import type {
  AgentPerformanceMetric,
  WorkflowPerformanceMetric,
  PipelineInsight,
  CostUsageSummary,
  ApprovalItem,
  DailyAgentReport,
} from '../types/dashboard'
import {
  getAgentPerformance, getWorkflowPerformance,
  getPipelineInsights, getCostUsage,
  getApprovalQueue, getDailyReport,
} from '../services/dashboardService'

type Tab = 'daily' | 'agents' | 'workflows' | 'pipeline' | 'cost' | 'approvals'

const tabs: { id: Tab; label: string }[] = [
  { id: 'daily', label: 'Daily Reports' },
  { id: 'agents', label: 'Agent Performance' },
  { id: 'workflows', label: 'Workflow Performance' },
  { id: 'pipeline', label: 'Pipeline Insights' },
  { id: 'cost', label: 'Cost & Tokens' },
  { id: 'approvals', label: 'Approval History' },
]

function pct(n: number) { return `${Math.round(n * 100)}%` }
function ms(n: number) { return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s` }
function k(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">{children}</p>
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Tab views ─────────────────────────────────────────────────────

function DailyTab({ report }: { report: DailyAgentReport | null }) {
  if (!report) return <p className="text-sm text-gray-600">No report generated yet.</p>
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <p className="text-xs text-gray-600">Generated {new Date(report.generatedAt).toLocaleString()}</p>
      {[
        { title: 'What changed', items: report.whatChanged },
        { title: 'Actions prepared', items: report.actionsPrepared },
        { title: 'Needed approval', items: report.needsApproval },
        { title: 'Needed human attention', items: report.needsHumanAttention },
        { title: 'Skipped to save cost', items: report.skippedToSaveCost },
      ].map(({ title, items }) => (
        <div key={title}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">{title}</p>
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-300">
                <span className="text-gray-700 mt-0.5">—</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function AgentPerfTab({ data }: { data: AgentPerformanceMetric[] }) {
  return (
    <div className="overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {['Agent', 'Tasks Done', 'Avg Time', 'Failures', 'Approval Rate', 'Revision Rate', 'Top Task'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-widest font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.agentId} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20">
              <td className="px-4 py-3 text-sm text-white font-medium whitespace-nowrap">{row.agentName}</td>
              <td className="px-4 py-3 text-sm text-gray-300">{row.tasksCompleted}</td>
              <td className="px-4 py-3 text-sm text-gray-400">{ms(row.avgCompletionMs)}</td>
              <td className="px-4 py-3">
                <span className={`text-sm ${row.failureCount > 0 ? 'text-red-400' : 'text-gray-600'}`}>{row.failureCount}</span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-400">{row.approvalRate > 0 ? pct(row.approvalRate) : '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-400">{row.revisionRate > 0 ? pct(row.revisionRate) : '—'}</td>
              <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-xs">{row.mostCommonTaskType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WorkflowPerfTab({ data }: { data: WorkflowPerformanceMetric[] }) {
  return (
    <div className="overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {['Workflow', 'Runs', 'Items', 'Outputs', 'Approvals', 'Failures', 'Last Duration'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-widest font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.workflowId} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20">
              <td className="px-4 py-3 text-sm text-white font-medium whitespace-nowrap">{row.workflowName}</td>
              <td className="px-4 py-3 text-sm text-gray-300">{row.runsCompleted}</td>
              <td className="px-4 py-3 text-sm text-gray-400">{row.itemsProcessed}</td>
              <td className="px-4 py-3 text-sm text-gray-400">{row.outputsCreated}</td>
              <td className="px-4 py-3 text-sm text-amber-400">{row.approvalItemsGenerated}</td>
              <td className="px-4 py-3">
                <span className={`text-sm ${row.failedRuns > 0 ? 'text-red-400' : 'text-gray-600'}`}>{row.failedRuns}</span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-400">{ms(row.lastRunDurationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PipelineTab({ data }: { data: PipelineInsight }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="New Leads" value={data.newLeads} />
        <Stat label="Warm Replies" value={data.warmReplies} />
        <Stat label="Booked Calls" value={data.bookedCalls} />
        <Stat label="Stale Opportunities" value={data.staleOpportunities} sub=">7 days no activity" />
        <Stat label="Follow Ups Needed" value={data.followUpsNeeded} />
        <Stat label="At Risk" value={data.opportunitiesAtRisk} />
      </div>

      <div>
        <SectionTitle>Priority Contacts</SectionTitle>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {data.priorityContacts.map((c, i) => {
            const urgencyColor = c.urgency === 'high' ? 'text-red-400 bg-red-950/30' : c.urgency === 'medium' ? 'text-amber-400 bg-amber-950/30' : 'text-gray-400 bg-gray-800/40'
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 last:border-0">
                <span className={`px-2 py-0.5 text-xs rounded font-medium capitalize ${urgencyColor}`}>{c.urgency}</span>
                <span className="text-sm text-white font-medium">{c.name}</span>
                <span className="text-xs text-gray-500">{c.reason}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CostTab({ data }: { data: CostUsageSummary }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Tokens Today" value={k(data.estimatedTokensToday)} />
        <Stat label="Tokens This Week" value={k(data.estimatedTokensThisWeek)} />
        <Stat label="Cost Today" value={`$${data.estimatedCostTodayUsd.toFixed(2)}`} />
        <Stat label="Cost This Week" value={`$${data.estimatedCostThisWeekUsd.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Highest Cost Agent" value={data.highestCostAgent} />
        <Stat label="Highest Cost Workflow" value={data.highestCostWorkflow} />
        <Stat label="Records Skipped" value={data.recordsSkipped} sub="saved tokens" />
      </div>

      <div>
        <SectionTitle>Cost Reduction Suggestions</SectionTitle>
        <div className="space-y-2">
          {data.costReductionSuggestions.map((s, i) => (
            <div key={i} className="flex gap-2.5 bg-gray-900 border border-gray-800 rounded-xl p-3.5">
              <span className="text-violet-600 text-sm mt-0.5">→</span>
              <p className="text-sm text-gray-300">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ApprovalHistoryTab({ items }: { items: ApprovalItem[] }) {
  const reviewed = items.filter((i) => i.status !== 'pending')
  const approvedCount = reviewed.filter((i) => i.status === 'approved').length
  const rejectedCount = reviewed.filter((i) => i.status === 'rejected').length
  const revisionCount = reviewed.filter((i) => i.status === 'needs_revision').length

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Approved" value={approvedCount} />
        <Stat label="Rejected" value={rejectedCount} />
        <Stat label="Needs Revision" value={revisionCount} />
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {reviewed.length === 0 && (
          <p className="text-sm text-gray-600 px-4 py-3">No reviewed items yet.</p>
        )}
        {reviewed.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50 last:border-0">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${item.status === 'approved' ? 'bg-emerald-900/40 text-emerald-400' : item.status === 'rejected' ? 'bg-red-900/40 text-red-400' : 'bg-amber-900/40 text-amber-400'}`}>
              {item.status.replace('_', ' ')}
            </span>
            <span className="text-sm text-white">{item.contactName}</span>
            <span className="text-xs text-gray-600">{item.type.replace('_', ' ')}</span>
            <span className="text-xs text-gray-700 ml-auto">{new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('daily')
  const [agentPerf, setAgentPerf] = useState<AgentPerformanceMetric[]>([])
  const [workflowPerf, setWorkflowPerf] = useState<WorkflowPerformanceMetric[]>([])
  const [pipeline, setPipeline] = useState<PipelineInsight | null>(null)
  const [cost, setCost] = useState<CostUsageSummary | null>(null)
  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [report, setReport] = useState<DailyAgentReport | null>(null)

  useEffect(() => {
    Promise.all([
      getAgentPerformance().then(setAgentPerf),
      getWorkflowPerformance().then(setWorkflowPerf),
      getPipelineInsights().then(setPipeline),
      getCostUsage().then(setCost),
      getApprovalQueue().then(setApprovals),
      getDailyReport().then(setReport),
    ])
  }, [])

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-0.5">Reports</p>
        <h2 className="text-lg font-semibold text-white">System Intelligence</h2>
      </div>

      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-2 text-xs rounded-lg whitespace-nowrap transition-colors ${
              tab === id
                ? 'bg-violet-900/50 border border-violet-700 text-violet-300'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'daily'     && <DailyTab report={report} />}
      {tab === 'agents'    && <AgentPerfTab data={agentPerf} />}
      {tab === 'workflows' && <WorkflowPerfTab data={workflowPerf} />}
      {tab === 'pipeline'  && pipeline && <PipelineTab data={pipeline} />}
      {tab === 'cost'      && cost && <CostTab data={cost} />}
      {tab === 'approvals' && <ApprovalHistoryTab items={approvals} />}
    </div>
  )
}
