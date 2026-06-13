import { getDb } from '../db/client';
import { getRatifyPendingInUse, getJudgmentConfig } from '../config/judgmentConfig';
import { liveSendsEnabled } from '../integrations/instantly';

export interface WeeklyReview {
  windowDays: number;
  generatedAt: string;
  opportunities: {
    created: number;
    byThesisStatus: Record<string, number>;
  };
  verdicts: { approved: number; edited: number; rejected: number };
  sends: { sent: number; replied: number };
  thesisConfirmationRate: number | null; // confirmed / (confirmed + refuted + partial)
  predictionAccuracy: number | null; // scored eval-set entries with matching outcome
  ratifyPendingInUse: Array<{ id: string; sourceFile: string }>;
}

// Fixture rows carry no DB column; provenance lives only in the event log, where the honest
// seed stamps payload.fixture === true. The subject_id of every fixture event is the id of a
// fixture entity (interpretation, opportunity, or approval), so this set lets downstream tables
// be filtered by their owning id without a schema change.
function fixtureEntityIds(db: ReturnType<typeof getDb>): Set<string> {
  const rows = db
    .prepare('SELECT subject_id, payload FROM opportunity_events')
    .all() as Array<{ subject_id: string; payload: string }>;
  const set = new Set<string>();
  for (const r of rows) {
    const payload = JSON.parse(r.payload) as { fixture?: boolean };
    if (payload.fixture === true) set.add(r.subject_id);
  }
  return set;
}

export function buildWeeklyReview(windowDays = 7): WeeklyReview {
  const db = getDb();
  const sinceIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // The first real verdict must be verdict number one: the moment judgment loads or LIVE_SENDS
  // flips on, the system is operating for real and seed rows stop counting toward live metrics.
  // Before that boundary fixtures still count (acceptable only because the FIXTURE banner is up).
  const excludeFixtures = getJudgmentConfig().loaded || liveSendsEnabled();
  const fixtureIds = excludeFixtures ? fixtureEntityIds(db) : null;
  const isFixture = (id: string | null | undefined): boolean =>
    fixtureIds != null && id != null && fixtureIds.has(id);

  const oppRows = db
    .prepare('SELECT id, thesis_status FROM opportunities WHERE created_at >= ?')
    .all(sinceIso) as Array<{ id: string; thesis_status: string }>;
  const liveOpps = oppRows.filter((o) => !isFixture(o.id));
  const created = liveOpps.length;
  const byThesisStatus: Record<string, number> = {};
  for (const o of liveOpps) byThesisStatus[o.thesis_status] = (byThesisStatus[o.thesis_status] ?? 0) + 1;

  const verdictRows = db
    .prepare('SELECT verdict, approval_id, opportunity_id FROM verdicts WHERE created_at >= ?')
    .all(sinceIso) as Array<{ verdict: string; approval_id: string; opportunity_id: string | null }>;
  const liveVerdicts = verdictRows.filter((v) => !isFixture(v.approval_id) && !isFixture(v.opportunity_id));
  const vmap: Record<string, number> = {};
  for (const v of liveVerdicts) vmap[v.verdict] = (vmap[v.verdict] ?? 0) + 1;

  const sendRows = db
    .prepare('SELECT status, approval_id, opportunity_id FROM sends WHERE created_at >= ?')
    .all(sinceIso) as Array<{ status: string; approval_id: string; opportunity_id: string | null }>;
  const liveSendRows = sendRows.filter((s) => !isFixture(s.approval_id) && !isFixture(s.opportunity_id));
  const sent = liveSendRows.length;
  const replied = liveSendRows.filter((s) => s.status === 'replied').length;

  const confirmed = byThesisStatus['confirmed'] ?? 0;
  const partial = byThesisStatus['partial'] ?? 0;
  const refuted = byThesisStatus['refuted'] ?? 0;
  const resolved = confirmed + partial + refuted;
  const thesisConfirmationRate = resolved > 0 ? confirmed / resolved : null;

  const scoredRows = db
    .prepare('SELECT opportunity_id, prediction, actual_outcome FROM evaluation_sets WHERE scored = 1 AND created_at >= ?')
    .all(sinceIso) as Array<{ opportunity_id: string | null; prediction: string | null; actual_outcome: string | null }>;
  const scored = scoredRows.filter((s) => !isFixture(s.opportunity_id));
  let correct = 0;
  for (const s of scored) {
    if (s.prediction && s.actual_outcome && s.prediction.toUpperCase() === s.actual_outcome.toUpperCase()) {
      correct++;
    }
  }
  const predictionAccuracy = scored.length > 0 ? correct / scored.length : null;

  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    opportunities: { created, byThesisStatus },
    verdicts: {
      approved: vmap['APPROVED'] ?? 0,
      edited: vmap['EDITED'] ?? 0,
      rejected: vmap['REJECTED'] ?? 0,
    },
    sends: { sent, replied },
    thesisConfirmationRate,
    predictionAccuracy,
    ratifyPendingInUse: getRatifyPendingInUse().map((r) => ({ id: r.id, sourceFile: r.sourceFile })),
  };
}
