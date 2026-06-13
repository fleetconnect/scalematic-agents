/**
 * Dashboard Service
 *
 * Integration status per function:
 *   LIVE   — calls the scalematic-agents backend at /api/*
 *   MOCK   — no backend support yet; replace when ready
 *
 * The Vite proxy forwards /api → http://localhost:3100 (set in vite.config.ts).
 */

import type {
  Agent,
  AgentStatus,
  AgentTask,
  TaskStatus,
  WorkflowDefinitionMeta,
  WorkflowRun,
  WorkflowStatus,
  ApprovalItem,
  ApprovalItemType,
  ApprovalStatus,
  RiskLevel,
  DailyAgentReport,
  StuckTask,
  StuckReason,
  CostUsageSummary,
  PipelineInsight,
  ExecutiveSummary,
  AgentPerformanceMetric,
  WorkflowPerformanceMetric,
} from '../types/dashboard'

// ── Helpers ───────────────────────────────────────────────────────

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

function inferAgentStatus(
  agentId: string,
  tasks: RawTask[],
  pendingApprovals: RawApproval[]
): AgentStatus {
  const now = Date.now()
  const runningTask = tasks.find(
    (t) => t.assigned_agent === agentId && t.status === 'running'
  )
  if (runningTask) {
    const age = now - new Date(runningTask.created_at).getTime()
    return age > 10 * 60 * 1000 ? 'failed' : 'running'
  }
  const waitingApproval = pendingApprovals.find((a) => a.agent_id === agentId)
  if (waitingApproval) return 'waiting_for_approval'

  const recentFailed = tasks.find(
    (t) =>
      t.assigned_agent === agentId &&
      t.status === 'failed' &&
      Date.now() - new Date(t.created_at).getTime() < 60 * 60 * 1000
  )
  if (recentFailed) return 'failed'

  const recentComplete = tasks.find(
    (t) => t.assigned_agent === agentId && t.status === 'completed'
  )
  return recentComplete ? 'complete' : 'idle'
}

function countToday(tasks: RawTask[], agentId: string, status: string): number {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  return tasks.filter(
    (t) =>
      t.assigned_agent === agentId &&
      t.status === status &&
      new Date(t.created_at) >= midnight
  ).length
}

function inferApprovalType(agentId: string, output: Record<string, unknown>): ApprovalItemType {
  if (agentId === 'content') return 'content_post'
  if (agentId === 'crm') {
    const action = (output.action as Record<string, unknown> | undefined)?.type as string | undefined
    if (action === 'opportunity_update') return 'opportunity_update'
    return 'crm_update'
  }
  if (agentId === 'ops') return 'workflow_trigger'
  const channel = output.channel as string | undefined
  if (channel === 'email') return 'email'
  if (channel === 'sms') return 'sms'
  return 'linkedin_dm'
}

function inferRiskLevel(agentId: string, output: Record<string, unknown>): RiskLevel {
  if (agentId === 'crm') return 'medium'
  const action = (output.action as Record<string, unknown> | undefined)?.type as string | undefined
  if (action === 'opportunity_update') return 'medium'
  const body = JSON.stringify(output).toLowerCase()
  if (body.includes('delete') || body.includes('remove') || body.includes('high-value')) return 'high'
  return 'low'
}

function extractContactName(output: Record<string, unknown>): string {
  return (
    (output.contact_name as string | undefined) ??
    ((output.action as Record<string, unknown> | undefined)?.contactId as string | undefined) ??
    'Unknown'
  )
}

function extractSummary(output: Record<string, unknown>, agentId: string): string {
  if (agentId === 'messaging') {
    const variants = output.message_variants as Array<{ body?: string }> | undefined
    if (variants?.[0]?.body) return variants[0].body.slice(0, 120) + '...'
  }
  if (agentId === 'content') {
    const posts = output.linkedin_posts as Array<{ hook?: string }> | undefined
    if (posts?.[0]?.hook) return `LinkedIn post: "${posts[0].hook}"`
  }
  if (agentId === 'crm') {
    const reason = output.reason as string | undefined
    if (reason) return reason
  }
  const raw = output.raw_output as string | undefined
  if (raw) return raw.slice(0, 120)
  return JSON.stringify(output).slice(0, 120)
}

