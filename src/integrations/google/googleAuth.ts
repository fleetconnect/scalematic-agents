// Google auth gate + provider seam. Phase 1 uses READ-ONLY scopes only. Credentials live in env
// and are never exposed to the browser or logged. The real provider lazy-loads the googleapis
// package so the framework compiles and fixture-tests run without it installed; if creds or the
// package are missing, connectors report not_configured and degrade gracefully.

import { AuthState } from '../../types/integrations';

export class GoogleNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleNotConfiguredError';
  }
}

export const GOOGLE_READONLY_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
];

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function googleCredsPresent(): boolean {
  return Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET') && env('GOOGLE_REFRESH_TOKEN'));
}

export function kpiSheetId(): string | undefined {
  return env('GOOGLE_KPI_SHEET_ID');
}

export function googleAuthState(): AuthState {
  return googleCredsPresent() ? 'authenticated' : 'not_configured';
}

export function googleConfigReason(): string {
  if (!googleCredsPresent()) {
    return 'Google OAuth not configured (set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)';
  }
  return 'Google OAuth credentials present (read-only scopes)';
}

// Lightly-structured, read-only provider seam. The connectors layer business logic (parsing,
// dedup, freshness, unanswered detection) on top of these — so that logic is fully unit-testable
// with a fake provider, and only this thin live layer touches googleapis.
export interface RawGmailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string | null;
  snippet: string;
  fromMe: boolean;
}
export interface RawGmailThread {
  id: string;
  messages: RawGmailMessage[];
}
export interface RawCalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  attendees: string[];
  location: string | null;
}
export interface RawContact {
  id: string;
  displayName: string;
  emails: string[];
  phones: string[];
}

export interface GoogleProvider {
  getSheetValues(spreadsheetId: string, range: string): Promise<string[][]>;
  listThreads(query: string, maxResults: number): Promise<RawGmailThread[]>;
  listEvents(timeMinIso: string, timeMaxIso: string): Promise<RawCalendarEvent[]>;
  listContacts(query: string): Promise<RawContact[]>;
}

let cachedProvider: GoogleProvider | null = null;

// Build the real googleapis-backed provider. Lazy-imported so the package is only required at
// runtime when credentials exist. Read-only scopes only — no send/modify methods are exposed.
// The googleapis boundary is intentionally `any`: its types are not present at compile time, and
// this thin mapping layer is the only code not covered by fixture tests.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadGoogleProvider(): Promise<GoogleProvider> {
  if (!googleCredsPresent()) {
    throw new GoogleNotConfiguredError(googleConfigReason());
  }
  if (cachedProvider) return cachedProvider;
  let google: any;
  try {
    google = (await import('googleapis' as any)).google;
  } catch {
    throw new GoogleNotConfiguredError(
      'googleapis package is not installed; run "npm i googleapis" before live Google reads'
    );
  }
  const auth = new google.auth.OAuth2(env('GOOGLE_CLIENT_ID'), env('GOOGLE_CLIENT_SECRET'));
  auth.setCredentials({ refresh_token: env('GOOGLE_REFRESH_TOKEN') });
  cachedProvider = {
    async getSheetValues(spreadsheetId, range) {
      const sheets = google.sheets({ version: 'v4', auth });
      const r = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return (r.data.values ?? []) as string[][];
    },
    async listThreads(query, maxResults) {
      const gmail = google.gmail({ version: 'v1', auth });
      const list = await gmail.users.threads.list({ userId: 'me', q: query, maxResults });
      const out: RawGmailThread[] = [];
      for (const t of list.data.threads ?? []) {
        const full = await gmail.users.threads.get({ userId: 'me', id: t.id, format: 'metadata' });
        out.push(mapThread(t.id, full.data));
      }
      return out;
    },
    async listEvents(timeMinIso, timeMaxIso) {
      const cal = google.calendar({ version: 'v3', auth });
      const r = await cal.events.list({
        calendarId: 'primary',
        timeMin: timeMinIso,
        timeMax: timeMaxIso,
        singleEvents: true,
        orderBy: 'startTime',
      });
      return (r.data.items ?? []).map(mapEvent);
    },
    async listContacts(query) {
      const people = google.people({ version: 'v1', auth });
      const r = await people.people.searchContacts({
        query,
        readMask: 'names,emailAddresses,phoneNumbers',
      });
      return (r.data.results ?? []).map(mapContact);
    },
  };
  return cachedProvider;
}

function mapThread(id: string, data: unknown): RawGmailThread {
  const messages = ((data as { messages?: unknown[] }).messages ?? []).map((m) => {
    const headers = ((m as { payload?: { headers?: { name: string; value: string }[] } }).payload?.headers ?? []) as { name: string; value: string }[];
    const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n)?.value ?? '';
    const labels = ((m as { labelIds?: string[] }).labelIds ?? []) as string[];
    const internal = (m as { internalDate?: string }).internalDate;
    return {
      id: (m as { id: string }).id,
      from: h('from'),
      to: h('to') ? h('to').split(',').map((s) => s.trim()) : [],
      subject: h('subject'),
      date: internal ? new Date(Number(internal)).toISOString() : null,
      snippet: (m as { snippet?: string }).snippet ?? '',
      fromMe: labels.includes('SENT'),
    };
  });
  return { id, messages };
}

function mapEvent(item: unknown): RawCalendarEvent {
  const e = item as {
    id: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: { email?: string }[];
    location?: string;
  };
  return {
    id: e.id,
    title: e.summary ?? '(no title)',
    start: e.start?.dateTime ?? e.start?.date ?? null,
    end: e.end?.dateTime ?? e.end?.date ?? null,
    attendees: (e.attendees ?? []).map((a) => a.email ?? '').filter(Boolean),
    location: e.location ?? null,
  };
}

function mapContact(result: unknown): RawContact {
  const p = (result as { person?: unknown }).person as {
    resourceName?: string;
    names?: { displayName?: string }[];
    emailAddresses?: { value?: string }[];
    phoneNumbers?: { value?: string }[];
  };
  return {
    id: p.resourceName ?? '',
    displayName: p.names?.[0]?.displayName ?? '',
    emails: (p.emailAddresses ?? []).map((e) => e.value ?? '').filter(Boolean),
    phones: (p.phoneNumbers ?? []).map((n) => n.value ?? '').filter(Boolean),
  };
}
