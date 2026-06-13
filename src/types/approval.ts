export type ApprovalStatus = 'pending' | 'approved' | 'needs_revision' | 'rejected';

export interface Approval {
  id: string;
  taskId: string;
  workflowRunId?: string;
  agentId: string;
  output: Record<string, unknown>;
  status: ApprovalStatus;
  reviewedBy?: string;
  comments?: string;
  createdAt: string;
  reviewedAt?: string;
}
