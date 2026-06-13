import { ActionType, ClassifiedItem, CronState, FetchedData } from '../types/cron';

const STALE_DAYS = 7;
const FOLLOW_UP_DAYS = 3;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function hasMinimumContactInfo(contact: Record<string, unknown>): boolean {
  const name = ((contact.firstName ?? '') as string) + ((contact.lastName ?? '') as string);
  return name.trim().length > 0 && (
    Boolean(contact.email) ||
    Boolean(contact.phone) ||
    Boolean(contact.company) ||
    Boolean(contact.companyName)
  );
}

function classifyContact(contact: Record<string, unknown>, state: CronState): ActionType {
  const id = contact.id as string;
  const isNew = !state.processedContactIds.includes(id);

  if (isNew) {
    return hasMinimumContactInfo(contact) ? 'NEEDS_RESEARCH' : 'NEEDS_CRM_CLEANUP';
  }

  // Re-surfaced because of an update since last run
  return 'NEEDS_CRM_CLEANUP';
}

function classifyOpportunity(opportunity: Record<string, unknown>, state: CronState): ActionType {
  const id = opportunity.id as string;
  const isNew = !state.processedOpportunityIds.includes(id);
  const updatedAt = (opportunity.updatedAt ?? opportunity.dateUpdated) as string | undefined;
  const staleThreshold = daysAgo(STALE_DAYS);

  if (isNew) return 'NEEDS_RESEARCH';

  if (updatedAt && updatedAt < staleThreshold) return 'NEEDS_STALLED_LEAD_REVIVAL';
  if (updatedAt && updatedAt > state.lastRunAt) return 'NEEDS_CRM_CLEANUP';

  return 'NO_ACTION';
}

function classifyConversation(conversation: Record<string, unknown>, state: CronState): ActionType {
  const unread = (conversation.unreadCount as number | undefined) ?? 0;
  const lastDate = conversation.lastMessageDate as string | undefined;
  const followUpThreshold = daysAgo(FOLLOW_UP_DAYS);

  if (unread > 0) return 'NEEDS_REPLY_DRAFT';

  // Re-surfaced conversation: check if it went cold
  const id = conversation.id as string;
  if (state.processedConversationIds.includes(id) && lastDate && lastDate < followUpThreshold) {
    return 'NEEDS_FOLLOW_UP';
  }

  return 'NO_ACTION';
}

function classifyCalendarEvent(): ActionType {
  // Already filtered to 48-hour window and not processed — always needs prep
  return 'NEEDS_CALL_PREP';
}

function classifyTranscript(): ActionType {
  // Already filtered to new, unprocessed transcripts
  return 'NEEDS_POST_CALL_RECAP';
}

export function classifyItems(data: FetchedData, state: CronState): ClassifiedItem[] {
  const items: ClassifiedItem[] = [];

  for (const contact of data.contacts) {
    const action = classifyContact(contact, state);
    items.push({
      id: contact.id as string,
      type: 'contact',
      action,
      reason: buildReason(action, contact),
      data: contact,
    });
  }

  for (const opp of data.opportunities) {
    const action = classifyOpportunity(opp, state);
    if (action === 'NO_ACTION') continue;
    items.push({
      id: opp.id as string,
      type: 'opportunity',
      action,
      reason: buildReason(action, opp),
      data: opp,
    });
  }

  for (const conv of data.conversations) {
    const action = classifyConversation(conv, state);
    if (action === 'NO_ACTION') continue;
    items.push({
      id: conv.id as string,
      type: 'conversation',
      action,
      reason: buildReason(action, conv),
      data: conv,
    });
  }

  for (const event of data.calendarEvents) {
    items.push({
      id: event.id as string,
      type: 'calendar_event',
      action: classifyCalendarEvent(),
      reason: `Upcoming call: ${event.title ?? 'untitled'} at ${event.startTime}`,
      data: event,
    });
  }

  for (const transcript of data.transcripts) {
    items.push({
      id: transcript.id as string,
      type: 'transcript',
      action: classifyTranscript(),
      reason: `New transcript: ${transcript.title}`,
      data: transcript,
    });
  }

  return items;
}

export function enforceLimits(items: ClassifiedItem[]): { toProcess: ClassifiedItem[]; skipped: ClassifiedItem[] } {
  const counts: Partial<Record<string, number>> = {};
  const limits: Record<string, number> = {
    contact: 25,
    opportunity: 25,
    conversation: 10,
    calendar_event: 10,
    transcript: 5,
  };

  const toProcess: ClassifiedItem[] = [];
  const skipped: ClassifiedItem[] = [];

  for (const item of items) {
    if (item.action === 'NO_ACTION') {
      skipped.push(item);
      continue;
    }
    const count = counts[item.type] ?? 0;
    if (count >= (limits[item.type] ?? 999)) {
      skipped.push(item);
    } else {
      toProcess.push(item);
      counts[item.type] = count + 1;
    }
  }

  return { toProcess, skipped };
}

function buildReason(action: ActionType, data: Record<string, unknown>): string {
  const name =
    ((data.firstName ?? '') as string) + ' ' + ((data.lastName ?? '') as string) ||
    (data.name as string | undefined) ||
    (data.contactName as string | undefined) ||
    (data.id as string);

  const reasons: Record<ActionType, string> = {
    NO_ACTION: 'No changes detected',
    NEEDS_RESEARCH: `New record — research needed: ${name.trim()}`,
    NEEDS_REPLY_DRAFT: `Unread message from ${name.trim()}`,
    NEEDS_FOLLOW_UP: `No reply in ${FOLLOW_UP_DAYS}+ days: ${name.trim()}`,
    NEEDS_CALL_PREP: `Upcoming call with ${name.trim()}`,
    NEEDS_POST_CALL_RECAP: `New transcript to process: ${name.trim()}`,
    NEEDS_CRM_CLEANUP: `CRM update detected: ${name.trim()}`,
    NEEDS_STALLED_LEAD_REVIVAL: `No activity in ${STALE_DAYS}+ days: ${name.trim()}`,
    NEEDS_GOVERNANCE_REVIEW: `Pending governance review: ${name.trim()}`,
    NEEDS_HUMAN_ATTENTION: `Requires human decision: ${name.trim()}`,
  };

  return reasons[action];
}