function extractFullDraft(output: Record<string, unknown>, agentId: string): string | undefined {
  if (agentId === 'messaging') {
    const variants = output.message_variants as Array<{ body?: string }> | undefined
    if (variants) return variants.map((v, i) => `Variant ${i + 1}:\n${v.body ?? ''}`).join('\n\n')
  }
  if (agentId === 'content') {
    const posts = output.linkedin_posts as Array<{ hook?: string; body?: string; cta?: string }> | undefined
    if (posts) return posts.map((p) => `${p.hook ?? ''}\n\n${p.body ?? ''}\n\n${p.cta ?? ''}`).join('\n\n---\n\n')
  }
  return undefined
}

function parseDailyReport(markdown: string, generatedAt: string): DailyAgentReport {
  const section = (heading: string): string[] => {
    const re = new RegExp(`###\\s+${heading}\\n([\\s\\S]*?)(?=###|$)`, 'i')
    const match = markdown.match(re)
    if (!match) return []
    return match[1]
      .split('\n')
      .map((l) => l.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean)
  }

  return {
    generatedAt,
    whatChanged: section('What changed'),
    actionsPrepared: section('Actions prepared'),
    needsApproval: section('Needs approval'),
    needsHumanAttention: section('Needs human attention'),
    skippedToSaveCost: section('Skipped to save cost'),
    recommendedNextMove:
      section('Recommended next move')[0]?.replace(/^-\s*/, '') ??
      'Run Daily Light Scan to generate today\'s report.',
  }
}

// ── Raw backend shapes ────────────────────────────────────────────

interface RawTask {
  id: string
  type: string
  assigned_agent: string
  status: string
  workflow_run_id?: string
  workflow_step?: number
  output?: Record<string, unknown> | null
  error?: string
  created_at: string
  completed_at?: string
}

interface RawApproval {
  id: string
  task_id: string
  agent_id: string
  output: Record<string, unknown>
  workflow_run_id?: string
  status: string
  reviewed_by?: string
  comments?: string
  created_at: string
  reviewed_at?: string
}

interface RawAgent {
  id: string
  name: string
  role: string
  toolsAllowed: string[]
  approvalRequired: boolean
}

interface RawWorkflowRun {
  id: string
  workflow_id: string
  status: string
  current_step: number
  step_outputs: Record<string, unknown>[]
  created_at: string
  completed_at?: string
  error?: string
}

interface CronStateRaw {
  last_run_at: string
  previous_daily_summary: string
  next_run_focus: string
  pending_approval_ids: string
  skipped_items: string
}

// ── LIVE: Agents ──────────────────────────────────────────────────

export async function getAgentActivity(): Promise<Agent[]> {
  const [rawAgents, rawTasks, rawApprovals] = await Promise.all([
    api<RawAgent[]>('/agents'),
    api<RawTask[]>('/tasks'),
    api<RawApproval[]>('/approvals'),
  ])

  const pendingApprovals = rawApprovals.filter((a) => a.status === 'pending')

  return rawAgents.map((a): Agent => {
    const agentTasks = rawTasks.filter((t) => t.assigned_agent === a.id)
    const running = agentTasks.find((t) => t.status === 'running')
    const lastTask = agentTasks[0]

    const workflowRunIds = new Set(
      agentTasks.filter((t) => t.status === 'running' && t.workflow_run_id).map((t) => t.workflow_run_id!)
    )

    return {
      id: a.id,
      name: a.name,
      role: a.role,
      status: inferAgentStatus(a.id, rawTasks, pendingApprovals),
      lastRunAt: lastTask?.created_at ?? null,
      tasksCompletedToday: countToday(rawTasks, a.id, 'completed'),
      tasksPending: agentTasks.filter((t) => t.status === 'pending' || t.status === 'running').length,
      tasksFailed: agentTasks.filter((t) => t.status === 'failed').length,
      currentWorkflow: running?.workflow_run_id ? Array.from(workflowRunIds)[0] ?? null : null,
      recentOutputSummary: lastTask?.output
        ? extractSummary(lastTask.output, a.id)
        : 'No recent output.',
      toolsAllowed: a.toolsAllowed,
      approvalRequired: a.approvalRequired,
    }
  })
}

