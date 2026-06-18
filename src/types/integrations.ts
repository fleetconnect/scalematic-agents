// Read-first integration contract. Every connector reports honest state and never exposes
// credentials. Phase 1 is READ only; DRAFT/APPROVE/EXECUTE are defined here but gated.

export type PermissionLevel = 'READ' | 'DRAFT' | 'APPROVE' | 'EXECUTE';

// Mirrors the capability honesty model used elsewhere in the system.
export type ConnectorState = 'available' | 'degraded' | 'blocked' | 'not_configured';

export type AuthState = 'authenticated' | 'expired' | 'unauthenticated' | 'not_configured';

export type ConnectorId =
  | 'google-sheets'
  | 'gmail'
  | 'google-calendar'
  | 'google-contacts'
  | 'instantly'
  | 'gohighlevel'
  | 'linkedin'
  | 'github';

export interface ConnectorDescriptor {
  id: ConnectorId;
  displayName: string;
  provider: string;
  capabilityState: ConnectorState;
  authState: AuthState;
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  permissionsGranted: PermissionLevel[];
  supportedOperations: string[];
  sourceOwnership: string;
  errorState: string | null;
  dataFreshness: string | null;
  rateLimitState: 'ok' | 'throttled' | 'unknown';
  reason: string;
}

// A material conclusion must carry a source reference (rule 15). Never invent ids.
export interface SourceRef {
  system: string;
  id?: string;
  detail?: string;
  freshness: string | null;
}

// A KPI metric. A blank cell is `present: false` with `value: null` — never coerced to zero.
export interface KpiMetric {
  key: string;
  label: string;
  value: number | null;
  present: boolean;
  source: SourceRef;
}

export interface KpiSnapshot {
  state: ConnectorState;
  metrics: KpiMetric[];
  capturedAt: string | null;
  source: SourceRef;
  reason: string;
}

export interface EmailThreadSummary {
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  lastMessageAt: string | null;
  unanswered: boolean;
  snippet: string;
  source: SourceRef;
}

export interface CalendarEventSummary {
  eventId: string;
  title: string;
  start: string | null;
  end: string | null;
  attendees: string[];
  location: string | null;
  source: SourceRef;
}

export interface ContactRecord {
  contactId: string;
  displayName: string;
  emails: string[];
  phones: string[];
  source: SourceRef;
}

export interface ContactMatch {
  query: string;
  matches: ContactRecord[];
  duplicates: ContactRecord[][];
}

// Result envelope for any read. Degrades gracefully: a connector that is not_configured or
// failing returns state + reason + empty data, never throws into the orchestrator.
export interface ReadResult<T> {
  connectorId: ConnectorId;
  state: ConnectorState;
  data: T;
  reason: string;
  freshness: string | null;
  fetchedAt: string;
  error?: string;
}

export interface BriefSourceHealth {
  connectorId: ConnectorId;
  state: ConnectorState;
  freshness: string | null;
  error: string | null;
}

export interface MorningRevenueBrief {
  generatedAt: string;
  primaryFocus: { outcome: string; rationale: string; sources: SourceRef[] };
  kpiBottleneck: { constraint: string; evidence: string; sources: SourceRef[] } | null;
  bestProspect: {
    person: string | null;
    company: string | null;
    why: string;
    lastInteraction: string | null;
    nextAction: string;
    confidence: 'low' | 'medium' | 'high';
    sources: SourceRef[];
  } | null;
  revenueAtRisk: {
    warmOpportunities: string[];
    openProposals: string[];
    overduePayments: string[];
    missingFollowUps: string[];
    sources: SourceRef[];
  };
  meetings: Array<{
    time: string | null;
    person: string | null;
    company: string | null;
    purpose: string;
    preCallBrief: string;
    desiredOutcome: string;
    sources: SourceRef[];
  }>;
  followUpsReady: Array<{ to: string; subject: string; draft: string; requiresApproval: true; sources: SourceRef[] }>;
  approvalsNeeded: string[];
  systemHealth: { sources: BriefSourceHealth[]; missingSources: ConnectorId[]; errors: string[] };
  endOfDayScoreboard: string[];
  inferenceNotes: string[];
}
