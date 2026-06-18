import {
  BriefSourceHealth,
  CalendarEventSummary,
  ConnectorDescriptor,
  ConnectorId,
  EmailThreadSummary,
  KpiSnapshot,
  MorningRevenueBrief,
  ReadResult,
  SourceRef,
} from '../types/integrations';
import { readKpiSnapshot } from './google/sheets';
import { readUnanswered, draftReply } from './google/gmail';
import { readToday } from './google/calendar';
import { describeConnectors } from './connectorRegistry';
import { recentNotes } from '../vault/vaultAdapter';

// Morning Revenue Brief. Assembled deterministically from whatever sources are available — one
// unavailable connector never blocks the brief. Every material conclusion carries a source ref;
// facts and inferences are separated; missing data is reported as missing, never treated as zero.

export interface BriefInputs {
  now: string;
  kpi: ReadResult<KpiSnapshot>;
  unanswered: ReadResult<EmailThreadSummary[]>;
  meetings: ReadResult<CalendarEventSummary[]>;
  connectors: ConnectorDescriptor[];
  obsidian: { recentNotes: string[]; state: 'available' | 'degraded'; source: SourceRef };
}

const PHASE1: ConnectorId[] = ['google-sheets', 'gmail', 'google-calendar', 'google-contacts'];

function metric(snap: KpiSnapshot, key: string): number | null {
  const m = snap.metrics.find((x) => x.key === key);
  return m && m.present ? m.value : null;
}

function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