export async function getAgentTasks(agentId: string): Promise<AgentTask[]> {
  const raw = await api<RawTask[]>('/tasks')
  return raw
    .filter((t) => t.assigned_agent === agentId)
    .slice(0, 20)
    .map((t): AgentTask => ({
      id: t.id,
      agentId: t.assigned_agent,
      type: t.type,
      status: t.status as TaskStatus,
      workflowRunId: t.workflow_run_id,
      workflowStep: t.workflow_step,
      createdAt: t.created_at,
      completedAt: t.completed_at,
      error: t.error,
      outputSummary: t.output ? extractSummary(t.output, t.assigned_agent) : undefined,
      durationMs:
        t.completed_at
          ? new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()
          : undefined,
    }))
}

// ── LIVE: Approvals ───────────────────────────────────────────────

export async function getApprovalQueue(): Promise<ApprovalItem[]> {
  const raw = await api<RawApproval[]>('/approvals')
  return raw.map((a): ApprovalItem => ({
    id: a.id,
    type: inferApprovalType(a.agent_id, a.output),
    contactName: extractContactName(a.output),
    agentId: a.agent_id,
    createdAt: a.created_at,
    riskLevel: inferRiskLevel(a.agent_id, a.output),
    summary: extractSummary(a.output, a.agent_id),
    status: a.status as ApprovalStatus,
    fullDraft: extractFullDraft(a.output, a.agent_id),
  }))
}

export async function approveItem(approvalId: string): Promise<void> {
  await api(`/approvals/${approvalId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved', reviewed_by: 'founder' }),
  })
}

export async function rejectItem(approvalId: string, reason: string): Promise<void> {
  await api(`/approvals/${approvalId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status: 'rejected', reviewed_by: 'founder', comments: reason }),
  })
}

export async function requestRevision(approvalId: string, notes: string): Promise<void> {
  await api(`/approvals/${approvalId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status: 'needs_revision', reviewed_by: 'founder', comments: notes }),
  })
}

export async function updateApprovalStatus(id: string, status: ApprovalStatus): Promise<void> {
  await api(`/approvals/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, reviewed_by: 'founder' }),
  })
}

// ── LIVE: Workflows ───────────────────────────────────────────────

export async function getWorkflowRuns(): Promise<WorkflowDefinitionMeta[]> {
  const [defs, runs] = await Promise.all([
    api<Array<{ id: string; name: string; description: string; trigger: string }>>('/workflows'),
    api<RawWorkflowRun[]>('/workflows/runs'),
  ])

  return defs.map((def): WorkflowDefinitionMeta => {
    const lastRun = runs.find((r) => r.workflow_id === def.id)
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      trigger: def.trigger,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            workflowId: lastRun.workflow_id,
            workflowName: def.name,
            status: lastRun.status as WorkflowStatus,
            currentStep: lastRun.current_step,
            totalSteps: lastRun.step_outputs.length + 1,
            itemsProcessed: 1,
            outputsCreated: lastRun.step_outputs.length,
            approvalsGenerated: lastRun.step_outputs.filter((s) => s._approval_id).length,
            startedAt: lastRun.created_at,
            completedAt: lastRun.completed_at,
            durationMs: lastRun.completed_at
              ? new Date(lastRun.completed_at).getTime() - new Date(lastRun.created_at).getTime()
              : undefined,
            error: lastRun.error,
          }
        : null,
    }
  })
}

export async function getRecentWorkflowRuns(): Promise<WorkflowRun[]> {
  const runs = await api<RawWorkflowRun[]>('/workflows/runs')
  return runs.map((r): WorkflowRun => ({
    id: r.id,
    workflowId: r.workflow_id,
    workflowName: r.workflow_id,
    status: r.status as WorkflowStatus,
    currentStep: r.current_step,
    totalSteps: r.step_outputs.length + 1,
    itemsProcessed: 1,
    outputsCreated: r.step_outputs.length,
    approvalsGenerated: r.step_outputs.filter((s) => s._approval_id).length,
    startedAt: r.created_at,
    completedAt: r.completed_at,
    durationMs: r.completed_at
      ? new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()
      : undefined,
    error: r.error,
  }))
}

// ── LIVE: Daily Report (from cron state) ─────────────────────────

export async function getDailyReport(): Promise<DailyAgentReport | null> {
  try {
    const state = await api<CronStateRaw>('/cron/state')
    if (!state.previous_daily_summary) return null
    return parseDailyReport(state.previous_daily_summary, state.last_run_at)
  } catch {
    return null
  }
}

