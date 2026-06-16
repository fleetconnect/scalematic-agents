import { Router, Request, Response } from 'express';
import { getDb } from '../db/client';
import { listAgents } from '../agents';
import { runAgent } from '../orchestrator/agentRunner';
import { routeTask } from '../orchestrator/agentRouter';
import { runWorkflow, listWorkflows, getWorkflowRun } from '../orchestrator/workflowRunner';
import { getPendingApprovals, reviewApproval, getApproval } from '../approvals/approvalQueue';
import { upsertMemoryDocument, searchMemory } from '../memory/vectorStore';
import { executeGhlProposal, searchOpportunities, getRecentConversations } from '../integrations/goHighLevelSafe';
import { runDailyCron } from '../cron/cronRunner';
import { loadCronState } from '../cron/cronState';
import { runFmcsaSentinel } from '../sentinels/fmcsaSentinel';
import { runFmcsaPipeline, getOpportunityLineage } from '../opportunity/pipeline';
import { listOpportunities, updateThesisStatus, getOpportunity, getSignal } from '../opportunity/store';
import { listEvents, emitEvent } from '../opportunity/eventLog';
import { subscribeEvents } from '../opportunity/eventBus';
import { recordVerdict, listVerdicts, getVerdictByApproval } from '../opportunity/verdicts';
import { composeFromOpportunity } from '../opportunity/composer';
import { sendApprovedMessage, listSends, pollReplies, liveSendsEnabled, testInbox } from '../integrations/instantly';
import { buildWeeklyReview } from '../opportunity/weeklyReview';
import { getJudgmentConfig, getRatifyPendingInUse } from '../config/judgmentConfig';
import { ThesisStatus, VerdictType } from '../types/opportunity';
import { AgentId } from '../types/agent';
import { MemoryCategory } from '../types/memory';
import { ApprovalRequiredError } from '../utils/errors';
import { logger } from '../utils/logger';
import {
  getVaultStatus,
  listNotes,
  recentNotes,
  searchNotes,
  readNote,
  projectSummaries,
  goals,
  conversations,
  dailyNote,
  VaultUnavailableError,
} from '../vault/vaultAdapter';
import { VaultPathError } from '../vault/pathSafety';
import { FrontmatterError } from '../vault/frontmatter';
import { fileApprovedConversation } from '../vault/conversationFiling';
import { FileConversationInput } from '../types/conversationFiling';
import { getCapabilities } from '../capabilities/capabilityService';

export const router = Router();

// ── Agents ────────────────────────────────────────────────────────
router.get('/agents', (_req: Request, res: Response) => {
  res.json(listAgents());
});

