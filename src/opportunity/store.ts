import { getDb } from '../db/client';
import { emitEvent } from './eventLog';
import {
  SignalObject,
  InterpretationObject,
  OpportunityObject,
  OutcomeObject,
  OpportunityStatus,
  ThesisStatus,
} from '../types/opportunity';

// ── Signals ─────────────────────────────────────────────────────────
export function saveSignal(signal: SignalObject, dedupKey?: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO signals
       (id, source, signal_type, entity_refs, raw_evidence, evidence_url,
        detected_at, freshness_halflife_days, confidence, first_party, score, metadata, dedup_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    signal.id,
    signal.source,
    signal.signalType,
    JSON.stringify(signal.entityRefs),
    signal.rawEvidence,
    signal.evidenceUrl ?? null,
    signal.detectedAt,
    signal.freshnessHalflifeDays,
    signal.confidence,
    signal.firstParty ? 1 : 0,
    signal.score ?? null,
    signal.metadata ? JSON.stringify(signal.metadata) : null,
    dedupKey ?? null,
    signal.createdAt
  );
}

export function signalExistsByDedupKey(dedupKey: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM signals WHERE dedup_key = ? LIMIT 1').get(dedupKey);
  return !!row;
}

function rowToSignal(r: Record<string, unknown>): SignalObject {
  return {
    id: r.id as string,
    source: r.source as SignalObject['source'],
    signalType: r.signal_type as SignalObject['signalType'],
    entityRefs: JSON.parse(r.entity_refs as string),
    rawEvidence: r.raw_evidence as string,
    evidenceUrl: (r.evidence_url as string | null) ?? undefined,
    detectedAt: r.detected_at as string,
    freshnessHalflifeDays: r.freshness_halflife_days as number,
    confidence: r.confidence as number,
    firstParty: !!(r.first_party as number),
    score: (r.score as number | null) ?? undefined,
    metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    createdAt: r.created_at as string,
  };
}

export function getSignal(id: string): SignalObject | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM signals WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToSignal(row) : null;
}

// ── Interpretations ─────────────────────────────────────────────────
export function saveInterpretation(interp: InterpretationObject): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO interpretations (id, signal_ids, entity_ref, data, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    interp.id,
    JSON.stringify(interp.signalIds),
    interp.entityRef,
    JSON.stringify(interp),
    interp.confidence,
    interp.createdAt
  );
}

export function getInterpretation(id: string): InterpretationObject | null {
  const db = getDb();
  const row = db.prepare('SELECT data FROM interpretations WHERE id = ?').get(id) as
    | { data: string }
    | undefined;
  return row ? (JSON.parse(row.data) as InterpretationObject) : null;
}

// ── Opportunities ───────────────────────────────────────────────────
// Older rows predate thesisStatus; normalize so the field is never undefined.
function normalizeOpportunity(opp: OpportunityObject): OpportunityObject {
  if (!opp.thesisStatus) opp.thesisStatus = 'untested';
  return opp;
}

export function saveOpportunity(opp: OpportunityObject): void {
  const db = getDb();
  const normalized = normalizeOpportunity(opp);
  db.prepare(
    `INSERT INTO opportunities
       (id, entity_ref, interpretation_ids, signal_ids, data, play, icp_fit, priority_score, status, thesis_status, prediction, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    normalized.id,
    normalized.entityRef,
    JSON.stringify(normalized.interpretationIds),
    JSON.stringify(normalized.signalIds),
    JSON.stringify(normalized),
    normalized.play,
    normalized.icpFit,
    normalized.priorityScore,
    normalized.status,
    normalized.thesisStatus,
    normalized.prediction ? JSON.stringify(normalized.prediction) : null,
    normalized.createdAt
  );
}

export function updateOpportunityStatus(id: string, status: OpportunityStatus): void {
  const db = getDb();
  const row = db.prepare('SELECT data FROM opportunities WHERE id = ?').get(id) as
    | { data: string }
    | undefined;
  if (!row) throw new Error(`Opportunity not found: ${id}`);
  const opp = JSON.parse(row.data) as OpportunityObject;
  opp.status = status;
  db.prepare('UPDATE opportunities SET status = ?, data = ? WHERE id = ?').run(
    status,
    JSON.stringify(opp),
    id
  );

  if (status === 'killed' || status === 'won') {
    emitEvent('opportunity.closed', id, {
      entityRef: opp.entityRef,
      parentIds: [...opp.interpretationIds, ...opp.signalIds],
      payload: { status },
    });
  }
}

export function updateThesisStatus(id: string, thesisStatus: ThesisStatus): OpportunityObject {
  const db = getDb();
  const row = db.prepare('SELECT data FROM opportunities WHERE id = ?').get(id) as
    | { data: string }
    | undefined;
  if (!row) throw new Error(`Opportunity not found: ${id}`);
  const opp = normalizeOpportunity(JSON.parse(row.data) as OpportunityObject);
  opp.thesisStatus = thesisStatus;
  db.prepare('UPDATE opportunities SET thesis_status = ?, data = ? WHERE id = ?').run(
    thesisStatus,
    JSON.stringify(opp),
    id
  );
  return opp;
}

export function getOpportunity(id: string): OpportunityObject | null {
  const db = getDb();
  const row = db.prepare('SELECT data FROM opportunities WHERE id = ?').get(id) as
    | { data: string }
    | undefined;
  return row ? normalizeOpportunity(JSON.parse(row.data) as OpportunityObject) : null;
}

export function listOpportunities(limit = 100): OpportunityObject[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT data FROM opportunities ORDER BY priority_score DESC LIMIT ?')
    .all(limit) as Array<{ data: string }>;
  return rows.map((r) => normalizeOpportunity(JSON.parse(r.data) as OpportunityObject));
}

// ── Outcomes ────────────────────────────────────────────────────────
export function saveOutcome(outcome: OutcomeObject): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO outcomes (id, opportunity_id, outcome_type, cause, thesis_confirmed, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    outcome.id,
    outcome.opportunityId,
    outcome.outcomeType,
    outcome.cause ?? null,
    outcome.thesisConfirmed === undefined ? null : outcome.thesisConfirmed ? 1 : 0,
    outcome.createdAt
  );
}
