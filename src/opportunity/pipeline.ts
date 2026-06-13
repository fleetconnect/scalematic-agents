import { v4 as uuid } from 'uuid';
import { runAgent } from '../orchestrator/agentRunner';
import { runFmcsaSentinel } from '../sentinels/fmcsaSentinel';
import {
  saveInterpretation,
  saveOpportunity,
  getSignal,
  getInterpretation,
  getOpportunity,
} from './store';
import { emitEvent, eventsForSubject } from './eventLog';
import { scoreOpportunity } from './scoring';
import { saveEvaluationSetEntry } from './learning';
import {
  SignalObject,
  InterpretationObject,
  OpportunityObject,
  CommercialMode,
  BuyingMotion,
  TrustThreshold,
  EmotionalState,
  PlayId,
} from '../types/opportunity';
import { logger } from '../utils/logger';

// L2: Signal -> Interpretation. Lineage: interpretation.signalIds -> signal.
async function interpretSignal(signal: SignalObject): Promise<InterpretationObject> {
  const { output } = await runAgent('interpreter', 'interpret_signal', {
    entity_ref: signal.entityRefs[0],
    signal_type: signal.signalType,
    source: signal.source,
    evidence: signal.rawEvidence,
    detected_at: signal.detectedAt,
    metadata: signal.metadata,
  });

  const urgency = (output.urgency ?? {}) as Record<string, unknown>;
  const budget = (output.budget_inference ?? {}) as Record<string, unknown>;

  const interp: InterpretationObject = {
    id: uuid(),
    signalIds: [signal.id],
    entityRef: signal.entityRefs[0],
    likelyProblem: String(output.likely_problem ?? ''),
    commercialMode: (output.commercial_mode as CommercialMode) ?? 'growth',
    urgency: {
      level: (urgency.level as 'high' | 'med' | 'low') ?? 'med',
      driver: String(urgency.driver ?? ''),
      decayDate: (urgency.decay_date as string | undefined) ?? undefined,
    },
    budgetInference: {
      exists: Boolean(budget.exists),
      basis: (budget.basis as string | undefined) ?? undefined,
    },
    buyingMotion: (output.buying_motion as BuyingMotion) ?? 'pre_aware',
    trustThreshold: (output.trust_threshold as TrustThreshold) ?? 'medium',
    emotionalState: (output.emotional_state as EmotionalState) ?? 'curious',
    confidence: typeof output.confidence === 'number' ? output.confidence : 0.5,
    reasoningTrace: String(output.reasoning_trace ?? ''),
    createdAt: new Date().toISOString(),
  };

  saveInterpretation(interp);
  emitEvent('interpretation.created', interp.id, {
    entityRef: interp.entityRef,
    parentIds: [signal.id],
    payload: { commercial_mode: interp.commercialMode, confidence: interp.confidence },
  });
  return interp;
}

export interface SynthResult {
  minted: boolean;
  opportunity?: OpportunityObject;
  killReason?: string;
}

