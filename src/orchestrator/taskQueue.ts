import { getDb } from '../db/client';
import { Task, TaskStatus } from '../types/task';

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    type: row.type as string,
    input: JSON.parse(row.input as string),
    assignedAgent: row.assigned_agent as string,
    status: row.status as TaskStatus,
    priority: row.priority as number,
    output: row.output ? JSON.parse(row.output as string) : undefined,
    workflowRunId: row.workflow_run_id as string | undefined,
    workflowStep: row.workflow_step as number | undefined,
    error: row.error as string | undefined,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | undefined,
  };
}

export function listTasks(status?: TaskStatus, limit = 50): Task[] {
  const db = getDb();
  const rows = status
    ? db
        .prepare(
          'SELECT * FROM tasks WHERE status = ? ORDER BY priority DESC, created_at ASC LIMIT ?'
        )
        .all(status, limit)
    : db
        .prepare('SELECT * FROM tasks ORDER BY priority DESC, created_at ASC LIMIT ?')
        .all(limit);
  return (rows as Record<string, unknown>[]).map(rowToTask);
}

export function getTask(taskId: string): Task | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(taskId) as Record<string, unknown> | undefined;
  return row ? rowToTask(row) : null;
}

export function countByStatus(): Record<TaskStatus, number> {
  const db = getDb();
  const rows = db
    .prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status')
    .all() as Array<{ status: string; count: number }>;
  const result: Record<string, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    awaiting_approval: 0,
  };
  for (const row of rows) result[row.status] = row.count;
  return result as Record<TaskStatus, number>;
}

export function clearCompleted(olderThanDays = 7): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const result = db
    .prepare("DELETE FROM tasks WHERE status = 'completed' AND completed_at < ?")
    .run(cutoff);
  return result.changes;
}
