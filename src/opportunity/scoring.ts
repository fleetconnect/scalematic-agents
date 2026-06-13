import { SignalObject, InterpretationObject } from '../types/opportunity';

// Centralized, versioned scoring (architecture section 7). Agents call this;
// they never implement local math, or scores drift apart and stop being comparable.
export const SCORING_VERSION = 'v1';

// Signal-source precision priors (0..1). L7 updates these quarterly against realized yield.
const SOURCE_PRECISION: Record<SignalObject['source'], number> = {
  fmcsa: 0.85,
  ucc: 0.8,
  permits: 0.7,
  jobs: 0.7,
  reviews: 0.6,
  community: 0.65,
  news: 0.55,
};

const SIGNAL_WEIGHTS = {
  sourcePrecision: 0.3,
  specificity: 0.2,
  freshness: 0.2,
  corroboration: 0.15,
  firstParty: 0.15,
} as const;

function freshnessFactor(detectedAt: string, halflifeDays: number): number {
  const ageDays = (Date.now() - new Date(detectedAt).getTime()) / 86_400_000;
  return Math.pow(0.5, Math.max(0, ageDays) / Math.max(1, halflifeDays)); // 0..1
}

// Signal Score (0..100): S = w1*SourcePrecision + w2*Specificity + w3*Freshness
//   + w4*CorroborationCount + w5*FirstPartyBonus. First-party always outranks inference.
export function scoreSignal(
  signal: SignalObject,
  opts: { specificity?: number; corroborationCount?: number } = {}
): number {
  const sourcePrecision = SOURCE_PRECISION[signal.source] ?? 0.5;
  const specificity = clamp01(opts.specificity ?? signal.confidence);
  const freshness = freshnessFactor(signal.detectedAt, signal.freshnessHalflifeDays);
  const corroboration = clamp01((opts.corroborationCount ?? 1) / 3); // saturates at 3 sources
  const firstParty = signal.firstParty ? 1 : 0;

  const s =
    SIGNAL_WEIGHTS.sourcePrecision * sourcePrecision +
    SIGNAL_WEIGHTS.specificity * specificity +
    SIGNAL_WEIGHTS.freshness * freshness +
    SIGNAL_WEIGHTS.corroboration * corroboration +
    SIGNAL_WEIGHTS.firstParty * firstParty;

  return round(s * 100);
}

const OPP_WEIGHTS = {
  signalScore: 0.3,
  urgencyWindow: 0.25,
  budgetEvidence: 0.2,
  accessPath: 0.15,
  playYield: 0.1,
} as const;

const URGENCY_VALUE = { high: 1, med: 0.6, low: 0.3 } as const;

// Opportunity Priority (0..100):
//   P = ICP_fit * (0.30*SignalScore + 0.25*UrgencyWindow + 0.20*BudgetEvidence
//                  + 0.15*AccessPath + 0.10*PlayYieldHistory)
// ICP fit is a MULTIPLICATIVE gate (0..1), not an additive term — a perfect signal
// on a non-ICP account must score ~0.
export function scoreOpportunity(input: {
  icpFit: number; // 0..1
  signalScore: number; // 0..100
  interpretation: InterpretationObject;
  accessPath?: number; // 0..1, warm-path strength
  playYieldHistory?: number; // 0..1, learned by L7
}): number {
  const icpFit = clamp01(input.icpFit);
  const signalScore = clamp01(input.signalScore / 100);
  const urgency = URGENCY_VALUE[input.interpretation.urgency.level];
  const budget = input.interpretation.budgetInference.exists ? 1 : 0.2;
  const accessPath = clamp01(input.accessPath ?? 0.5);
  const playYield = clamp01(input.playYieldHistory ?? 0.5);

  const composite =
    OPP_WEIGHTS.signalScore * signalScore +
    OPP_WEIGHTS.urgencyWindow * urgency +
    OPP_WEIGHTS.budgetEvidence * budget +
    OPP_WEIGHTS.accessPath * accessPath +
    OPP_WEIGHTS.playYield * playYield;

  return round(icpFit * composite * 100);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
