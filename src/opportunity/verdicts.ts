import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import { getApproval } from '../approvals/approvalQueue';
import { emitEvent } from './eventLog';
import { VerdictRecord, VerdictType } from '../types/opportunity';
import { logger } from '../utils/logger';

const VERDICT_EVENT: Record<VerdictType, 'message.approved' | 'message.edited' | 'message.rejected'> = {
  APPROVED: 'message.approved',
  EDITED: 'message.edited',
  REJECTED: 'message.rejected',
};

// A minimal line-level diff. EDITED verdicts are training data — keep before, after, diff.
function computeDiff(before: string, after: string): string {
  const a = before.split('\n');
  const b = after.split('\n');
  const max = Math.max(a.length, b.length);
  const lines: string[] = [];
  for (let i = 0; i < max; i++) {
    const left = a[i] ?? '';
    const right = b[i] ?? '';
    if (left === right) continue;
    if (left) lines.push(`- ${left}`);
    if (right) lines.push(`+ ${right}`);
  }
  return lines.join('\n');
}

export interface RecordVerdictInput {
  approvalId: string;
  verdict: VerdictType;
  reason?: string;
  decidedBy: string;
  opportunityId?: string;
  // EDITED only:
  afterText?: string;
}

// Records a human verdict on a governed draft and emits a lineage-bearing event.
// This is the ONLY place a verdict is minted; the Instantly adapter keys off it.
export function recordVerdict(input: RecordVerdictInput): VerdictRecord {
  const approval = getApproval(input.approvalId);
  if (!approval) throw new Error(`Approval not found: ${input.approvalId}`);

  const opportunityId =
    input.opportunityId ?? (approval.output.opportunity_id as string | undefined);
  const signalIds = (approval.output.signal_ids as string[] | undefined) ?? [];
  const interpretationIds = (approval.output.interpretation_ids as string[] | undefined) ?? [];

  let beforeText: string | undefined;
  let afterText: string | undefined;
  let diff: string | undefined;

  if (input.verdict === 'EDITED') {
    beforeText = (approval.output.message as string | undefined) ?? '';
    afterText = input.afterText ?? '';
    if (!input.afterText) throw new Error('EDITED verdict requires afterText');
    diff = computeDiff(beforeText, afterText);
  }

  const record: VerdictRecord = {
    id: uuid(),
    approvalId: input.approvalId,
    opportunityId,
    verdict: input.verdict,
    reason: input.reason,
    beforeText,
    afterText,
    diff,
    decidedBy: input.decidedBy,
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  db.prepare(
    `INSERT INTO verdicts
       (id, approval_id, opportunity_id, verdict, reason, before_text, after_text, diff, decided_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.approvalId,
    record.opportunityId ?? null,
    record.verdict,
    record.reason ?? null,
    record.beforeText ?? null,
    record.afterText ?? null,
    record.diff ?? null,
    record.decidedBy,
    record.createdAt
  );

  const parentIds = [opportunityId, ...interpretationIds, ...signalIds, input.approvalId].filter(
    (x): x is string => !!x
  );

  emitEvent(VERDICT_EVENT[input.verdict], record.id, {
    entityRef: approval.output.entity_ref as string | undefined,
    parentIds,
    payload: {
      approval_id: input.approvalId,
      opportunity_id: opportunityId,
      verdict: input.verdict,
      reason: input.reason,
      ...(diff ? { diff } : {}),
    },
  });

  logger.info(`Verdict ${input.verdict} recorded for approval ${input.approvalId}`);
  return record;
}

function rowToVerdict(r: Record<string, unknown>): VerdictRecord {
  return {
    id: r.id as string,
    approvalId: r.approval_id as string,
    opportunityId: (r.opportunity_id as string | null) ?? undefined,
    verdict: r.verdict as VerdictType,
    reason: (r.reason as string | null) ?? undefined,
    beforeText: (r.before_text as string | null) ?? undefined,
    afterText: (r.after_text as string | null) ?? undefined,
    diff: (r.diff as string | null) ?? undefined,
    decidedBy: r.decided_by as string,
    createdAt: r.created_at as string,
  };
}

export function getVerdictByApproval(approvalId: string): VerdictRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM verdicts WHERE approval_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(approvalId) as Record<string, unknown> | undefined;
  return row ? rowToVerdict(row) : null;
}

export function getVerdict(id: string): VerdictRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM verdicts WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToVerdict(row) : null;
}

export function listVerdicts(limit = 200): VerdictRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM verdicts ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToVerdict);
}
