import type { AgentStatus, ApprovalStatus, WorkflowStatus, TaskStatus, StuckReason } from '../types/dashboard'

type AnyStatus = AgentStatus | ApprovalStatus | WorkflowStatus | TaskStatus | StuckReason | string

const styles: Record<string, string> = {
  // Agent
  idle:                   'bg-gray-800 text-gray-400',
  running:                'bg-violet-900/60 text-violet-300 animate-pulse',
  waiting_for_approval:   'bg-amber-900/50 text-amber-300',
  needs_human_input:      'bg-orange-900/50 text-orange-300',
  failed:                 'bg-red-900/50 text-red-300',
  complete:               'bg-emerald-900/50 text-emerald-300',
  // Approval
  pending:                'bg-amber-900/50 text-amber-300',
  approved:               'bg-emerald-900/50 text-emerald-300',
  rejected:               'bg-red-900/50 text-red-300',
  needs_revision:         'bg-orange-900/50 text-orange-300',
  // Workflow
  completed:              'bg-emerald-900/50 text-emerald-300',
  awaiting_approval:      'bg-amber-900/50 text-amber-300',
  // Risk
  low:                    'bg-emerald-900/40 text-emerald-400',
  medium:                 'bg-amber-900/40 text-amber-400',
  high:                   'bg-red-900/40 text-red-400',
}

const labels: Record<string, string> = {
  waiting_for_approval: 'Awaiting Approval',
  needs_human_input: 'Needs Input',
  awaiting_approval: 'Awaiting Approval',
  needs_revision: 'Needs Revision',
  approval_pending_too_long: 'Approval Overdue',
  running_too_long: 'Running Too Long',
  missing_data: 'Missing Data',
  waiting_human_input: 'Needs Human Input',
}

interface Props {
  status: AnyStatus
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const cls = styles[status] ?? 'bg-gray-800 text-gray-500'
  const label = labels[status] ?? status
  const sizeClass = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center rounded font-medium capitalize ${sizeClass} ${cls}`}>
      {label}
    </span>
  )
}
