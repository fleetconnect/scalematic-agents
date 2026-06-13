import { getDb } from '../db/client';
import {
  getRecentConversations,
  getCalendarEvents,
  searchOpportunities,
} from '../integrations/goHighLevelSafe';
import { getContacts } from '../integrations/goHighLevel';
import { getPendingApprovals } from '../approvals/approvalQueue';
import { CronState, FetchedData } from '../types/cron';
import { logger } from '../utils/logger';

const CONTACT_LIMIT = 25;
const CONVERSATION_LIMIT = 10;
const OPPORTUNITY_LIMIT = 25;
const STALE_DAYS = 7;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function hoursFromNow(n: number): string {
  return new Date(Date.now() + n * 3_600_000).toISOString();
}

function isAfter(ts: string | undefined, cutoff: string): boolean {
  if (!ts) return false;
  return ts > cutoff;
}

export async function fetchNewData(state: CronState): Promise<FetchedData> {
  logger.info(`Cron data fetch: pulling records since ${state.lastRunAt}`);

  const [rawContacts, rawOpportunities, rawConversations] = await Promise.all([
    fetchContacts(state),
    fetchOpportunities(state),
    fetchConversations(state),
  ]);

  const calendarEvents = await fetchCalendarEvents(state);
  const transcripts = fetchTranscripts(state);
  const pendingApprovals = getPendingApprovals().map((a) => a as unknown as Record<string, unknown>);

  logger.info(
    `Fetched: ${rawContacts.length} contacts, ${rawOpportunities.length} opportunities, ` +
    `${rawConversations.length} conversations, ${calendarEvents.length} calendar events, ` +
    `${transcripts.length} transcripts, ${pendingApprovals.length} pending approvals`
  );

  return {
    contacts: rawContacts,
    opportunities: rawOpportunities,
    conversations: rawConversations,
    calendarEvents,
    transcripts,
    pendingApprovals,
  };
}

async function fetchContacts(state: CronState): Promise<Record<string, unknown>[]> {
  try {
    const all = await getContacts(CONTACT_LIMIT) as Record<string, unknown>[];
    return all.filter((c) => {
      const id = c.id as string;
      if (state.processedContactIds.includes(id)) {
        // Already processed — only re-surface if updated since last run
        const updated = (c.dateUpdated ?? c.updatedAt) as string | undefined;
        return isAfter(updated, state.lastRunAt);
      }
      return true;
    });
  } catch (err) {
    logger.error('Cron: failed to fetch contacts', { error: String(err) });
    return [];
  }
}

async function fetchOpportunities(state: CronState): Promise<Record<string, unknown>[]> {
  try {
    const all = (await searchOpportunities('')) as unknown as Record<string, unknown>[];
    const staleThreshold = daysAgo(STALE_DAYS);

    return all.slice(0, OPPORTUNITY_LIMIT).filter((o) => {
      const id = o.id as string;
      const status = (o.status as string | undefined)?.toLowerCase() ?? '';
      if (status === 'won' || status === 'lost') return false;

      if (state.processedOpportunityIds.includes(id)) {
        const updated = (o.updatedAt ?? o.dateUpdated) as string | undefined;
        const isStale = updated ? updated < staleThreshold : false;
        const changedSinceLastRun = isAfter(updated, state.lastRunAt);
        return isStale || changedSinceLastRun;
      }
      return true;
    });
  } catch (err) {
    logger.error('Cron: failed to fetch opportunities', { error: String(err) });
    return [];
  }
}

async function fetchConversations(state: CronState): Promise<Record<string, unknown>[]> {
  try {
    const all = (await getRecentConversations(CONVERSATION_LIMIT)) as unknown as Record<string, unknown>[];
    return all.filter((c) => {
      const id = c.id as string;
      const unread = (c.unreadCount as number | undefined) ?? 0;
      const lastDate = c.lastMessageDate as string | undefined;

      if (state.processedConversationIds.includes(id)) {
        return unread > 0 || isAfter(lastDate, state.lastRunAt);
      }
      return unread > 0;
    });
  } catch (err) {
    logger.error('Cron: failed to fetch conversations', { error: String(err) });
    return [];
  }
}

async function fetchCalendarEvents(state: CronState): Promise<Record<string, unknown>[]> {
  try {
    const now = new Date().toISOString();
    const cutoff = hoursFromNow(48);
    const all = (await getCalendarEvents(now, cutoff)) as unknown as Record<string, unknown>[];
    return all.filter((e) => {
      const id = e.id as string;
      return !state.processedCalendarEventIds.includes(id);
    });
  } catch (err) {
    logger.error('Cron: failed to fetch calendar events', { error: String(err) });
    return [];
  }
}

function fetchTranscripts(state: CronState): Record<string, unknown>[] {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, title, content, created_at
         FROM memory_documents
         WHERE category = 'transcripts-and-call-notes'
           AND created_at > ?
         ORDER BY created_at DESC
         LIMIT 5`
      )
      .all(state.lastRunAt) as Record<string, unknown>[];

    return rows.filter((r) => !state.processedTranscriptIds.includes(r.id as string));
  } catch (err) {
    logger.error('Cron: failed to fetch transcripts', { error: String(err) });
    return [];
  }
}