function companyFromEmail(email: string): string | null {
  const at = email.split('@')[1];
  if (!at) return null;
  const host = at.replace(/>$/, '').split('.')[0];
  const generic = ['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'proton'];
  return host && !generic.includes(host.toLowerCase()) ? host : null;
}

// Compute the funnel bottleneck from present KPI ratios only. Returns null when data is insufficient.
function computeBottleneck(kpi: ReadResult<KpiSnapshot>): MorningRevenueBrief['kpiBottleneck'] {
  if (kpi.state !== 'available') return null;
  const s = kpi.data;
  const stages: Array<{ name: string; value: number }> = [];
  const add = (name: string, r: number | null) => {
    if (r !== null) stages.push({ name, value: r });
  };
  add('reply rate (leads → replies)', ratio(metric(s, 'replies'), metric(s, 'leads_contacted')));
  add('positive-reply rate (replies → positive)', ratio(metric(s, 'positive_replies'), metric(s, 'replies')));
  add('booking rate (positive → calls booked)', ratio(metric(s, 'calls_booked'), metric(s, 'positive_replies')));
  add('show rate (booked → showed)', ratio(metric(s, 'calls_showed'), metric(s, 'calls_booked')));
  add('offer rate (showed → offers)', ratio(metric(s, 'offers_made'), metric(s, 'calls_showed')));
  add('close rate (offers → won)', ratio(metric(s, 'deals_won'), metric(s, 'offers_made')));
  if (stages.length === 0) {
    return {
      constraint: 'Not determined',
      evidence: 'KPI sheet read but the funnel metrics needed to compute conversion ratios are blank (not treated as zero).',
      sources: [s.source],
    };
  }
  const worst = stages.reduce((a, b) => (b.value < a.value ? b : a));
  return {
    constraint: worst.name,
    evidence: `Lowest present conversion ratio is ${(worst.value * 100).toFixed(1)}% (${worst.name}). Computed only from non-blank cells.`,
    sources: [s.source],
  };
}

export function buildMorningBrief(input: BriefInputs): MorningRevenueBrief {
  const inferenceNotes: string[] = [];
  const sourcesHealth: BriefSourceHealth[] = input.connectors
    .filter((c) => PHASE1.includes(c.id))
    .map((c) => ({ connectorId: c.id, state: c.capabilityState, freshness: c.dataFreshness, error: c.errorState }));
  sourcesHealth.push({
    connectorId: 'gmail',
    state: input.obsidian.state,
    freshness: input.obsidian.source.freshness,
    error: null,
  });
  const missingSources = input.connectors
    .filter((c) => PHASE1.includes(c.id) && c.capabilityState === 'not_configured')
    .map((c) => c.id);
  const errors = [input.kpi, input.unanswered, input.meetings]
    .filter((r) => r.error)
    .map((r) => `${r.connectorId}: ${r.error}`);

  const unanswered = input.unanswered.state === 'available' ? input.unanswered.data : [];
  const warmThreads = unanswered.filter((t) => t.unanswered);

  const meetings = (input.meetings.state === 'available' ? input.meetings.data : []).map((e) => {
    const attendeeCompany = e.attendees.map(companyFromEmail).find(Boolean) ?? null;
    return {
      time: e.start,
      person: e.attendees[0] ?? null,
      company: attendeeCompany,
      purpose: e.title,
      preCallBrief: `Attendees: ${e.attendees.join(', ') || 'unlisted'}. ${attendeeCompany ? `Likely company: ${attendeeCompany} (inferred from email domain).` : 'Company not inferable.'} Phase 1 brief is calendar-only; CRM enrichment is deferred to Phase 2.`,
      desiredOutcome: 'Confirm next step and owner before the call ends.',
      sources: [e.source] as SourceRef[],
    };
  });

  const followUpsReady = warmThreads.slice(0, 5).map((t) => {
    const d = draftReply(t, `Thanks for the note on "${t.subject}" — sharing a quick reply. [DRAFT pending your review]`);
    return {
      to: d.to,
      subject: d.subject,
      draft: d.draft,
      requiresApproval: true as const,
      sources: [t.source] as SourceRef[],
    };
  });

  const bottleneck = computeBottleneck(input.kpi);

  const bestProspect: MorningRevenueBrief['bestProspect'] = warmThreads[0]
    ? {
        person: warmThreads[0].from || null,
        company: companyFromEmail(warmThreads[0].from),
        why: 'Most recent unanswered inbound — an active, awaiting-reply thread (Gmail-only signal in Phase 1).',
        lastInteraction: warmThreads[0].lastMessageAt,
        nextAction: 'Review and approve the drafted reply.',
        confidence: 'low',
        sources: [warmThreads[0].source],
      }
    : null;

  if (input.kpi.state !== 'available') inferenceNotes.push('KPI source unavailable — no revenue or funnel figures asserted.');
  if (input.unanswered.state !== 'available') inferenceNotes.push('Gmail unavailable — follow-ups and best-prospect signal omitted, not guessed.');
  inferenceNotes.push('Company names inferred from email domains are inferences, not confirmed records.');
  inferenceNotes.push('GoHighLevel and Instantly are Phase 2 (pending approval) — open proposals, overdue payments, and pipeline are intentionally not asserted yet.');

  const primaryOutcome =
    warmThreads.length > 0
      ? `Clear the ${warmThreads.length} unanswered inbound thread(s) with approved replies.`
      : bottleneck && bottleneck.constraint !== 'Not determined'
        ? `Attack the funnel constraint: ${bottleneck.constraint}.`
        : 'Re-establish data flow (connect KPI sheet and Gmail) so the brief can prioritize.';

  const approvalsNeeded: string[] = [];
  if (followUpsReady.length) approvalsNeeded.push(`Send ${followUpsReady.length} drafted Gmail repl${followUpsReady.length === 1 ? 'y' : 'ies'} (requires approval).`);
  if (missingSources.length) approvalsNeeded.push(`Connect Google OAuth for: ${missingSources.join(', ')}.`);
  approvalsNeeded.push('Approve Phase 2 (Instantly, GoHighLevel) before pipeline/proposal data enters the brief.');

  return {
    generatedAt: input.now,
    primaryFocus: {
      outcome: primaryOutcome,
      rationale: warmThreads.length
        ? 'Unanswered inbound is the highest-leverage, lowest-latency revenue action available from connected sources.'
        : 'With limited connected sources, restoring data flow is the prerequisite to prioritization.',
      sources: warmThreads[0] ? [warmThreads[0].source] : input.kpi.state === 'available' ? [input.kpi.data.source] : [],
    },
    kpiBottleneck: bottleneck,
    bestProspect,
    revenueAtRisk: {
      warmOpportunities: warmThreads.map((t) => `${t.from} — "${t.subject}"`),
      openProposals: ['Pending Phase 2 (GoHighLevel) — not asserted'],
      overduePayments: ['Pending Phase 2 (GoHighLevel) — not asserted'],
      missingFollowUps: warmThreads.map((t) => `Unanswered: "${t.subject}" (last ${t.lastMessageAt ?? 'unknown'})`),
      sources: warmThreads.map((t) => t.source),
    },
    meetings,
    followUpsReady,
    approvalsNeeded,
    systemHealth: { sources: sourcesHealth, missingSources, errors },
    endOfDayScoreboard: [
      `Replied to ${followUpsReady.length} of ${warmThreads.length} unanswered thread(s).`,
      `Held ${meetings.length} meeting(s) with a logged next step each.`,
      bottleneck && bottleneck.constraint !== 'Not determined'
        ? `Moved one metric on: ${bottleneck.constraint}.`
        : 'Connected at least one missing Phase 1 source.',
    ],
    inferenceNotes,
  };
}

// Orchestrator: fetch each Phase 1 source with graceful degradation, then assemble. Never throws
// from a single connector failure.
export async function runMorningRevenueBrief(now = new Date()): Promise<MorningRevenueBrief> {
  const [kpi, unanswered, meetings] = await Promise.all([readKpiSnapshot(), readUnanswered(25), readToday(undefined, now)]);
  let obsidianNotes: string[] = [];
  let obsidianState: 'available' | 'degraded' = 'available';
  try {
    obsidianNotes = recentNotes(5).map((n) => n.title);
  } catch {
    obsidianState = 'degraded';
  }
  return buildMorningBrief({
    now: now.toISOString(),
    kpi,
    unanswered,
    meetings,
    connectors: describeConnectors(),
    obsidian: {
      recentNotes: obsidianNotes,
      state: obsidianState,
      source: { system: 'Obsidian', detail: 'recent notes', freshness: new Date().toISOString() },
    },
  });
}
