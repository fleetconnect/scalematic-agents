import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import { WorkflowDefinition, WorkflowRun } from '../types/workflow';
import { runAgent } from './agentRunner';
import { createApproval } from '../approvals/approvalQueue';
import { ApprovalRequiredError } from '../utils/errors';
import { logger } from '../utils/logger';

const WORKFLOW_REGISTRY: Map<string, WorkflowDefinition> = new Map();

export function registerWorkflow(def: WorkflowDefinition): void {
  WORKFLOW_REGISTRY.set(def.id, def);
  logger.info(`Workflow registered: ${def.name}`);
}

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return WORKFLOW_REGISTRY.get(id);
}

export function listWorkflows(): WorkflowDefinition[] {
  return Array.from(WORKFLOW_REGISTRY.values());
}

function saveRun(run: WorkflowRun): void {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM workflow_runs WHERE id = ?').get(run.id);
  if (existing) {
    db.prepare(
      `UPDATE workflow_runs SET status=?, current_step=?, step_outputs=?, completed_at=?, error=? WHERE id=?`
    ).run(run.status, run.currentStep, JSON.stringify(run.stepOutputs), run.completedAt ?? null, run.error ?? null, run.id);
  } else {
    db.prepare(
      `INSERT INTO workflow_runs (id, workflow_id, input, status, current_step, step_outputs, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(run.id, run.workflowId, JSON.stringify(run.input), run.status, run.currentStep, JSON.stringify(run.stepOutputs), run.createdAt);
  }
}

export async function runWorkflow(
  workflowId: string,
  input: Record<string, unknown>,
  onStepComplete?: (step: number, agentId: string, output: Record<string, unknown>) => void
): Promise<WorkflowRun> {
  const def = WORKFLOW_REGISTRY.get(workflowId);
  if (!def) throw new Error(`Workflow not found: ${workflowId}`);

  const run: WorkflowRun = {
    id: uuid(),
    workflowId,
    input,
    status: 'running',
    currentStep: 0,
    stepOutputs: [],
    createdAt: new Date().toISOString(),
  };

  saveRun(run);
  logger.info(`Workflow run started: ${run.id} [${def.name}]`);

  for (const step of def.steps) {
    run.currentStep = step.stepIndex;
    saveRun(run);

    const stepInput = step.inputMapper(input, run.stepOutputs);
    logger.info(`Step ${step.stepIndex}: ${step.description} → ${step.agentId}`);

    try {
      const { taskId, output } = await runAgent(step.agentId, step.taskType, stepInput, {
        workflowRunId: run.id,
        workflowStep: step.stepIndex,
      });

      if (step.requiresApproval) {
        const approval = createApproval(taskId, step.agentId, output, run.id);
        run.status = 'awaiting_approval';
        run.stepOutputs.push({ ...output, _approval_id: approval.id, _step: step.stepIndex });
        saveRun(run);
        logger.info(`Step ${step.stepIndex} awaiting approval: ${approval.id}`);
        throw new ApprovalRequiredError(approval.id);
      }

      run.stepOutputs.push({ ...output, _step: step.stepIndex });
      onStepComplete?.(step.stepIndex, step.agentId, output);
    } catch (err) {
      if (err instanceof ApprovalRequiredError) throw err;
      const error = err instanceof Error ? err.message : String(err);
      run.status = 'failed';
      run.error = error;
      run.completedAt = new Date().toISOString();
      saveRun(run);
      throw err;
    }
  }

  run.status = 'completed';
  run.completedAt = new Date().toISOString();
  saveRun(run);
  logger.info(`Workflow run completed: ${run.id}`);
  return run;
}

export async function resumeWorkflow(runId: string, fromStep: number): Promise<WorkflowRun> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined;
  if (!row) throw new Error(`Workflow run not found: ${runId}`);

  const def = WORKFLOW_REGISTRY.get(row.workflow_id as string);
  if (!def) throw new Error(`Workflow definition not found: ${row.workflow_id as string}`);

  const run: WorkflowRun = {
    id: row.id as string,
    workflowId: row.workflow_id as string,
    input: JSON.parse(row.input as string),
    status: 'running',
    currentStep: fromStep,
    stepOutputs: JSON.parse(row.step_outputs as string),
    createdAt: row.created_at as string,
  };

  saveRun(run);
  logger.info(`Workflow run resumed: ${run.id} from step ${fromStep}`);

  for (const step of def.steps.filter((s) => s.stepIndex >= fromStep)) {
    run.currentStep = step.stepIndex;
    saveRun(run);

    const stepInput = step.inputMapper(run.input, run.stepOutputs);
    logger.info(`Step ${step.stepIndex}: ${step.description} → ${step.agentId}`);

    try {
      const { taskId, output } = await runAgent(step.agentId, step.taskType, stepInput, {
        workflowRunId: run.id,
        workflowStep: step.stepIndex,
      });

      if (step.requiresApproval) {
        const approval = createApproval(taskId, step.agentId, output, run.id);
        run.status = 'awaiting_approval';
        run.stepOutputs.push({ ...output, _approval_id: approval.id, _step: step.stepIndex });
        saveRun(run);
        throw new ApprovalRequiredError(approval.id);
      }

      run.stepOutputs.push({ ...output, _step: step.stepIndex });
    } catch (err) {
      if (err instanceof ApprovalRequiredError) throw err;
      const error = err instanceof Error ? err.message : String(err);
      run.status = 'failed';
      run.error = error;
      run.completedAt = new Date().toISOString();
      saveRun(run);
      throw err;
    }
  }

  run.status = 'completed';
  run.completedAt = new Date().toISOString();
  saveRun(run);
  logger.info(`Workflow run completed: ${run.id}`);
  return run;
}

export function getWorkflowRun(runId: string): WorkflowRun | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    workflowId: row.workflow_id as string,
    input: JSON.parse(row.input as string),
    status: row.status as WorkflowRun['status'],
    currentStep: row.current_step as number,
    stepOutputs: JSON.parse(row.step_outputs as string),
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | undefined,
    error: row.error as string | undefined,
  };
}