// L3: Interpretation -> Opportunity (or kill). Lineage carries interpretation + signal IDs.
async function synthesizeOpportunity(
  signal: SignalObject,
  interp: InterpretationObject
): Promise<SynthResult> {
  const { output } = await runAgent('opportunity_synthesizer', 'synthesize_opportunity', {
    entity_ref: interp.entityRef,
    interpretation: interp,
    signal_evidence: signal.rawEvidence,
    signal_score: signal.score,
  });

  if (output.mint === false) {
    const killReason = String(output.kill_reason ?? 'not qualified');
    emitEvent('opportunity.killed', interp.id, {
      entityRef: interp.entityRef,
      parentIds: [interp.id, signal.id],
      payload: { kill_reason: killReason },
    });
    return { minted: false, killReason };
  }

  const icpFit = typeof output.icp_fit === 'number' ? output.icp_fit : 0.5;
  const priorityScore = scoreOpportunity({
    icpFit,
    signalScore: signal.score ?? 0,
    interpretation: interp,
  });

  // ES-3 prediction is captured at creation from the synthesizer output (never recomputed
  // later). If the model did not emit a banded prediction, leave it undefined rather than
  // inventing one.
  const predBand = output.prediction;
  const prediction =
    predBand === 'HIGH' || predBand === 'MEDIUM' || predBand === 'LOW'
      ? {
          prediction: predBand as 'HIGH' | 'MEDIUM' | 'LOW',
          predicted_thesis: String(output.predicted_thesis ?? output.thesis ?? ''),
          confidence:
            typeof output.confidence === 'number' ? output.confidence : interp.confidence,
        }
      : undefined;

  const opp: OpportunityObject = {
    id: uuid(),
    entityRef: interp.entityRef,
    interpretationIds: [interp.id],
    signalIds: [signal.id],
    whyNow: String(output.why_now ?? ''),
    whyUs: String(output.why_us ?? ''),
    whyThisPerson: String(output.why_this_person ?? ''),
    businessProblem: String(output.business_problem ?? ''),
    desiredOutcome: String(output.desired_outcome ?? ''),
    thesis: String(output.thesis ?? ''),
    disqualifiersChecked: Array.isArray(output.disqualifiers_checked)
      ? (output.disqualifiers_checked as string[])
      : [],
    icpFit,
    priorityScore,
    play: (output.play as PlayId) ?? 'new_authority',
    status: 'minted',
    thesisStatus: 'untested',
    prediction,
    createdAt: new Date().toISOString(),
  };

  saveOpportunity(opp);

  if (prediction) {
    saveEvaluationSetEntry({
      setName: 'ES-3',
      opportunityId: opp.id,
      prediction: prediction.prediction,
      predictedThesis: prediction.predicted_thesis,
      confidence: prediction.confidence,
    });
  }
  emitEvent('opportunity.minted', opp.id, {
    entityRef: opp.entityRef,
    parentIds: [interp.id, signal.id],
    payload: { play: opp.play, priority_score: opp.priorityScore, thesis: opp.thesis },
  });
  return { minted: true, opportunity: opp };
}

export interface PipelineRunResult {
  signalsDetected: number;
  interpretationsCreated: number;
  opportunitiesMinted: number;
  opportunitiesKilled: number;
  opportunities: OpportunityObject[];
}

// The full MVP spine: FMCSA sentinel -> interpreter -> synthesizer, lineage logged at each hop.
export async function runFmcsaPipeline(
  options: { sinceIso?: string; maxSignals?: number } = {}
): Promise<PipelineRunResult> {
  const sentinel = await runFmcsaSentinel({ sinceIso: options.sinceIso });
  const signals = options.maxSignals
    ? sentinel.signals.slice(0, options.maxSignals)
    : sentinel.signals;

  const opportunities: OpportunityObject[] = [];
  let interpretationsCreated = 0;
  let killed = 0;

  for (const signal of signals) {
    try {
      const interp = await interpretSignal(signal);
      interpretationsCreated++;
      const result = await synthesizeOpportunity(signal, interp);
      if (result.minted && result.opportunity) {
        opportunities.push(result.opportunity);
      } else {
        killed++;
      }
    } catch (err) {
      logger.error(`Pipeline failed for signal ${signal.id}`, { error: String(err) });
    }
  }

  return {
    signalsDetected: sentinel.newSignals,
    interpretationsCreated,
    opportunitiesMinted: opportunities.length,
    opportunitiesKilled: killed,
    opportunities,
  };
}

export interface OpportunityLineage {
  opportunity: OpportunityObject;
  interpretations: InterpretationObject[];
  signals: SignalObject[];
  events: ReturnType<typeof eventsForSubject>;
}

// Full lineage for one opportunity — the MVP exit criterion is that this resolves
// signal -> interpretation -> opportunity for every minted opportunity.
export function getOpportunityLineage(opportunityId: string): OpportunityLineage | null {
  const opportunity = getOpportunity(opportunityId);
  if (!opportunity) return null;

  const interpretations = opportunity.interpretationIds
    .map(getInterpretation)
    .filter((i): i is InterpretationObject => i !== null);

  const signals = opportunity.signalIds
    .map(getSignal)
    .filter((s): s is SignalObject => s !== null);

  return {
    opportunity,
    interpretations,
    signals,
    events: eventsForSubject(opportunityId),
  };
}
