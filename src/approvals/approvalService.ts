import { runAgent } from '../orchestrator/agentRunner';
import { createApproval, getPendingApprovals, reviewApproval } from './approvalQueue';
import { sendApprovalRequest } from '../integrations/slack';
import { Approval, ApprovalStatus } from '../types/approval';
import { logger } from '../utils/logger';

export interface ApprovalSummary {
  pending: number;
  stale: number;
  oldestPendingAt: string | null;
}

export async function submitForApproval(
  taskId: string,
  agentId: string,
  output: Record<string, unknown>,
  workflowRunId?: string
): Promise<Approval> {
  // Governance reviews before the output ever reaches a human approver.
  // This keeps low-quality or risky drafts out of the queue entirely.
  const { output: govOutput } = await runAgent('governance', 'pre_approval_review', {
    content_to_review: output,
    agent_id: agentId,
    review_type: 'pre_approval',
  });

  const govStatus = (govOutput as Record<string, unknown>).status as string | undefined;

  if (govStatus === 'rejected') {
    logger.warn(`Governance rejected output from ${agentId} — not queued for approval`, {
      reasoning: govOutput.reasoning,
    });
    throw new Error(`Governance rejected: ${String(govOutput.reasoning ?? 'no reason given')}`);
  }

  const approvedOutput =
    govStatus === 'needs_revision' && govOutput.revised_output
      ? { ...output, _governance_revised: govOutput.revised_output }
      : output;

  const approval = createApproval(taskId, agentId, approvedOutput, workflowRunId);

  await sendApprovalRequest(
    { approvalId: approval.id, agentId, output: approvedOutput, govStatus },
    approval.id
  );

  return approval;
}

export function getApprovalSummary(staleAfterHours = 24): ApprovalSummary {
  const pending = getPendingApprovals();
  const cutoff = new Date(Date.now() - staleAfterHours * 3_600_000).toISOString();
  const stale = pending.filter((a) => a.createdAt < cutoff);

  return {
    pending: pending.length,
    stale: stale.length,
    oldestPendingAt: pending.length
      ? pending[pending.length - 1].createdAt
      : null,
  };
}

export function listStaleApprovals(olderThanHours = 24): Approval[] {
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000).toISOString();
  return getPendingApprovals().filter((a) => a.createdAt < cutoff);
}

export function approve(
  approvalId: string,
  reviewedBy: string,
  comments?: string
): Approval {
  return reviewApproval(approvalId, 'approved', reviewedBy, comments);
}

export function reject(
  approvalId: string,
  reviewedBy: string,
  comments: string
): Approval {
  return reviewApproval(approvalId, 'rejected', reviewedBy, comments);
}

export function requestRevision(
  approvalId: string,
  reviewedBy: string,
  comments: string
): Approval {
  return reviewApproval(approvalId, 'needs_revision', reviewedBy, comments);
}
