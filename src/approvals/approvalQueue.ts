import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import { Approval, ApprovalStatus } from '../types/approval';
import { logger } from '../utils/logger';

export function createApproval(
  taskId: string,
  agentId: string,
  output: Record<string, unknown>,
  workflowRunId?: string
): Approval {
  const db = getDb();
  const approval: Approval = {
    id: uuid(),
    taskId,
    agentId,
    output,
    workflowRunId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO approvals (id, task_id, workflow_run_id, agent_id, output, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    approval.id, taskId, workflowRunId ?? null,
    agentId, JSON.stringify(output), 'pending', approval.createdAt
  );

  logger.info(`Approval created: ${approval.id} for task ${taskId}`);
  return approval;
}

export function reviewApproval(
  approvalId: string,
  status: ApprovalStatus,
  reviewedBy: string,
  comments?: string
): Approval {
  const db = getDb();
  const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId) as Record<string, unknown> | undefined;
  if (!row) throw new Error(`Approval not found: ${approvalId}`);

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE approvals SET status = ?, reviewed_by = ?, comments = ?, reviewed_at = ? WHERE id = ?'
  ).run(status, reviewedBy, comments ?? null, now, approvalId);

  logger.info(`Approval ${approvalId} → ${status} by ${reviewedBy}`);

  return {
    id: row.id as string,
    taskId: row.task_id as string,
    agentId: row.agent_id as string,
    output: JSON.parse(row.output as string),
    workflowRunId: row.workflow_run_id as string | undefined,
    status,
    reviewedBy,
    comments,
    createdAt: row.created_at as string,
    reviewedAt: now,
  };
}

export function getPendingApprovals(): Approval[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC").all();
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      agentId: row.agent_id as string,
      output: JSON.parse(row.output as string),
      workflowRunId: row.workflow_run_id as string | undefined,
      status: row.status as ApprovalStatus,
      reviewedBy: row.reviewed_by as string | undefined,
      comments: row.comments as string | undefined,
      createdAt: row.created_at as string,
      reviewedAt: row.reviewed_at as string | undefined,
    };
  });
}

export function getApproval(approvalId: string): Approval | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(approvalId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    agentId: row.agent_id as string,
    output: JSON.parse(row.output as string),
    workflowRunId: row.workflow_run_id as string | undefined,
    status: row.status as ApprovalStatus,
    reviewedBy: row.reviewed_by as string | undefined,
    comments: row.comments as string | undefined,
    createdAt: row.created_at as string,
    reviewedAt: row.reviewed_at as string | undefined,
  };
}
