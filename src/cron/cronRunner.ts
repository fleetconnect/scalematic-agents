import { v4 as uuid } from 'uuid';
import { loadCronState, saveCronState } from './cronState';
import { fetchNewData } from './dataFetcher';
import { classifyItems, enforceLimits } from './classifier';
import { runWorkflow } from '../orchestrator/workflowRunner';
import { runAgent } from '../orchestrator/agentRunner';
import { createApproval, getPendingApprovals } from '../approvals/approvalQueue';
import { getAgent } from '../agents';
import { ApprovalRequiredError } from '../utils/errors';
import { logger } from '../utils/logger';
import {
  ActionType,
  ClassifiedItem,
  CronActionResult,
  CronResult,
  CronState,
  FetchedData,
} from '../types/cron';

// ── Routing ───────────────────────────────────────────────────────

async function routeItem(item: ClassifiedItem): Promise<CronActionResult> {
  const base = { itemId: item.id, action: item.action, skipped: false };

  try {
    switch (item.action) {
      case 'NEEDS_RESEARCH':
        return await handleNewLead(item, base);

      case 'NEEDS_REPLY_DRAFT':
        return await handleReplyDraft(item, base);

      case 'NEEDS_FOLLOW_UP':
        return await handleFollowUp(item, base);

      case 'NEEDS_CALL_PREP':
        return await handleCallPrep(item, base);

      case 'NEEDS_POST_CALL_RECAP':
        return await handlePostCallRecap(item, base);

      case 'NEEDS_CRM_CLEANUP':
        return await handleCrmCleanup(item, base);

      default:
        return { ...base, skipped: true, skipReason: `No handler for action ${item.action}` };
    }
  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      return { ...base, approvalId: err.approvalId };
    }
    logger.error(`Cron: error processing item ${item.id}`, { error: String(err) });
    return { ...base, skipped: true, skipReason: String(err), error: String(err) };
  }
}

