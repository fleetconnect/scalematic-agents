export type ActionType =
  | 'NO_ACTION'
  | 'NEEDS_RESEARCH'
  | 'NEEDS_REPLY_DRAFT'
  | 'NEEDS_FOLLOW_UP'
  | 'NEEDS_CALL_PREP'
  | 'NEEDS_POST_CALL_RECAP'
  | 'NEEDS_CRM_CLEANUP'
  | 'NEEDS_STALLED_LEAD_REVIVAL'
  | 'NEEDS_GOVERNANCE_REVIEW'
  | 'NEEDS_HUMAN_ATTENTION';

export type ItemType = 'contact' | 'opportunity' | 'conversation' | 'calendar_event' | 'transcript';

export interface ClassifiedItem {
  id: string;
  type: ItemType;
  action: ActionType;
  reason: string;
  data: Record<string, unknown>;
}

export interface CronState {
  lastRunAt: string;
  processedContactIds: string[];
  processedOpportunityIds: string[];
  processedConversationIds: string[];
  processedCalendarEventIds: string[];
  processedTranscriptIds: string[];
  pendingApprovalIds: string[];
  previousDailySummary: string;
  nextRunFocus: string;
  skippedItems: string[];
}

export interface FetchedData {
  contacts: Record<string, unknown>[];
  opportunities: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  calendarEvents: Record<string, unknown>[];
  transcripts: Record<string, unknown>[];
  pendingApprovals: Record<string, unknown>[];
}

export interface CronActionResult {
  itemId: string;
  action: ActionType;
  workflowRunId?: string;
  approvalId?: string;
  agentOutput?: Record<string, unknown>;
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

export interface CronResult {
  runAt: string;
  itemsInspected: number;
  itemsActedOn: number;
  itemsSkipped: number;
  approvalIds: string[];
  summary: string;
  needsHumanAttention: string[];
  nextRunFocus: string;
}
