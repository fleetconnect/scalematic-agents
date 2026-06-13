import { AgentId } from './agent';

export interface WorkflowStep {
  stepIndex: number;
  agentId: AgentId;
  taskType: string;
  description: string;
  requiresApproval: boolean;
  inputMapper: (
    initialInput: Record<string, unknown>,
    previousOutputs: Record<string, unknown>[]
  ) => Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: WorkflowStep[];
}

export type WorkflowRunStatus = 'running' | 'completed' | 'failed' | 'awaiting_approval';

export interface WorkflowRun {
  id: string;
  workflowId: string;
  input: Record<string, unknown>;
  status: WorkflowRunStatus;
  currentStep: number;
  stepOutputs: Record<string, unknown>[];
  createdAt: string;
  completedAt?: string;
  error?: string;
}