async function handleNewLead(
  item: ClassifiedItem,
  base: Pick<CronActionResult, 'itemId' | 'action' | 'skipped'>
): Promise<CronActionResult> {
  const d = item.data;
  const run = await runWorkflow('new-lead', {
    person_name: `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim(),
    company: (d.company ?? d.companyName ?? '') as string,
    role: (d.jobTitle ?? d.role ?? '') as string,
    email: (d.email ?? '') as string,
    lead_source: (d.source ?? '') as string,
    notes: (d.notes ?? '') as string,
    preferred_channel: 'linkedin',
    your_company: 'ScaleMatic',
  });
  return { ...base, workflowRunId: run.id };
}

async function handleReplyDraft(
  item: ClassifiedItem,
  base: Pick<CronActionResult, 'itemId' | 'action' | 'skipped'>
): Promise<CronActionResult> {
  const d = item.data;

  // CRM context first — no approval needed
  const { output: crmContext } = await runAgent('crm', 'pull_contact_context', {
    contact_id: (d.contactId ?? d.id) as string,
    conversation_id: d.id as string,
    last_message: (d.lastMessageBody ?? '') as string,
    unread_count: d.unreadCount as number,
  });

  // Messaging draft — approval required
  const { taskId, output: messagingOutput } = await runAgent('messaging', 'draft_reply', {
    crm_context: crmContext,
    last_message: (d.lastMessageBody ?? '') as string,
    channel: 'linkedin',
    your_company: 'ScaleMatic',
    max_variants: 2,
    max_words_per_message: 100,
  });

  const approval = createApproval(taskId, 'messaging', messagingOutput);

  // Governance review (internal, no approval)
  await runAgent('governance', 'pre_approval_review', {
    content_to_review: messagingOutput,
    agent_id: 'messaging',
    review_type: 'reply_draft',
  });

  return { ...base, approvalId: approval.id, agentOutput: messagingOutput };
}

async function handleFollowUp(
  item: ClassifiedItem,
  base: Pick<CronActionResult, 'itemId' | 'action' | 'skipped'>
): Promise<CronActionResult> {
  const d = item.data;

  const { taskId, output: messagingOutput } = await runAgent('messaging', 'draft_follow_up', {
    contact_id: (d.contactId ?? d.id) as string,
    last_message: (d.lastMessageBody ?? '') as string,
    days_since_reply: 3,
    channel: 'linkedin',
    your_company: 'ScaleMatic',
    max_variants: 2,
    max_words_per_message: 100,
  });

  const approval = createApproval(taskId, 'messaging', messagingOutput);

  await runAgent('governance', 'pre_approval_review', {
    content_to_review: messagingOutput,
    agent_id: 'messaging',
    review_type: 'follow_up',
  });

  return { ...base, approvalId: approval.id, agentOutput: messagingOutput };
}

async function handleCallPrep(
  item: ClassifiedItem,
  base: Pick<CronActionResult, 'itemId' | 'action' | 'skipped'>
): Promise<CronActionResult> {
  const d = item.data;
  const run = await runWorkflow('pre-call-brief', {
    contact_name: (d.title ?? d.contactId ?? '') as string,
    company: '',
    crm_contact_id: (d.contactId ?? '') as string,
    call_time: (d.startTime ?? '') as string,
    call_type: 'discovery',
    offer: 'AI-powered outbound sales automation',
  });
  return { ...base, workflowRunId: run.id };
}

async function handlePostCallRecap(
  item: ClassifiedItem,
  base: Pick<CronActionResult, 'itemId' | 'action' | 'skipped'>
): Promise<CronActionResult> {
  const d = item.data;
  const run = await runWorkflow('transcript-to-assets', {
    transcript: (d.content ?? '') as string,
    call_type: 'sales_call',
    context: `Source: ${d.title ?? 'uploaded transcript'}`,
    content_goals: ['linkedin_posts', 'newsletter_angles'],
  });
  return { ...base, workflowRunId: run.id };
}

async function handleCrmCleanup(
  item: ClassifiedItem,
  base: Pick<CronActionResult, 'itemId' | 'action' | 'skipped'>
): Promise<CronActionResult> {
  const d = item.data;
  const { output } = await runAgent('crm', 'update_contact_record', {
    contact_data: d,
    action: 'summarize_and_recommend',
    max_bullets: 5,
  });
  return { ...base, agentOutput: output };
}

// ── Stalled lead batch handler ────────────────────────────────────

async function handleStalledLeads(stalledItems: ClassifiedItem[]): Promise<CronActionResult[]> {
  if (stalledItems.length === 0) return [];

  const crmData = stalledItems.map((i) => i.data);
  try {
    const run = await runWorkflow('stalled-lead-revival', {
      days_stalled: 7,
      max_leads: stalledItems.length,
      crm_data: crmData,
      preferred_channel: 'linkedin',
      your_company: 'ScaleMatic',
    });
    return stalledItems.map((i) => ({
      itemId: i.id,
      action: i.action,
      skipped: false,
      workflowRunId: run.id,
    }));
  } catch (err) {
    if (err instanceof ApprovalRequiredError) {
      return stalledItems.map((i) => ({
        itemId: i.id,
        action: i.action,
        skipped: false,
        approvalId: err.approvalId,
      }));
    }
    logger.error('Cron: stalled lead batch failed', { error: String(err) });
    return stalledItems.map((i) => ({
      itemId: i.id,
      action: i.action,
      skipped: true,
      skipReason: String(err),
      error: String(err),
    }));
  }
}

// ── Summary builder ───────────────────────────────────────────────

function buildSummary(
  data: FetchedData,
  classified: ClassifiedItem[],
  results: CronActionResult[],
  skipped: ClassifiedItem[],
  runAt: string
): string {
  const actionedItems = results.filter((r) => !r.skipped);
  const approvalIds = results.flatMap((r) => (r.approvalId ? [r.approvalId] : []));
  const pendingCount = data.pendingApprovals.length;
  const humanAttention = classified.filter((i) => i.action === 'NEEDS_HUMAN_ATTENTION');

  const changed = classified.filter((i) => i.action !== 'NO_ACTION');
  const changedLines = changed.slice(0, 10).map((i) => `- ${i.reason}`).join('\n');

  const actionedLines = actionedItems.slice(0, 10).map((r) => {
    const item = classified.find((i) => i.id === r.itemId);
    const label = item?.reason ?? r.itemId;
    if (r.workflowRunId) return `- ${label} → workflow run ${r.workflowRunId}`;
    if (r.approvalId) return `- ${label} → approval pending (${r.approvalId})`;
    return `- ${label} → processed`;
  }).join('\n');

  const approvalLines = approvalIds.length > 0
    ? approvalIds.map((id) => `- Approval ID: ${id}`).join('\n')
    : '- None this run';

  const humanLines = humanAttention.length > 0
    ? humanAttention.map((i) => `- ${i.reason}`).join('\n')
    : '- None';

  const skippedLines = skipped.length > 0
    ? `- ${skipped.length} items skipped to stay within token/processing limits`
    : '- Nothing skipped';

  const allApprovals = data.pendingApprovals as Array<Record<string, unknown>>;
  const nextFocus = pendingCount > 0
    ? `Review ${pendingCount} pending approval${pendingCount === 1 ? '' : 's'} in /api/approvals`
    : actionedItems.length > 0
      ? 'Monitor workflow results and approve queued drafts'
      : 'No immediate action required — next cron will check for new activity';

  return [
    `## Daily Agent Summary`,
    `_Run at: ${runAt}_`,
    ``,
    `### What changed`,
    changedLines || '- Nothing new since last run',
    ``,
    `### Actions prepared`,
    actionedLines || '- No actions taken',
    ``,
    `### Needs approval`,
    approvalLines,
    ``,
    `### Needs human attention`,
    humanLines,
    ``,
    `### Skipped to save cost`,
    skippedLines,
    ``,
    `### Recommended next move`,
    `- ${nextFocus}`,
  ].join('\n');
}

// ── Main entry point ──────────────────────────────────────────────

export async function runDailyCron(): Promise<CronResult> {
  const runAt = new Date().toISOString();
  logger.info(`Cron run started at ${runAt}`);

  // 1. Load state
  const state = loadCronState();
  logger.info(`Last cron run: ${state.lastRunAt}`);

  // 2. Fetch data
  const data = await fetchNewData(state);

  // 3. Classify
  const allClassified = classifyItems(data, state);
  const { toProcess, skipped } = enforceLimits(allClassified);

  logger.info(
    `Classified: ${allClassified.length} items — ${toProcess.length} to process, ${skipped.length} skipped`
  );

  // 4. Separate stalled leads for batching
  const stalledItems = toProcess.filter((i) => i.action === 'NEEDS_STALLED_LEAD_REVIVAL');
  const otherItems = toProcess.filter((i) => i.action !== 'NEEDS_STALLED_LEAD_REVIVAL');

  // 5. Process individually (non-stalled)
  const results: CronActionResult[] = [];
  for (const item of otherItems) {
    const result = await routeItem(item);
    results.push(result);
  }

  // 6. Process stalled leads as a single batched workflow
  const stalledResults = await handleStalledLeads(stalledItems);
  results.push(...stalledResults);

  // 7. Build summary
  const summary = buildSummary(data, allClassified, results, skipped, runAt);
  logger.info('Cron run complete — summary generated');

  // 8. Compute approval IDs
  const approvalIds = results.flatMap((r) => (r.approvalId ? [r.approvalId] : []));

  // 9. Determine next run focus
  const pendingApprovalCount = getPendingApprovals().length;
  const nextRunFocus =
    pendingApprovalCount > 0
      ? `${pendingApprovalCount} approvals still pending`
      : skipped.length > 0
        ? `${skipped.length} items deferred from this run`
        : 'Routine scan';

  // 10. Save updated state
  const newState: CronState = {
    lastRunAt: runAt,
    processedContactIds: dedupe([
      ...state.processedContactIds,
      ...toProcess.filter((i) => i.type === 'contact').map((i) => i.id),
    ]),
    processedOpportunityIds: dedupe([
      ...state.processedOpportunityIds,
      ...toProcess.filter((i) => i.type === 'opportunity').map((i) => i.id),
    ]),
    processedConversationIds: dedupe([
      ...state.processedConversationIds,
      ...toProcess.filter((i) => i.type === 'conversation').map((i) => i.id),
    ]),
    processedCalendarEventIds: dedupe([
      ...state.processedCalendarEventIds,
      ...toProcess.filter((i) => i.type === 'calendar_event').map((i) => i.id),
    ]),
    processedTranscriptIds: dedupe([
      ...state.processedTranscriptIds,
      ...toProcess.filter((i) => i.type === 'transcript').map((i) => i.id),
    ]),
    pendingApprovalIds: getPendingApprovals().map((a) => a.id),
    previousDailySummary: summary,
    nextRunFocus,
    skippedItems: skipped.map((i) => `${i.type}:${i.id}`),
  };
  saveCronState(newState);

  return {
    runAt,
    itemsInspected: allClassified.length,
    itemsActedOn: results.filter((r) => !r.skipped).length,
    itemsSkipped: skipped.length,
    approvalIds,
    summary,
    needsHumanAttention: allClassified
      .filter((i) => i.action === 'NEEDS_HUMAN_ATTENTION')
      .map((i) => i.reason),
    nextRunFocus,
  };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