// ── LIVE: Stuck Tasks (computed from tasks + approvals) ───────────

export async function getStuckTasks(): Promise<StuckTask[]> {
  const [tasks, approvals] = await Promise.all([
    api<RawTask[]>('/tasks'),
    api<RawApproval[]>('/approvals'),
  ])

  const stuck: StuckTask[] = []
  const now = Date.now()

  for (const t of tasks) {
    if (t.status === 'failed') {
      stuck.push({
        id: t.id,
        taskName: t.type,
        agentId: t.assigned_agent,
        workflowId: t.workflow_run_id,
        stuckReason: 'failed' as StuckReason,
        stuckSince: t.completed_at ?? t.created_at,
        suggestedFix: t.error ?? 'Check the error log and re-queue the task.',
      })
    } else if (t.status === 'running') {
      const age = now - new Date(t.created_at).getTime()
      if (age > 15 * 60 * 1000) {
        stuck.push({
          id: t.id,
          taskName: t.type,
          agentId: t.assigned_agent,
          workflowId: t.workflow_run_id,
          stuckReason: 'running_too_long' as StuckReason,
          stuckSince: t.created_at,
          suggestedFix: 'Task has been running over 15 minutes. Restart the agent server if it appears hung.',
        })
      }
    }
  }

  for (const a of approvals) {
    if (a.status === 'pending') {
      const age = now - new Date(a.created_at).getTime()
      if (age > 8 * 60 * 60 * 1000) {
        stuck.push({
          id: a.id,
          taskName: `Pending approval — ${a.agent_id}`,
          agentId: a.agent_id,
          workflowId: a.workflow_run_id,
          stuckReason: 'approval_pending_too_long' as StuckReason,
          stuckSince: a.created_at,
          suggestedFix: 'Approval has been pending 8+ hours. Review and approve or reject from the Approval Queue.',
        })
      }
    }
  }

  return stuck
}

// ── LIVE: Executive Summary (computed from live data) ─────────────

export async function getDashboardSummary(): Promise<ExecutiveSummary> {
  const [tasks, approvals] = await Promise.all([
    api<RawTask[]>('/tasks'),
    api<RawApproval[]>('/approvals'),
  ])

  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)

  const todayTasks = tasks.filter((t) => new Date(t.created_at) >= midnight)
  const pending = approvals.filter((a) => a.status === 'pending')
  const failed = tasks.filter(
    (t) => t.status === 'failed' && new Date(t.created_at) >= midnight
  )
  const stuckApprovals = approvals.filter(
    (a) => a.status === 'pending' && Date.now() - new Date(a.created_at).getTime() > 8 * 3600 * 1000
  )

  return {
    cards: [
      { key: 'agentRunsToday', label: 'Agent Runs Today', value: todayTasks.length, delta: 0, statusColor: 'green' },
      { key: 'tasksCompleted', label: 'Tasks Completed', value: todayTasks.filter((t) => t.status === 'completed').length, delta: 0, statusColor: 'green' },
      { key: 'pendingApprovals', label: 'Pending Approvals', value: pending.length, delta: 0, statusColor: pending.length > 0 ? 'amber' : 'green' },
      { key: 'stuckTasks', label: 'Stuck Tasks', value: failed.length + stuckApprovals.length, delta: 0, statusColor: failed.length > 0 ? 'red' : 'green' },
      { key: 'newLeadsReviewed', label: 'New Leads Reviewed', value: todayTasks.filter((t) => t.type === 'research_lead').length, delta: 0, statusColor: 'violet' },
      { key: 'repliesDrafted', label: 'Replies Drafted', value: todayTasks.filter((t) => t.type.includes('reply') || t.type.includes('draft')).length, delta: 0, statusColor: 'default' },
      { key: 'callsPrepared', label: 'Calls Prepared', value: todayTasks.filter((t) => t.type.includes('call_prep') || t.type.includes('pre_call')).length, delta: 0, statusColor: 'green' },
      { key: 'followUpsCreated', label: 'Follow Ups Created', value: todayTasks.filter((t) => t.type.includes('follow')).length, delta: 0, statusColor: 'default' },
      { key: 'opportunitiesFlagged', label: 'Opportunities Flagged', value: todayTasks.filter((t) => t.type.includes('stalled') || t.type.includes('opportunity')).length, delta: 0, statusColor: 'amber' },
      { key: 'timeSaved', label: 'Est. Time Saved', value: `${(todayTasks.filter((t) => t.status === 'completed').length * 0.25).toFixed(1)}h`, delta: 0, statusColor: 'green' },
    ],
  }
}

