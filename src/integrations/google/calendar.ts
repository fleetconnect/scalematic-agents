import {
  GoogleProvider,
  RawCalendarEvent,
  googleConfigReason,
  googleCredsPresent,
  loadGoogleProvider,
} from './googleAuth';
import { runRead } from '../integrationAudit';
import { CalendarEventSummary, ReadResult } from '../../types/integrations';

// Google Calendar reader (read-only). No create/move/update/delete. Surfaces today's schedule,
// attendees, and free focus blocks. Source references link each event back to Calendar.

export function summarizeEvents(events: RawCalendarEvent[], freshness: string | null): CalendarEventSummary[] {
  return events
    .map((e) => ({
      eventId: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      attendees: e.attendees,
      location: e.location,
      source: { system: 'Google Calendar', id: e.id, detail: 'event', freshness },
    }))
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
}

// Pure: free gaps of at least `minMinutes` between events, within [dayStart, dayEnd].
export function findFocusBlocks(
  events: CalendarEventSummary[],
  dayStartIso: string,
  dayEndIso: string,
  minMinutes = 45
): Array<{ start: string; end: string; minutes: number }> {
  const timed = events
    .filter((e) => e.start && e.end)
    .map((e) => ({ start: e.start as string, end: e.end as string }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const blocks: Array<{ start: string; end: string; minutes: number }> = [];
  let cursor = dayStartIso;
  const pushIfBig = (start: string, end: string) => {
    const mins = Math.round((Date.parse(end) - Date.parse(start)) / 60000);
    if (mins >= minMinutes) blocks.push({ start, end, minutes: mins });
  };
  for (const e of timed) {
    if (e.start > cursor) pushIfBig(cursor, e.start);
    if (e.end > cursor) cursor = e.end;
  }
  if (cursor < dayEndIso) pushIfBig(cursor, dayEndIso);
  return blocks;
}

async function readRange(
  operation: string,
  timeMinIso: string,
  timeMaxIso: string,
  provider?: GoogleProvider
): Promise<ReadResult<CalendarEventSummary[]>> {
  return runRead('google-calendar', operation, [] as CalendarEventSummary[], async () => {
    if (!googleCredsPresent()) {
      return { state: 'not_configured', data: [], reason: googleConfigReason() };
    }
    const p = provider ?? (await loadGoogleProvider());
    const raw = await p.listEvents(timeMinIso, timeMaxIso);
    const freshness = new Date().toISOString();
    const events = summarizeEvents(raw, freshness);
    return {
      state: 'available',
      data: events,
      reason: `Read ${events.length} calendar event(s)`,
      freshness,
      sourceIds: events.map((e) => e.eventId),
    };
  });
}

export function readToday(provider?: GoogleProvider, now = new Date()): Promise<ReadResult<CalendarEventSummary[]>> {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return readRange('readToday', start.toISOString(), end.toISOString(), provider);
}

export function readUpcoming(
  days = 7,
  provider?: GoogleProvider,
  now = new Date()
): Promise<ReadResult<CalendarEventSummary[]>> {
  const end = new Date(now.getTime() + days * 86400000);
  return readRange('readUpcoming', now.toISOString(), end.toISOString(), provider);
}
