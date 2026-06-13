import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import { EvaluationSetEntry, DecisionLog, OutcomeLabel, ThesisStatus } from '../types/opportunity';

// ── Evaluation Sets (ES-3 columns: prediction / predicted_thesis / confidence) ──
export function saveEvaluationSetEntry(
  entry: Omit<EvaluationSetEntry, 'id' | 'createdAt' | 'scored'> & { scored?: boolean }
): EvaluationSetEntry {
  const record: EvaluationSetEntry = {
    id: uuid(),
    setName: entry.setName,
    opportunityId: entry.opportunityId,
    prediction: entry.prediction,
    predictedThesis: entry.predictedThesis,
    confidence: entry.confidence,
    actualOutcome: entry.actualOutcome,
    scored: entry.scored ?? false,
    createdAt: new Date().toISOString(),
  };
  getDb()
    .prepare(
      `INSERT INTO evaluation_sets
         (id, set_name, opportunity_id, prediction, predicted_thesis, confidence, actual_outcome, scored, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.id,
      record.setName,
      record.opportunityId ?? null,
      record.prediction ?? null,
      record.predictedThesis ?? null,
      record.confidence ?? null,
      record.actualOutcome ?? null,
      record.scored ? 1 : 0,
      record.createdAt
    );
  return record;
}

// ── Decision Logs ───────────────────────────────────────────────────
export function saveDecisionLog(
  entry: Omit<DecisionLog, 'id' | 'createdAt'>
): DecisionLog {
  const record: DecisionLog = { id: uuid(), createdAt: new Date().toISOString(), ...entry };
  getDb()
    .prepare(
      `INSERT INTO decision_logs
         (id, subject_id, decision_type, decision, rationale, rules_applied, provenance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.id,
      record.subjectId,
      record.decisionType,
      record.decision,
      record.rationale ?? null,
      JSON.stringify(record.rulesApplied),
      record.provenance ?? null,
      record.createdAt
    );
  return record;
}

// ── Outcome Labels ──────────────────────────────────────────────────
export function saveOutcomeLabel(
  entry: Omit<OutcomeLabel, 'id' | 'createdAt'>
): OutcomeLabel {
  const record: OutcomeLabel = { id: uuid(), createdAt: new Date().toISOString(), ...entry };
  getDb()
    .prepare(
      `INSERT INTO outcome_labels
         (id, opportunity_id, label, thesis_status, notes, labeled_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.id,
      record.opportunityId,
      record.label,
      record.thesisStatus ?? null,
      record.notes ?? null,
      record.labeledBy,
      record.createdAt
    );
  return record;
}

export function listEvaluationSetEntries(limit = 500): EvaluationSetEntry[] {
  const rows = getDb()
    .prepare('SELECT * FROM evaluation_sets ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    setName: r.set_name as string,
    opportunityId: (r.opportunity_id as string | null) ?? undefined,
    prediction: (r.prediction as EvaluationSetEntry['prediction']) ?? undefined,
    predictedThesis: (r.predicted_thesis as string | null) ?? undefined,
    confidence: (r.confidence as number | null) ?? undefined,
    actualOutcome: (r.actual_outcome as string | null) ?? undefined,
    scored: !!(r.scored as number),
    createdAt: r.created_at as string,
  }));
}

export function listOutcomeLabels(limit = 500): OutcomeLabel[] {
  const rows = getDb()
    .prepare('SELECT * FROM outcome_labels ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    opportunityId: r.opportunity_id as string,
    label: r.label as string,
    thesisStatus: (r.thesis_status as ThesisStatus | null) ?? undefined,
    notes: (r.notes as string | null) ?? undefined,
    labeledBy: r.labeled_by as string,
    createdAt: r.created_at as string,
  }));
}