// ── LIVE: Workflow Performance (from DB runs) ─────────────────────

export async function getWorkflowPerformance(): Promise<WorkflowPerformanceMetric[]> {
  const [defs, runs] = await Promise.all([
    api<Array<{ id: string; name: string }>>('/workflows'),
    api<RawWorkflowRun[]>('/workflows/runs'),
  ])

  return defs.map((def): WorkflowPerformanceMetric => {
    const defRuns = runs.filter((r) => r.workflow_id === def.id)
    const completed = defRuns.filter((r) => r.status === 'completed')
    const failed = defRuns.filter((r) => r.status === 'failed')
    const lastCompleted = completed[0]
    const lastDuration = lastCompleted?.completed_at
      ? new Date(lastCompleted.completed_at).getTime() - new Date(lastCompleted.created_at).getTime()
      : 0

    return {
      workflowId: def.id,
      workflowName: def.name,
      runsCompleted: completed.length,
      itemsProcessed: completed.length,
      outputsCreated: completed.reduce((n, r) => n + r.step_outputs.length, 0),
      approvalItemsGenerated: completed.reduce(
        (n, r) => n + r.step_outputs.filter((s) => s._approval_id).length,
        0
      ),
      failedRuns: failed.length,
      lastRunDurationMs: lastDuration,
    }
  })
}

// ── LIVE: Pipeline Insights (from GHL via cron data) ─────────────

interface RawPipelineSummary {
  total_opportunities: number
  by_stage: Record<string, number>
  unread_conversations: number
  total_conversations: number
  leads_reviewed: number
  replies_drafted: number
  calls_prepped: number
}

export async function getPipelineInsights(): Promise<PipelineInsight> {
  try {
    const raw = await api<RawPipelineSummary>('/ghl/pipeline-summary')
    const stageValues = Object.values(raw.by_stage)
    const staleCount = stageValues.reduce((n, v) => n + v, 0)

    return {
      newLeads: raw.leads_reviewed,
      warmReplies: raw.replies_drafted,
      bookedCalls: raw.calls_prepped,
      staleOpportunities: Math.max(0, staleCount - raw.calls_prepped - raw.replies_drafted),
      followUpsNeeded: raw.unread_conversations,
      opportunitiesAtRisk: raw.total_opportunities,
      priorityContacts: [],
    }
  } catch {
    return {
      newLeads: 0,
      warmReplies: 0,
      bookedCalls: 0,
      staleOpportunities: 0,
      followUpsNeeded: 0,
      opportunitiesAtRisk: 0,
      priorityContacts: [],
    }
  }
}

// ── LIVE: Cost Usage (from task token tracking) ───────────────────

interface RawCostUsage {
  daily: Array<{ day: string; input_tokens: number; output_tokens: number; task_count: number }>
  by_agent: Array<{ assigned_agent: string; input_tokens: number; output_tokens: number; task_count: number }>
  totals: { total_input: number; total_output: number; total_tasks: number }
}

const INPUT_TOKEN_COST_PER_M = 3.0
const OUTPUT_TOKEN_COST_PER_M = 15.0

function calcCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_TOKEN_COST_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_TOKEN_COST_PER_M
}

