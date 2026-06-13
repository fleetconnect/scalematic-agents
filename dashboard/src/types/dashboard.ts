// ── Agent ─────────────────────────────────────────────────────────

export type AgentStatus =
  | 'idle'
  | 'running'
  | 'waiting_for_approval'
  | 'needs_human_input'
  | 'failed'
  | 'complete'

export interface Agent {
  id: string
  name: string
  role: string
  status: AgentStatus
  lastRunAt: string | null
  tasksCompletedToday: number
  tasksPending: number
  tasksFailed: number
  currentWorkflow: string | null
  recentOutputSummary: string
  toolsAllowed: string[]
  approvalRequired: boolean
}

// ── Task ──────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AgentTask {
  id: string
  agentId: string
  type: string
  status: TaskStatus
  workflowRunId?: string
  workflowStep?: number
  createdAt: string
  completedAt?: string
  error?: string
  outputSummary?: string
  durationMs?: number
}

// ── Workflow ──────────────────────────────────────────────────────

export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'awaiting_approval'

export interface WorkflowRun {
  id: string
  workflowId: string
  workflowName: string
  status: WorkflowStatus
  currentStep: number
  totalSteps: number
  itemsProcessed: number
  outputsCreated: number
  approvalsGenerated: number
  startedAt: string
  completedAt?: string
  durationMs?: number
  error?: string
}

export interface WorkflowDefinitionMeta {
  id: string
  name: string
  description: string
  trigger: string
  lastRun: WorkflowRun | null
}

// ── Approval ──────────────────────────────────────────────────────

export type ApprovalItemType =
  | 'email'
  | 'sms'
  | 'linkedin_dm'
  | 'proposal'
  | 'content_post'
  | 'crm_update'
  | 'opportunity_update'
  | 'calendar_invite'
  | 'workflow_trigger'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface ApprovalItem {
  id: string
  type: ApprovalItemType
  contactName: string
  agentId: string
  createdAt: string
  riskLevel: RiskLevel
  summary: string
  status: ApprovalStatus
  fullDraft?: string
}

// ── Reports ───────────────────────────────────────────────────────

export interface DailyAgentReport {
  generatedAt: string
  whatChanged: string[]
  actionsPrepared: string[]
  needsApproval: string[]
  needsHumanAttention: string[]
  skippedToSaveCost: string[]
  recommendedNextMove: string
}

export interface AgentPerformanceMetric {
  agentId: string
  agentName: string
  tasksCompleted: number
  avgCompletionMs: number
  failureCount: number
  approvalRate: number
  revisionRate: number
  mostCommonTaskType: string
}

export interface WorkflowPerformanceMetric {
  workflowId: string
  workflowName: string
  runsCompleted: number
  itemsProcessed: number
  outputsCreated: number
  approvalItemsGenerated: number
  failedRuns: number
  lastRunDurationMs: number
}

export interface PriorityContact {
  name: string
  reason: string
  urgency: 'high' | 'medium' | 'low'
}

export interface PipelineInsight {
  newLeads: number
  warmReplies: number
  bookedCalls: number
  staleOpportunities: number
  followUpsNeeded: number
  opportunitiesAtRisk: number
  priorityContacts: PriorityContact[]
}

export interface CostUsageSummary {
  estimatedTokensToday: number
  estimatedTokensThisWeek: number
  estimatedCostTodayUsd: number
  estimatedCostThisWeekUsd: number
  highestCostAgent: string
  highestCostWorkflow: string
  recordsSkipped: number
  costReductionSuggestions: string[]
}

// ── Stuck Tasks ───────────────────────────────────────────────────

export type StuckReason =
  | 'failed'
  | 'waiting_human_input'
  | 'running_too_long'
  | 'approval_pending_too_long'
  | 'missing_data'

export interface StuckTask {
  id: string
  taskName: string
  agentId: string
  workflowId?: string
  stuckReason: StuckReason
  stuckSince: string
  suggestedFix: string
}

// ── Executive Summary ─────────────────────────────────────────────

export interface SummaryCard {
  key: string
  label: string
  value: number | string
  delta: number
  unit?: string
  statusColor?: 'green' | 'amber' | 'red' | 'violet' | 'default'
}

export interface ExecutiveSummary {
  cards: SummaryCard[]
}
