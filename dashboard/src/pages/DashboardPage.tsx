import { useEffect, useState } from 'react'
import type { Agent, AgentTask, ExecutiveSummary, DailyAgentReport, WorkflowDefinitionMeta, StuckTask, ApprovalItem } from '../types/dashboard'
import {
  getDashboardSummary, getAgentActivity, getAgentTasks,
  getWorkflowRuns, getDailyReport, getStuckTasks,
  getApprovalQueue, runWorkflowManually,
} from '../services/dashboardService'
import RecommendedNextMove from '../components/RecommendedNextMove'
import ExecutiveSummaryCards from '../components/ExecutiveSummaryCards'
import AgentActivityBoard from '../components/AgentActivityBoard'
import DailyReportPanel from '../components/DailyReportPanel'
import StuckTaskMonitor from '../components/StuckTaskMonitor'
import WorkflowActivityGrid from '../components/WorkflowActivityGrid'
import AgentDetailDrawer from '../components/AgentDetailDrawer'

export default function DashboardPage() {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [workflows, setWorkflows] = useState<WorkflowDefinitionMeta[]>([])
  const [report, setReport] = useState<DailyAgentReport | null>(null)
  const [stuckTasks, setStuckTasks] = useState<StuckTask[]>([])
  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<AgentTask[]>([])

  useEffect(() => {
    Promise.all([
      getDashboardSummary().then(setSummary),
      getAgentActivity().then(setAgents),
      getWorkflowRuns().then(setWorkflows),
      getDailyReport().then(setReport),
      getStuckTasks().then(setStuckTasks),
      getApprovalQueue().then(setApprovals),
    ])
  }, [])

  async function handleSelectAgent(agent: Agent) {
    setSelectedAgent(agent)
    const tasks = await getAgentTasks(agent.id)
    setSelectedTasks(tasks)
  }

  const pendingApprovals = approvals.filter((a) => a.status === 'pending')
  const recommendation = report?.recommendedNextMove ?? 'Run Daily Light Scan to generate today\'s recommended action.'

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <RecommendedNextMove recommendation={recommendation} />

      {summary && <ExecutiveSummaryCards summary={summary} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DailyReportPanel
          report={report}
          onRunScan={() => runWorkflowManually('cron-daily')}
        />
        <StuckTaskMonitor tasks={stuckTasks} />
      </div>

      {pendingApprovals.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-300">
              {pendingApprovals.length} approval{pendingApprovals.length !== 1 ? 's' : ''} waiting for your review
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {pendingApprovals.map((a) => a.contactName).join(', ')}
            </p>
          </div>
          <a
            href="/dashboard/approvals"
            className="px-3 py-1.5 text-xs text-amber-300 bg-amber-900/40 border border-amber-800/50 rounded-lg hover:bg-amber-900/60 transition-colors whitespace-nowrap"
          >
            Review Queue
          </a>
        </div>
      )}

      <AgentActivityBoard agents={agents} onSelectAgent={handleSelectAgent} />
      <WorkflowActivityGrid workflows={workflows} />

      <AgentDetailDrawer
        agent={selectedAgent}
        tasks={selectedTasks}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  )
}