export async function getCostUsage(): Promise<CostUsageSummary> {
  try {
    const [raw, cronState] = await Promise.all([
      api<RawCostUsage>('/metrics/cost-usage'),
      api<CronStateRaw>('/cron/state'),
    ])

    const today = new Date().toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    const todayRow = raw.daily.find((d) => d.day === today)
    const weekRows = raw.daily.filter((d) => d.day >= sevenDaysAgo)

    const tokensToday = (todayRow?.input_tokens ?? 0) + (todayRow?.output_tokens ?? 0)
    const tokensWeek = weekRows.reduce((n, d) => n + d.input_tokens + d.output_tokens, 0)

    const topAgent = raw.by_agent[0]
    const skippedItems: string[] = (() => {
      try { return JSON.parse(cronState.skipped_items) as string[] } catch { return [] }
    })()

    return {
      estimatedTokensToday: tokensToday,
      estimatedTokensThisWeek: tokensWeek,
      estimatedCostTodayUsd: calcCost(todayRow?.input_tokens ?? 0, todayRow?.output_tokens ?? 0),
      estimatedCostThisWeekUsd: calcCost(
        weekRows.reduce((n, d) => n + d.input_tokens, 0),
        weekRows.reduce((n, d) => n + d.output_tokens, 0)
      ),
      highestCostAgent: topAgent?.assigned_agent ?? 'none',
      highestCostWorkflow: 'transcript-to-assets',
      recordsSkipped: skippedItems.length,
      costReductionSuggestions:
        skippedItems.length > 0
          ? ['Some records were skipped by the daily cron to stay within token limits.']
          : ['Token usage is within normal range.'],
    }
  } catch {
    return {
      estimatedTokensToday: 0,
      estimatedTokensThisWeek: 0,
      estimatedCostTodayUsd: 0,
      estimatedCostThisWeekUsd: 0,
      highestCostAgent: 'none',
      highestCostWorkflow: 'none',
      recordsSkipped: 0,
      costReductionSuggestions: [],
    }
  }
}

// ── LIVE: Agent Performance (from tasks table) ────────────────────

interface RawAgentPerf {
  assigned_agent: string
  total: number
  completed: number
  failed: number
  pending: number
  avg_duration_seconds: number | null
}

export async function getAgentPerformance(): Promise<AgentPerformanceMetric[]> {
  const [rawPerf, rawAgents, rawApprovals] = await Promise.all([
    api<RawAgentPerf[]>('/metrics/agent-performance'),
    api<RawAgent[]>('/agents'),
    api<RawApproval[]>('/approvals'),
  ])

  const agentNameMap = Object.fromEntries(rawAgents.map((a) => [a.id, a.name]))
  const approvedByAgent = rawApprovals.reduce<Record<string, number>>((acc, a) => {
    if (a.status === 'approved') acc[a.agent_id] = (acc[a.agent_id] ?? 0) + 1
    return acc
  }, {})
  const revisedByAgent = rawApprovals.reduce<Record<string, number>>((acc, a) => {
    if (a.status === 'needs_revision') acc[a.agent_id] = (acc[a.agent_id] ?? 0) + 1
    return acc
  }, {})

  const allAgentIds = new Set([
    ...rawAgents.map((a) => a.id),
    ...rawPerf.map((p) => p.assigned_agent),
  ])

  return Array.from(allAgentIds).map((agentId): AgentPerformanceMetric => {
    const perf = rawPerf.find((p) => p.assigned_agent === agentId)
    const approved = approvedByAgent[agentId] ?? 0
    const revised = revisedByAgent[agentId] ?? 0
    const totalApprovalDecisions = approved + revised + (rawApprovals.filter(
      (a) => a.agent_id === agentId && a.status === 'rejected'
    ).length)

    return {
      agentId,
      agentName: agentNameMap[agentId] ?? agentId,
      tasksCompleted: perf?.completed ?? 0,
      avgCompletionMs: perf?.avg_duration_seconds != null ? perf.avg_duration_seconds * 1000 : 0,
      failureCount: perf?.failed ?? 0,
      approvalRate: totalApprovalDecisions > 0 ? approved / totalApprovalDecisions : 0,
      revisionRate: totalApprovalDecisions > 0 ? revised / totalApprovalDecisions : 0,
      mostCommonTaskType: agentId,
    }
  })
}

// ── Triggers ──────────────────────────────────────────────────────

export async function runWorkflowManually(workflowId: string): Promise<void> {
  await api(`/workflows/${workflowId}/run`, {
    method: 'POST',
    body: JSON.stringify({ input: {} }),
  })
}

export async function runAgentManually(agentId: string): Promise<void> {
  await api(`/agents/${agentId}/run`, {
    method: 'POST',
    body: JSON.stringify({ task_type: 'manual_run', input: {} }),
  })
}

export async function refreshDashboardData(): Promise<void> {
  // Just re-fetches — all data functions are called fresh by each page component.
  await new Promise((r) => setTimeout(r, 300))
}
