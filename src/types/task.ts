export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'awaiting_approval';

export interface Task {
  id: string;
  type: string;
  input: Record<string, unknown>;
  assignedAgent: string;
  status: TaskStatus;
  priority: number;
  output?: Record<string, unknown>;
  workflowRunId?: string;
  workflowStep?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CreateTaskInput {
  type: string;
  input: Record<string, unknown>;
  assignedAgent: string;
  priority?: number;
  workflowRunId?: string;
  workflowStep?: number;
}
