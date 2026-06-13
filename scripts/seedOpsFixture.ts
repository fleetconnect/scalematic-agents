import 'dotenv/config';
import { v4 as uuid } from 'uuid';
import { getDb } from '../src/db/client';
import { saveInterpretation, saveOpportunity, updateOpportunityStatus } from '../src/opportunity/store';
import { createApproval } from '../src/approvals/approvalQueue';
import { emitEvent } from '../src/opportunity/eventLog';
import { InterpretationObject, OpportunityObject } from '../src/types/opportunity';

// Ops Center demo seed. This produces ONE structurally-valid opportunity + approval so the
// Approval Command Center and the lineage/verdict/thesis flow can be exercised without the
// LLM pipeline (blocked: no Anthropic credits) and without the judgment source files. The
// opportunity/draft text below is FIXTURE demo content, not Judgment-OS rule values — it does
// not author any CR/JR/governance/tiebreak value. It reuses a real sentinel signal so the
// lineage chain is genuinely connected end to end. Run: npx ts-node scripts/seedOpsFixture.ts

function pickSignal(): { id: string; entityRef: string } {
  const db = getDb();
  const row = db
    .prepare('SELECT id, entity_refs FROM signals ORDER BY created_at DESC LIMIT 1')
    .get() as { id: string; entity_refs: string } | undefined;
  if (!row) {
    throw new Error('No signals in DB. Run POST /api/sentinels/fmcsa/run first, then re-run this seed.');
  }
  const refs = JSON.parse(row.entity_refs) as string[];
  return { id: row.id, entityRef: refs[0] ?? 'company:UNKNOWN' };
}

function main(): void {
  const signal = pickSignal();
  const now = new Date().toISOString();

  const interp: InterpretationObject = {
    id: uuid(),
    signalIds: [signal.id],
    entityRef: signal.entityRef,
    likelyProblem: '[FIXTURE] Newly authorized carrier has trucks but no freight pipeline.',
    commercialMode: 'growth',
    urgency: { level: 'high', driver: '[FIXTURE] authority granted within the last 30 days' },
    budgetInference: { exists: true, basis: '[FIXTURE] new authority implies capital deployed' },
    buyingMotion: 'problem_aware',
    trustThreshold: 'medium',
    emotionalState: 'overwhelmed',
    confidence: 0.6,
    reasoningTrace: '[FIXTURE] Demo interpretation seeded for the Ops Center; not LLM-generated.',
    createdAt: now,
  };
  saveInterpretation(interp);
  emitEvent('interpretation.created', interp.id, {
    entityRef: interp.entityRef,
    parentIds: [signal.id],
    payload: { fixture: true },
  });

  const opp: OpportunityObject = {
    id: uuid(),
    entityRef: signal.entityRef,
    interpretationIds: [interp.id],
    signalIds: [signal.id],
    whyNow: '[FIXTURE] Operating authority is fresh; the window to be first is open now.',
    whyUs: '[FIXTURE] We place new carriers into vetted freight lanes within 30 days.',
    whyThisPerson: '[FIXTURE] Owner-operator is the decision maker on a new MC.',
    businessProblem: '[FIXTURE] Idle trucks burn fixed cost while authority sits unused.',
    desiredOutcome: '[FIXTURE] Consistent loaded miles within the first month of authority.',
    thesis:
      '[FIXTURE] If we reach this carrier within 30 days of authority, it will reply because it has trucks and no freight.',
    disqualifiersChecked: ['[FIXTURE] power units >= 2', '[FIXTURE] not a broker-only authority'],
    icpFit: 0.8,
    priorityScore: 82,
    play: 'new_authority',
    status: 'minted',
    thesisStatus: 'untested',
    prediction: { prediction: 'HIGH', predicted_thesis: '[FIXTURE] will reply within 7 days', confidence: 0.6 },
    createdAt: now,
  };
  saveOpportunity(opp);
  emitEvent('opportunity.minted', opp.id, {
    entityRef: opp.entityRef,
    parentIds: [...opp.interpretationIds, ...opp.signalIds],
    payload: { fixture: true, priority_score: opp.priorityScore },
  });

  emitEvent('message.drafted', opp.id, {
    entityRef: opp.entityRef,
    parentIds: [opp.id, ...opp.interpretationIds, ...opp.signalIds],
    payload: { fixture: true, channel: 'email' },
  });

  const approval = createApproval('opportunity:' + opp.id, 'messaging', {
    message:
      '[FIXTURE DRAFT] Congrats on the new authority. Most carriers spend their first month chasing freight ' +
      'while the trucks sit. We place new MCs into vetted lanes within 30 days — open to a quick look at what ' +
      'we could line up for you this week?',
    subject: '[FIXTURE] Freight for your new authority',
    channel: 'email',
    entity_ref: opp.entityRef,
    opportunity_id: opp.id,
    interpretation_ids: opp.interpretationIds,
    signal_ids: opp.signalIds,
    governance: {
      status: 'approved',
      overall_score: 88,
      issues: [
        {
          type: 'aggressive_cta',
          severity: 'minor',
          excerpt: 'open to a quick look',
          reason: '[FIXTURE] CTA is soft but slightly assumptive; acceptable.',
        },
      ],
      revised_output: null,
      reasoning: '[FIXTURE] Demo governance output seeded for the Ops Center; not LLM-generated.',
      approved_for_channels: ['email'],
    },
  });

  emitEvent('message.submitted_for_approval', approval.id, {
    entityRef: opp.entityRef,
    parentIds: [opp.id, ...opp.interpretationIds, ...opp.signalIds],
    payload: { fixture: true, approval_id: approval.id, channel: 'email' },
  });

  updateOpportunityStatus(opp.id, 'awaiting_approval');

  process.stdout.write(
    `Seeded fixture opportunity ${opp.id} and approval ${approval.id} (signal ${signal.id}).\n`
  );
}

main();