router.post('/agents/:agentId/run', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { task_type, input } = req.body;
    const { taskId, output } = await runAgent(agentId as AgentId, task_type, input);
    res.json({ task_id: taskId, output });
  } catch (err) {
    logger.error('Agent run error', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

router.post('/route', async (req: Request, res: Response) => {
  try {
    const { description, input } = req.body;
    const agentId = routeTask(description);
    const { taskId, output } = await runAgent(agentId, description, input ?? {});
    res.json({ agent_id: agentId, task_id: taskId, output });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Tasks ─────────────────────────────────────────────────────────
router.get('/tasks', (_req: Request, res: Response) => {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100').all();
  res.json(tasks.map((t) => {
    const row = t as Record<string, unknown>;
    return { ...row, input: JSON.parse(row.input as string), output: row.output ? JSON.parse(row.output as string) : null };
  }));
});

router.get('/tasks/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, input: JSON.parse(row.input as string), output: row.output ? JSON.parse(row.output as string) : null });
});

// ── Workflows ─────────────────────────────────────────────────────
router.get('/workflows', (_req: Request, res: Response) => {
  res.json(listWorkflows().map((w) => ({
    id: w.id, name: w.name, description: w.description,
    trigger: w.trigger, steps: w.steps.map((s) => ({ stepIndex: s.stepIndex, agentId: s.agentId, description: s.description })),
  })));
});

router.post('/workflows/:workflowId/run', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { input } = req.body;
    const run = await runWorkflow(workflowId, input ?? {});
    res.json(run);
  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      return res.status(202).json({ status: 'awaiting_approval', approval_id: err.approvalId, message: err.message });
    }
    logger.error('Workflow error', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

router.get('/workflows/runs', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM workflow_runs ORDER BY created_at DESC LIMIT 50`
  ).all() as Record<string, unknown>[];
  res.json(rows.map((r) => ({
    ...r,
    input: JSON.parse(r.input as string),
    step_outputs: JSON.parse(r.step_outputs as string),
  })));
});

router.get('/workflows/runs/:runId', (req: Request, res: Response) => {
  const run = getWorkflowRun(req.params.runId);
  if (!run) return res.status(404).json({ error: 'Not found' });
  res.json(run);
});

// ── Approvals ─────────────────────────────────────────────────────
router.get('/approvals', (_req: Request, res: Response) => {
  res.json(getPendingApprovals());
});

router.get('/approvals/:id', (req: Request, res: Response) => {
  const approval = getApproval(req.params.id);
  if (!approval) return res.status(404).json({ error: 'Not found' });
  res.json(approval);
});

// Composite payload for the Approval Command Center: everything an operator needs to render
// one verdict in a single round trip — draft, the opportunity it came from, the governance
// gate, the source signals as evidence, and any verdict already recorded. Fields that do not
// exist in the underlying data are simply omitted; the UI must not invent them.
router.get('/approvals/:id/review-context', (req: Request, res: Response) => {
  const approval = getApproval(req.params.id);
  if (!approval) return res.status(404).json({ error: 'Not found' });

  const opportunityId = approval.output.opportunity_id as string | undefined;
  const opportunity = opportunityId ? getOpportunity(opportunityId) : null;
  const signalIds = (approval.output.signal_ids as string[] | undefined) ?? opportunity?.signalIds ?? [];
  const evidence = signalIds.map(getSignal).filter((s): s is NonNullable<typeof s> => !!s);
  const verdict = getVerdictByApproval(req.params.id) ?? null;

  res.json({
    approval,
    draft: {
      message: approval.output.message ?? null,
      subject: approval.output.subject ?? null,
      channel: approval.output.channel ?? null,
    },
    opportunity,
    governance: approval.output.governance ?? null,
    evidence,
    verdict,
  });
});

router.post('/approvals/:id/review', (req: Request, res: Response) => {
  try {
    const { status, reviewed_by, comments } = req.body;
    const approval = reviewApproval(req.params.id, status, reviewed_by ?? 'human', comments);
    res.json(approval);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Memory ────────────────────────────────────────────────────────
router.get('/memory/search', (req: Request, res: Response) => {
  const { q, category } = req.query;
  if (!q) return res.status(400).json({ error: 'q param required' });
  const results = searchMemory(q as string, 10, category as MemoryCategory | undefined);
  res.json(results);
});

router.post('/memory', (req: Request, res: Response) => {
  try {
    const { title, category, source, content } = req.body;
    const doc = upsertMemoryDocument(title, category, source, content);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/memory', (_req: Request, res: Response) => {
  const db = getDb();
  const docs = db.prepare('SELECT id, title, category, source, created_at FROM memory_documents ORDER BY created_at DESC').all();
  res.json(docs);
});

// ── Cron ──────────────────────────────────────────────────────────
router.post('/cron/run', async (_req: Request, res: Response) => {
  try {
    logger.info('Manual cron run triggered via API');
    const result = await runDailyCron();
    res.json(result);
  } catch (err) {
    logger.error('Cron run failed', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

router.get('/cron/state', (_req: Request, res: Response) => {
  res.json(loadCronState());
});

// ── GHL Pipeline Summary ─────────────────────────────────────────
router.get('/ghl/pipeline-summary', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const [opps, convs] = await Promise.all([
      searchOpportunities(''),
      getRecentConversations(50),
    ]);

    const byStage = opps.reduce<Record<string, number>>((acc, o) => {
      const stage = o.pipelineStageId ?? 'unknown';
      acc[stage] = (acc[stage] ?? 0) + 1;
      return acc;
    }, {});

    const unreadConvs = convs.filter((c) => (c.unreadCount ?? 0) > 0).length;

    const leadsReviewed = (db.prepare(
      `SELECT COUNT(*) as n FROM workflow_runs WHERE workflow_id = 'new-lead' AND status = 'completed'`
    ).get() as { n: number }).n;

    const repliesDrafted = (db.prepare(
      `SELECT COUNT(*) as n FROM approvals WHERE agent_id = 'messaging' AND status != 'pending'`
    ).get() as { n: number }).n;

    const callsPrepped = (db.prepare(
      `SELECT COUNT(*) as n FROM workflow_runs WHERE workflow_id = 'pre-call-brief' AND status = 'completed'`
    ).get() as { n: number }).n;

    res.json({
      total_opportunities: opps.length,
      by_stage: byStage,
      unread_conversations: unreadConvs,
      total_conversations: convs.length,
      leads_reviewed: leadsReviewed,
      replies_drafted: repliesDrafted,
      calls_prepped: callsPrepped,
    });
  } catch (err) {
    logger.error('GHL pipeline summary error', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// ── GHL Execute ───────────────────────────────────────────────────
router.post('/ghl/execute/:approvalId', async (req: Request, res: Response) => {
  try {
    const result = await executeGhlProposal(req.params.approvalId);
    res.json(result);
  } catch (err) {
    logger.error('GHL execute error', { error: String(err) });
    res.status(400).json({ error: String(err) });
  }
});

// ── Metrics ───────────────────────────────────────────────────────
router.get('/metrics/agent-performance', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      assigned_agent,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      AVG(CASE
        WHEN completed_at IS NOT NULL AND created_at IS NOT NULL
        THEN (julianday(completed_at) - julianday(created_at)) * 86400
        ELSE NULL
      END) as avg_duration_seconds
    FROM tasks
    GROUP BY assigned_agent
  `).all() as Array<{
    assigned_agent: string;
    total: number;
    completed: number;
    failed: number;
    pending: number;
    avg_duration_seconds: number | null;
  }>;
  res.json(rows);
});

router.get('/metrics/cost-usage', (_req: Request, res: Response) => {
  const db = getDb();
  const daily = db.prepare(`
    SELECT
      date(created_at) as day,
      SUM(COALESCE(input_tokens, 0)) as input_tokens,
      SUM(COALESCE(output_tokens, 0)) as output_tokens,
      COUNT(*) as task_count
    FROM tasks
    WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all() as Array<{ day: string; input_tokens: number; output_tokens: number; task_count: number }>;

  const byAgent = db.prepare(`
    SELECT
      assigned_agent,
      SUM(COALESCE(input_tokens, 0)) as input_tokens,
      SUM(COALESCE(output_tokens, 0)) as output_tokens,
      COUNT(*) as task_count
    FROM tasks
    WHERE created_at >= date('now', '-30 days')
    GROUP BY assigned_agent
    ORDER BY (input_tokens + output_tokens) DESC
  `).all() as Array<{ assigned_agent: string; input_tokens: number; output_tokens: number; task_count: number }>;

  const totals = db.prepare(`
    SELECT
      SUM(COALESCE(input_tokens, 0)) as total_input,
      SUM(COALESCE(output_tokens, 0)) as total_output,
      COUNT(*) as total_tasks
    FROM tasks
    WHERE created_at >= date('now', '-30 days')
  `).get() as { total_input: number; total_output: number; total_tasks: number };

  res.json({ daily, by_agent: byAgent, totals });
});

router.get('/metrics/workflow-performance', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      workflow_id,
      COUNT(*) as total_runs,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      AVG(CASE
        WHEN completed_at IS NOT NULL AND created_at IS NOT NULL
        THEN (julianday(completed_at) - julianday(created_at)) * 86400
        ELSE NULL
      END) as avg_duration_seconds
    FROM workflow_runs
    GROUP BY workflow_id
  `).all() as Array<{
    workflow_id: string;
    total_runs: number;
    completed: number;
    failed: number;
    avg_duration_seconds: number | null;
  }>;
  res.json(rows);
});

// ── Opportunity OS — Sentinels ────────────────────────────────────
router.post('/sentinels/fmcsa/run', async (req: Request, res: Response) => {
  try {
    const { since_iso } = req.body ?? {};
    const result = await runFmcsaSentinel({ sinceIso: since_iso });
    res.json(result);
  } catch (err) {
    logger.error('FMCSA sentinel error', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// ── Opportunity OS — Pipeline (sentinel -> interpreter -> synthesizer) ──
router.post('/opportunity-pipeline/fmcsa/run', async (req: Request, res: Response) => {
  try {
    const { since_iso, max_signals } = req.body ?? {};
    const result = await runFmcsaPipeline({ sinceIso: since_iso, maxSignals: max_signals });
    res.json(result);
  } catch (err) {
    logger.error('FMCSA pipeline error', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// ── Opportunity OS — Opportunities ────────────────────────────────
router.get('/opportunities', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  res.json(listOpportunities(limit));
});

router.get('/opportunities/:id/lineage', (req: Request, res: Response) => {
  const lineage = getOpportunityLineage(req.params.id);
  if (!lineage) return res.status(404).json({ error: 'Not found' });
  res.json(lineage);
});

// ── Opportunity OS — Thesis status (Phase 2) ──────────────────────
const VALID_THESIS: ThesisStatus[] = ['untested', 'confirmed', 'partial', 'refuted'];
router.patch('/opportunities/:id/thesis-status', (req: Request, res: Response) => {
  try {
    const { status, evidence } = req.body ?? {};
    if (!VALID_THESIS.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_THESIS.join(', ')}` });
    }
    const opp = updateThesisStatus(req.params.id, status as ThesisStatus);
    emitEvent('thesis_status.changed', opp.id, {
      entityRef: opp.entityRef,
      parentIds: [...opp.interpretationIds, ...opp.signalIds],
      payload: { thesis_status: status, evidence: evidence ?? null },
    });
    res.json(opp);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── Opportunity OS — Composer to Approval (Phase 4) ───────────────
router.post('/opportunities/:id/compose', async (req: Request, res: Response) => {
  try {
    const { channel } = req.body ?? {};
    const result = await composeFromOpportunity(req.params.id, { channel });
    res.json(result);
  } catch (err) {
    logger.error('Compose error', { error: String(err) });
    res.status(400).json({ error: String(err) });
  }
});

// ── Opportunity OS — Human verdict (Phase 3) ──────────────────────
const VALID_VERDICTS: VerdictType[] = ['APPROVED', 'EDITED', 'REJECTED'];
router.post('/approvals/:id/verdict', (req: Request, res: Response) => {
  try {
    const { verdict, reason, decided_by, after_text } = req.body ?? {};
    if (!VALID_VERDICTS.includes(verdict)) {
      return res.status(400).json({ error: `verdict must be one of ${VALID_VERDICTS.join(', ')}` });
    }
    const record = recordVerdict({
      approvalId: req.params.id,
      verdict: verdict as VerdictType,
      reason,
      decidedBy: decided_by ?? 'human',
      afterText: after_text,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

router.get('/verdicts', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
  res.json(listVerdicts(limit));
});

// ── Opportunity OS — Send (Phase 6, APPROVED/EDITED verdict only) ──
router.post('/approvals/:id/send', async (req: Request, res: Response) => {
  try {
    const { lead_address, subject, channel } = req.body ?? {};
    if (!lead_address || !subject) {
      return res.status(400).json({ error: 'lead_address and subject are required' });
    }
    const verdict = getVerdictByApproval(req.params.id);
    if (!verdict) {
      return res.status(409).json({ error: 'No verdict recorded for this approval — cannot send' });
    }
    const send = await sendApprovedMessage({
      verdictId: verdict.id,
      leadAddress: lead_address,
      subject,
      channel,
    });
    res.status(201).json(send);
  } catch (err) {
    logger.error('Send error', { error: String(err) });
    res.status(400).json({ error: String(err) });
  }
});

router.get('/sends', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
  res.json(listSends(limit));
});

router.post('/replies/poll', async (_req: Request, res: Response) => {
  try {
    const result = await pollReplies();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ── Opportunity OS — Weekly review (Phase 8) ──────────────────────
router.get('/weekly-review', (req: Request, res: Response) => {
  const windowDays = req.query.window_days ? parseInt(req.query.window_days as string, 10) : 7;
  res.json(buildWeeklyReview(windowDays));
});

// ── Opportunity OS — Event log ────────────────────────────────────
router.get('/events', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  res.json(listEvents(limit));
});

// ── Opportunity OS — Live event stream (SSE, not WebSockets) ───────
// One long-lived connection per operator. The client renders this feed reverse-chron;
// on connect we replay the most recent events so a fresh tab is not blank, then stream
// new ones live. A heartbeat comment every 25s keeps proxies from killing the socket.
router.get('/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const backfill = req.query.backfill ? parseInt(req.query.backfill as string, 10) : 25;
  const recent = listEvents(backfill).reverse();
  for (const event of recent) {
    res.write(`event: replay\ndata: ${JSON.stringify(event)}\n\n`);
  }
  res.write(`event: ready\ndata: ${JSON.stringify({ replayed: recent.length })}\n\n`);

  const unsubscribe = subscribeEvents((event) => {
    res.write(`event: append\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ── System status (read-only operational state for the Ops Center header) ──
// Surfaces real runtime flags so the console can show idle-as-idle and the LIVE_SENDS
// posture without ever letting the UI mutate it. Flipping LIVE_SENDS stays a .env action.
router.get('/system/status', (_req: Request, res: Response) => {
  const judgment = getJudgmentConfig();
  res.json({
    liveSends: liveSendsEnabled(),
    testInboxCount: testInbox().length,
    instantlyConfigured: !!process.env.INSTANTLY_API_KEY,
    judgment: {
      loaded: judgment.loaded,
      rules: judgment.rules.length,
      presentFiles: judgment.presentFiles.length,
      missingFiles: judgment.missingFiles,
    },
    ratifyPendingInUse: getRatifyPendingInUse().map((r) => ({ id: r.id, sourceFile: r.sourceFile })),
    timestamp: new Date().toISOString(),
  });
});

// ── Capabilities (read-only honesty layer) ────────────────────────
// Reports every relevant service's real state (available/degraded/blocked/not_configured/
// fixture_only/archived) derived from configuration and verified runtime state. Read-only.
router.get('/capabilities', (_req: Request, res: Response) => {
  try {
    res.json(getCapabilities());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Vault (Plane B — durable knowledge, READ-ONLY) ────────────────
// Every route below only reads. The adapter never writes, renames, moves, merges, or
// deletes, and never returns absolute filesystem paths. Errors map to honest status codes:
// VaultUnavailableError -> 503, VaultPathError/FrontmatterError -> 400.
function sendVaultError(res: Response, err: unknown): void {
  if (err instanceof VaultUnavailableError) {
    res.status(503).json({ error: String(err) });
    return;
  }
  if (err instanceof VaultPathError || err instanceof FrontmatterError) {
    res.status(400).json({ error: String(err) });
    return;
  }
  res.status(500).json({ error: String(err) });
}

router.get('/vault/status', (_req: Request, res: Response) => {
  try {
    res.json(getVaultStatus());
  } catch (err) {
    sendVaultError(res, err);
  }
});

router.get('/vault/search', (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const folder = typeof req.query.folder === 'string' ? req.query.folder : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    res.json(searchNotes(q, folder, limit ?? 50));
  } catch (err) {
    sendVaultError(res, err);
  }
});

router.get('/vault/recent', (req: Request, res: Response) => {
  try {
    const folder = typeof req.query.folder === 'string' ? req.query.folder : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    res.json(recentNotes(limit, folder));
  } catch (err) {
    sendVaultError(res, err);
  }
});

router.get('/vault/notes', (req: Request, res: Response) => {
  try {
    const folder = typeof req.query.folder === 'string' ? req.query.folder : undefined;
    res.json(listNotes(folder));
  } catch (err) {
    sendVaultError(res, err);
  }
});

router.get('/vault/projects', (_req: Request, res: Response) => {
  try {
    res.json(projectSummaries());
  } catch (err) {
    sendVaultError(res, err);
  }
});

router.get('/vault/goals', (_req: Request, res: Response) => {
  try {
    res.json(goals());
  } catch (err) {
    sendVaultError(res, err);
  }
});

router.get('/vault/conversations', (_req: Request, res: Response) => {
  try {
    res.json(conversations());
  } catch (err) {
    sendVaultError(res, err);
  }
});

router.get('/vault/daily', (req: Request, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    res.json(dailyNote(date));
  } catch (err) {
    sendVaultError(res, err);
  }
});

router.get('/vault/note', (req: Request, res: Response) => {
  try {
    const pathParam = typeof req.query.path === 'string' ? req.query.path : '';
    if (!pathParam) {
      res.status(400).json({ error: 'Missing required query parameter: path' });
      return;
    }
    res.json(readNote(pathParam));
  } catch (err) {
    sendVaultError(res, err);
  }
});

// The only Plane-B (vault) write surface. Governed, approval-gated, idempotent, non-destructive.
// Writes only into 06 Conversations. Returns a result envelope (created | already_exists |
// needs_review | rejected | failed) — handled outcomes are 200; only malformed bodies are 400.
router.post('/vault/conversations/file', (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }
    const result = fileApprovedConversation(body as FileConversationInput);
    res.json(result);
  } catch (err) {
    logger.error(`fileApprovedConversation failed: ${(err as Error).message}`);
    res.status(500).json({ error: 'Internal error filing conversation' });
  }
});

// ── Health ────────────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
