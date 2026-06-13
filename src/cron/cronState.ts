import { getDb } from '../db/client';
import { CronState } from '../types/cron';

const SENTINEL = new Date(0).toISOString();

const DEFAULT_STATE: CronState = {
  lastRunAt: SENTINEL,
  processedContactIds: [],
  processedOpportunityIds: [],
  processedConversationIds: [],
  processedCalendarEventIds: [],
  processedTranscriptIds: [],
  pendingApprovalIds: [],
  previousDailySummary: '',
  nextRunFocus: '',
  skippedItems: [],
};

export function loadCronState(): CronState {
  const db = getDb();
  const row = db.prepare('SELECT * FROM cron_state WHERE id = ?').get('current') as Record<string, unknown> | undefined;
  if (!row) return { ...DEFAULT_STATE };

  return {
    lastRunAt: row.last_run_at as string,
    processedContactIds: JSON.parse(row.processed_contact_ids as string),
    processedOpportunityIds: JSON.parse(row.processed_opportunity_ids as string),
    processedConversationIds: JSON.parse(row.processed_conversation_ids as string),
    processedCalendarEventIds: JSON.parse(row.processed_calendar_event_ids as string),
    processedTranscriptIds: JSON.parse(row.processed_transcript_ids as string),
    pendingApprovalIds: JSON.parse(row.pending_approval_ids as string),
    previousDailySummary: row.previous_daily_summary as string,
    nextRunFocus: row.next_run_focus as string,
    skippedItems: JSON.parse(row.skipped_items as string),
  };
}

export function saveCronState(state: CronState): void {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM cron_state WHERE id = ?').get('current');
  if (existing) {
    db.prepare(`
      UPDATE cron_state SET
        last_run_at = ?,
        processed_contact_ids = ?,
        processed_opportunity_ids = ?,
        processed_conversation_ids = ?,
        processed_calendar_event_ids = ?,
        processed_transcript_ids = ?,
        pending_approval_ids = ?,
        previous_daily_summary = ?,
        next_run_focus = ?,
        skipped_items = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      state.lastRunAt,
      JSON.stringify(state.processedContactIds),
      JSON.stringify(state.processedOpportunityIds),
      JSON.stringify(state.processedConversationIds),
      JSON.stringify(state.processedCalendarEventIds),
      JSON.stringify(state.processedTranscriptIds),
      JSON.stringify(state.pendingApprovalIds),
      state.previousDailySummary,
      state.nextRunFocus,
      JSON.stringify(state.skippedItems),
      now,
      'current'
    );
  } else {
    db.prepare(`
      INSERT INTO cron_state (
        id, last_run_at,
        processed_contact_ids, processed_opportunity_ids, processed_conversation_ids,
        processed_calendar_event_ids, processed_transcript_ids,
        pending_approval_ids, previous_daily_summary, next_run_focus, skipped_items,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'current',
      state.lastRunAt,
      JSON.stringify(state.processedContactIds),
      JSON.stringify(state.processedOpportunityIds),
      JSON.stringify(state.processedConversationIds),
      JSON.stringify(state.processedCalendarEventIds),
      JSON.stringify(state.processedTranscriptIds),
      JSON.stringify(state.pendingApprovalIds),
      state.previousDailySummary,
      state.nextRunFocus,
      JSON.stringify(state.skippedItems),
      now
    );
  }
}
