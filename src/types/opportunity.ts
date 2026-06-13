// Object schemas for the Commercial Opportunity OS spine (L1 to L3).
// Every object carries parent IDs so lineage is a join, not an inference.

export type SignalSource =
  | 'fmcsa'
  | 'permits'
  | 'jobs'
  | 'community'
  | 'news'
  | 'reviews'
  | 'ucc';

export type SignalType =
  | 'expansion'
  | 'pain'
  | 'change'
  | 'risk'
  | 'intent'
  | 'vendor_failure';

export interface SignalObject {
  id: string;
  source: SignalSource;
  signalType: SignalType;
  entityRefs: string[]; // e.g. ["company:ACME-TRUCKING", "person:..."]
  rawEvidence: string;
  evidenceUrl?: string;
  detectedAt: string;
  freshnessHalflifeDays: number;
  confidence: number; // 0..1
  firstParty: boolean; // their own words / their own filing
  score?: number; // Signal Score 0..100 (set by scoring service)
  metadata?: Record<string, unknown>; // raw source fields, kept for the composer
  createdAt: string;
}

export type CommercialMode = 'growth' | 'defensive' | 'transitional' | 'distressed';
export type BuyingMotion = 'active_search' | 'problem_aware' | 'pre_aware' | 'post_failure';
export type TrustThreshold = 'low' | 'medium' | 'high';
export type EmotionalState = 'overwhelmed' | 'traction_inefficient' | 'curious' | 'burned';

export interface InterpretationObject {
  id: string;
  signalIds: string[]; // lineage: parent signals
  entityRef: string;
  likelyProblem: string;
  commercialMode: CommercialMode;
  urgency: { level: 'high' | 'med' | 'low'; driver: string; decayDate?: string };
  budgetInference: { exists: boolean; basis?: string };
  buyingMotion: BuyingMotion;
  trustThreshold: TrustThreshold;
  emotionalState: EmotionalState;
  confidence: number; // 0..1
  reasoningTrace: string;
  createdAt: string;
}

export type PlayId =
  | 'new_authority'
  | 'storm_stack'
  | 'orphan_capture'
  | 'rollup_defense';

export type ThesisStatus = 'untested' | 'confirmed' | 'partial' | 'refuted';

// ES-3 prediction record. Field names are intentionally snake_case to match the
// evaluation-set schema exactly — do not rename without updating the ES-3 spec.
export interface Prediction {
  prediction: 'HIGH' | 'MEDIUM' | 'LOW';
  predicted_thesis: string;
  confidence: number; // 0.0 .. 1.0
}

export interface OpportunityObject {
  id: string;
  entityRef: string;
  interpretationIds: string[]; // lineage: parent interpretations
  signalIds: string[]; // flattened lineage to root signals
  whyNow: string;
  whyUs: string;
  whyThisPerson: string;
  businessProblem: string;
  desiredOutcome: string;
  thesis: string; // must be falsifiable
  disqualifiersChecked: string[];
  icpFit: number; // 0..1 multiplicative gate
  priorityScore: number; // 0..100
  play: PlayId;
  status: OpportunityStatus;
  thesisStatus: ThesisStatus; // Phase 2: confirmation lifecycle, defaults to 'untested'
  prediction?: Prediction; // ES-3 prediction captured at mint time
  createdAt: string;
}

export type OpportunityStatus =
  | 'minted'
  | 'composing'
  | 'awaiting_approval'
  | 'in_conversation'
  | 'killed'
  | 'won';

export type OutcomeType =
  | 'reply'
  | 'stage_advance'
  | 'meeting'
  | 'close'
  | 'death';

export interface OutcomeObject {
  id: string;
  opportunityId: string;
  outcomeType: OutcomeType;
  cause?: string;
  thesisConfirmed?: boolean;
  createdAt: string;
}

// Append-only episodic event. Parent refs make the full lineage queryable.
export type EventType =
  | 'signal.detected'
  | 'interpretation.created'
  | 'opportunity.minted'
  | 'opportunity.killed'
  | 'message.composed'
  | 'message.submitted_for_approval'
  | 'message.drafted'
  | 'message.approved'
  | 'message.edited'
  | 'message.rejected'
  | 'message.sent'
  | 'reply.received'
  | 'conversation.started'
  | 'thesis_status.changed'
  | 'opportunity.closed'
  | 'outcome.recorded';

// ── Human verdict (Phase 3) ─────────────────────────────────────────
export type VerdictType = 'APPROVED' | 'EDITED' | 'REJECTED';

export interface VerdictRecord {
  id: string;
  approvalId: string;
  opportunityId?: string;
  verdict: VerdictType;
  reason?: string;
  beforeText?: string; // populated on EDITED
  afterText?: string; // populated on EDITED
  diff?: string; // populated on EDITED
  decidedBy: string;
  createdAt: string;
}

// ── Outbound send + reply capture (Phase 6) ─────────────────────────
export type SendStatus = 'sent' | 'replied' | 'bounced' | 'failed';

export interface SendRecord {
  id: string;
  approvalId: string;
  verdictId: string;
  opportunityId?: string;
  channel: 'email';
  toAddress: string;
  routedToTestInbox: boolean;
  provider: string;
  providerMessageId?: string;
  body: string;
  status: SendStatus;
  replyBody?: string;
  repliedAt?: string;
  createdAt: string;
}

// ── Learning layer (Phase 7) ────────────────────────────────────────
export interface EvaluationSetEntry {
  id: string;
  setName: string;
  opportunityId?: string;
  prediction?: 'HIGH' | 'MEDIUM' | 'LOW';
  predictedThesis?: string;
  confidence?: number;
  actualOutcome?: string;
  scored: boolean;
  createdAt: string;
}

export interface DecisionLog {
  id: string;
  subjectId: string;
  decisionType: string;
  decision: string;
  rationale?: string;
  rulesApplied: string[];
  provenance?: string;
  createdAt: string;
}

export interface OutcomeLabel {
  id: string;
  opportunityId: string;
  label: string;
  thesisStatus?: ThesisStatus;
  notes?: string;
  labeledBy: string;
  createdAt: string;
}

export interface OpportunityEvent {
  id: string;
  type: EventType;
  entityRef?: string;
  subjectId: string; // the object this event is about
  parentIds: string[]; // lineage pointers
  payload: Record<string, unknown>;
  createdAt: string;
}
