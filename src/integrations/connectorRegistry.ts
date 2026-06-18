import { ConnectorDescriptor, ConnectorId, ConnectorState, PermissionLevel } from '../types/integrations';
import { getSyncState } from './integrationAudit';
import { googleAuthState, googleCredsPresent, kpiSheetId } from './google/googleAuth';

// Honest descriptor for every connector — never exposes secrets. Capability state is derived from
// real configuration + last sync, not from the mere existence of code. Phase 1 connectors are
// READ (Gmail also DRAFT for reply drafts). Phase 2/3 connectors are listed but not yet wired.

function envSet(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim());
}

function googleState(extraOk = true): { state: ConnectorState; reason: string } {
  if (!googleCredsPresent()) {
    return { state: 'not_configured', reason: 'Google OAuth not configured (read-only scopes pending)' };
  }
  if (!extraOk) return { state: 'not_configured', reason: 'GOOGLE_KPI_SHEET_ID is not set' };
  return { state: 'degraded', reason: 'Credentials present; live read not verified this session' };
}

interface Spec {
  id: ConnectorId;
  displayName: string;
  provider: string;
  sourceOwnership: string;
  supportedOperations: string[];
  permissionsGranted: PermissionLevel[];
  resolve: () => { state: ConnectorState; reason: string };
}

const SPECS: Spec[] = [
  {
    id: 'google-sheets',
    displayName: 'Google Sheets (KPIs)',
    provider: 'Google',
    sourceOwnership: 'KPI source of truth',
    supportedOperations: ['readKpiSnapshot'],
    permissionsGranted: ['READ'],
    resolve: () => googleState(Boolean(kpiSheetId())),
  },
  {
    id: 'gmail',
    displayName: 'Gmail',
    provider: 'Google',
    sourceOwnership: 'Email communication',
    supportedOperations: ['searchThreads', 'readUnanswered', 'draftReply'],
    permissionsGranted: ['READ', 'DRAFT'],
    resolve: () => googleState(),
  },
  {
    id: 'google-calendar',
    displayName: 'Google Calendar',
    provider: 'Google',
    sourceOwnership: 'Schedule and meetings',
    supportedOperations: ['readToday', 'readUpcoming', 'findFocusBlocks'],
    permissionsGranted: ['READ'],
    resolve: () => googleState(),
  },
  {
    id: 'google-contacts',
    displayName: 'Google Contacts',
    provider: 'Google',
    sourceOwnership: 'Contact identity',
    supportedOperations: ['searchContacts', 'lookupByEmail', 'dedupeContacts'],
    permissionsGranted: ['READ'],
    resolve: () => googleState(),
  },
  {
    id: 'instantly',
    displayName: 'Instantly',
    provider: 'Instantly',
    sourceOwnership: 'Outbound campaigns',
    supportedOperations: ['campaigns', 'replies', 'sendingHealth'],
    permissionsGranted: ['READ'],
    resolve: () =>
      envSet('INSTANTLY_API_KEY')
        ? { state: 'degraded', reason: 'Configured; Phase 2 read wiring pending approval' }
        : { state: 'not_configured', reason: 'INSTANTLY_API_KEY not set (Phase 2)' },
  },
  {
    id: 'gohighlevel',
    displayName: 'GoHighLevel',
    provider: 'GoHighLevel',
    sourceOwnership: 'CRM, opportunities, tasks, SMS, appointments',
    supportedOperations: ['searchContact', 'getRecentConversations', 'searchOpportunities', 'getCalendarEvents'],
    permissionsGranted: ['READ', 'DRAFT', 'APPROVE', 'EXECUTE'],
    resolve: () =>
      envSet('GHL_API_KEY')
        ? { state: 'available', reason: 'Configured (existing approved connector; reads safe, writes approval-gated)' }
        : { state: 'not_configured', reason: 'GHL_API_KEY not set' },
  },
  {
    id: 'linkedin',
    displayName: 'LinkedIn (approved intake)',
    provider: 'Unipile / approved intake',
    sourceOwnership: 'Relationship and conversation intake',
    supportedOperations: ['pastedIntake', 'export', 'conversationDesk'],
    permissionsGranted: ['READ'],
    resolve: () =>
      envSet('UNIPILE_API_KEY')
        ? { state: 'degraded', reason: 'Connector present; Phase 3 approved-intake only' }
        : { state: 'not_configured', reason: 'Phase 3 (approved intake only)' },
  },
  {
    id: 'github',
    displayName: 'GitHub',
    provider: 'GitHub',
    sourceOwnership: 'Source control and deployment state',
    supportedOperations: ['repos', 'commits', 'pullRequests', 'actions'],
    permissionsGranted: ['READ'],
    resolve: () =>
      envSet('GITHUB_TOKEN')
        ? { state: 'degraded', reason: 'Configured; Phase 3 read wiring pending' }
        : { state: 'not_configured', reason: 'GITHUB_TOKEN not set (Phase 3)' },
  },
];

export function describeConnector(spec: Spec): ConnectorDescriptor {
  const { state, reason } = spec.resolve();
  const sync = getSyncState(spec.id);
  const authState =
    spec.provider === 'Google'
      ? googleAuthState()
      : state === 'not_configured'
        ? 'not_configured'
        : 'authenticated';
  return {
    id: spec.id,
    displayName: spec.displayName,
    provider: spec.provider,
    capabilityState: state,
    authState,
    lastSuccessfulSync: sync?.lastSuccessfulSync ?? null,
    lastAttemptedSync: sync?.lastAttemptedSync ?? null,
    permissionsGranted: spec.permissionsGranted,
    supportedOperations: spec.supportedOperations,
    sourceOwnership: spec.sourceOwnership,
    errorState: sync?.lastError ?? null,
    dataFreshness: sync?.lastFreshness ?? null,
    rateLimitState: 'unknown',
    reason,
  };
}

export function describeConnectors(): ConnectorDescriptor[] {
  return SPECS.map(describeConnector);
}

export function describeConnectorById(id: ConnectorId): ConnectorDescriptor | null {
  const spec = SPECS.find((s) => s.id === id);
  return spec ? describeConnector(spec) : null;
}
