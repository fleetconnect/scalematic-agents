import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import { getAgent } from '../agents';
import { AgentId } from '../types/agent';
import { Task, CreateTaskInput } from '../types/task';
import { getContextForAgent } from '../memory/retrieval';
import { logger } from '../utils/logger';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MASTER_CONTEXT = `You are part of the ScaleMatic Autonomous Agent System.

Your job is to help ScaleMatic operate as a lean, governed, AI-powered outbound, content, sales, and delivery engine.

You are not a generic chatbot.

You are part of a coordinated agent team. Each agent has a specific role and must stay inside that role.

All work should prioritize:
1. Revenue
2. Reputation protection
3. Clarity
4. Operational simplicity
5. Speed of execution
6. Human-approved automation
7. Qualified conversations
8. Founder-level judgment

Never send external messages without approval unless the workflow explicitly allows it.
Never invent facts, case studies, client results, or metrics.
Use the ScaleMatic Brain as the source of truth.
When uncertain, ask for missing context or create a safe draft with clear assumptions.
Avoid hype, generic AI fluff, spammy outreach, and overpromising.`;

function parseJsonOutput(raw: string): Record<string, unknown> {
  const jsonBlock = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlock) {
    try { return JSON.parse(jsonBlock[1]); } catch { /* fall through */ }
  }
  try { return JSON.parse(raw); } catch { /* fall through */ }
  // Try to find a JSON object anywhere in the response
  const jsonObj = raw.match(/\{[\s\S]*\}/);
  if (jsonObj) {
    try { return JSON.parse(jsonObj[0]); } catch { /* fall through */ }
  }
  return { raw_output: raw };
}

export function createTask(input: CreateTaskInput): Task {
  const db = getDb();
  const task: Task = {
    id: uuid(),
    type: input.type,
    input: input.input,
    assignedAgent: input.assignedAgent,
    status: 'pending',
    priority: input.priority ?? 5,
    workflowRunId: input.workflowRunId,
    workflowStep: input.workflowStep,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO tasks (id, type, input, assigned_agent, status, priority, workflow_run_id, workflow_step, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    task.id, task.type, JSON.stringify(task.input), task.assignedAgent,
    task.status, task.priority, task.workflowRunId ?? null,
    task.workflowStep ?? null, task.createdAt
  );

  return task;
}

export async function runTask(
  taskId: string,
  onProgress?: (chunk: string) => void
): Promise<Record<string, unknown>> {
  const db = getDb();

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined;
  if (!row) throw new Error(`Task not found: ${taskId}`);

  const task: Task = {
    id: row.id as string,
    type: row.type as string,
    input: JSON.parse(row.input as string),
    assignedAgent: row.assigned_agent as string,
    status: row.status as Task['status'],
    priority: row.priority as number,
    workflowRunId: row.workflow_run_id as string | undefined,
    workflowStep: row.workflow_step as number | undefined,
    createdAt: row.created_at as string,
  };

  const agent = getAgent(task.assignedAgent as AgentId);

  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('running', taskId);

  try {
    const inputSummary = Object.values(task.input).filter(Boolean).join(' ').slice(0, 500);
    const memoryContext = getContextForAgent(task.assignedAgent as AgentId, inputSummary);

    const systemPrompt = [
      MASTER_CONTEXT,
      '',
      '---',
      agent.systemPrompt,
      '---',
      '',
      memoryContext
        ? `SCALEMATIC BRAIN CONTEXT:\n${memoryContext}\n---`
        : '',
      '',
      `Return your response as valid JSON inside \`\`\`json ... \`\`\` code blocks.`,
      `Output format: ${agent.outputFormat}`,
    ].filter(Boolean).join('\n');

    const userMessage = `Task type: ${task.type}\n\nInput:\n${JSON.stringify(task.input, null, 2)}`;

    logger.info(`Running task ${taskId} with agent ${agent.name}`);

    let fullText = '';
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;

    const stream = claude.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        fullText += chunk.delta.text;
        onProgress?.(chunk.delta.text);
      }
      if (chunk.type === 'message_delta' && chunk.usage) {
        outputTokens = chunk.usage.output_tokens ?? null;
      }
      if (chunk.type === 'message_start' && chunk.message.usage) {
        inputTokens = chunk.message.usage.input_tokens ?? null;
      }
    }

    const output = parseJsonOutput(fullText);

    db.prepare(
      'UPDATE tasks SET status = ?, output = ?, completed_at = ?, input_tokens = ?, output_tokens = ? WHERE id = ?'
    ).run('completed', JSON.stringify(output), new Date().toISOString(), inputTokens, outputTokens, taskId);

    logger.info(`Task ${taskId} completed`, { input_tokens: inputTokens, output_tokens: outputTokens });
    return output;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    db.prepare('UPDATE tasks SET status = ?, error = ? WHERE id = ?').run('failed', error, taskId);
    logger.error(`Task ${taskId} failed`, { error });
    throw err;
  }
}

export async function runAgent(
  agentId: AgentId,
  taskType: string,
  input: Record<string, unknown>,
  options?: { workflowRunId?: string; workflowStep?: number; onProgress?: (chunk: string) => void }
): Promise<{ taskId: string; output: Record<string, unknown> }> {
  const task = createTask({
    type: taskType,
    input,
    assignedAgent: agentId,
    workflowRunId: options?.workflowRunId,
    workflowStep: options?.workflowStep,
  });

  const output = await runTask(task.id, options?.onProgress);
  return { taskId: task.id, output };
}
