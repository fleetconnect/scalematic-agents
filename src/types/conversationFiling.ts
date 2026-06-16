// Phase 2A — governed conversation filing types. The single durable Plane-B write surface.

export type SourceType =
  | 'linkedin'
  | 'email'
  | 'sales-call'
  | 'discovery-call'
  | 'facebook'
  | 'voice-note'
  | 'meeting-transcript'
  | 'crm-export'
  | 'pasted-thread'
  | 'screenshot-text'
  | 'other';

export const SOURCE_TYPES: SourceType[] = [
  'linkedin',
  'email',
  'sales-call',
  'discovery-call',
  'facebook',
  'voice-note',
  'meeting-transcript',
  'crm-export',
  'pasted-thread',
  'screenshot-text',
  'other',
];

export interface FileConversationInput {
  reviewedMarkdown: string;
  proposedTitle: string;
  conversationDate?: string;
  sourceType: SourceType;
  sourceReference?: string;
  people?: string[];
  companies?: string[];
  projects?: string[];
  approvalReference: string;
  idempotencyKey?: string;
}

export type FilingResult =
  | 'created'
  | 'already_exists'
  | 'needs_review'
  | 'rejected'
  | 'failed';

export interface FileConversationResult {
  result: FilingResult;
  relativePath?: string;
  candidates?: string[];
  reason?: string;
  auditId: string;
}
