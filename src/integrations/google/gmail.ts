import {
  GoogleProvider,
  RawGmailThread,
  googleConfigReason,
  googleCredsPresent,
  loadGoogleProvider,
} from './googleAuth';
import { runRead } from '../integrationAudit';
import { EmailThreadSummary, ReadResult, SourceRef } from '../../types/integrations';

// Gmail reader (read-only). No automatic sending — replies are drafts only and require approval.
// Source references link each thread back to Gmail.

export interface GmailSearch {
  person?: string;
  company?: string;
  subject?: string;
  after?: string;
  before?: string;
}

// Build a Gmail search query from structured inputs. Read-only; never mutates anything.
export function buildQuery(s: GmailSearch): string {
  const parts: string[] = [];
  if (s.person) parts.push(`(from:${s.person} OR to:${s.person})`);
  if (s.company) parts.push(`"${s.company}"`);
  if (s.subject) parts.push(`subject:(${s.subject})`);
  if (s.after) parts.push(`after:${s.after}`);
  if (s.before) parts.push(`before:${s.before}`);
  return parts.join(' ').trim() || 'in:inbox';
}

// Pure: turn raw threads into summaries. A thread is unanswered when its most recent message is
// NOT from us (the counterpart spoke last and is awaiting a reply).
export function summarizeThreads(threads: RawGmailThread[], freshness: string | null): EmailThreadSummary[] {
  return threads.map((t) => {
    const sorted = [...t.messages].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    const counterpart = sorted.find((m) => !m.fromMe) ?? first;
    return {
      threadId: t.id,
      subject: first?.subject ?? '(no subject)',
      from: counterpart?.from ?? '',
      to: last?.to ?? [],
      lastMessageAt: last?.date ?? null,
      unanswered: Boolean(last) && !last.fromMe,
      snippet: last?.snippet ?? '',
      source: { system: 'Gmail', id: t.id, detail: 'thread', freshness },
    };
  });
}

async function readThreadsWith(
  operation: string,
  query: string,
  max: number,
  provider?: GoogleProvider
): Promise<ReadResult<EmailThreadSummary[]>> {
  return runRead('gmail', operation, [] as EmailThreadSummary[], async () => {
    if (!googleCredsPresent()) {
      return { state: 'not_configured', data: [], reason: googleConfigReason() };
    }
    const p = provider ?? (await loadGoogleProvider());
    const raw = await p.listThreads(query, max);
    const freshness = new Date().toISOString();
    const summaries = summarizeThreads(raw, freshness);
    return {
      state: 'available',
      data: summaries,
      reason: `Read ${summaries.length} Gmail thread(s)`,
      freshness,
      sourceIds: summaries.map((s) => s.threadId),
    };
  });
}

export function searchThreads(search: GmailSearch, max = 25, provider?: GoogleProvider) {
  return readThreadsWith('searchThreads', buildQuery(search), max, provider);
}

export async function readUnanswered(max = 25, provider?: GoogleProvider): Promise<ReadResult<EmailThreadSummary[]>> {
  const res = await readThreadsWith('readUnanswered', 'in:inbox', max, provider);
  return { ...res, data: res.data.filter((t) => t.unanswered) };
}

// DRAFT permission only: produce a reply draft. Never sends. Execution requires explicit approval
// and is deferred to a later phase.
export function draftReply(thread: EmailThreadSummary, body: string): {
  to: string;
  subject: string;
  draft: string;
  requiresApproval: true;
  source: SourceRef;
} {
  const subject = thread.subject.toLowerCase().startsWith('re:') ? thread.subject : `Re: ${thread.subject}`;
  return {
    to: thread.from,
    subject,
    draft: body,
    requiresApproval: true,
    source: { system: 'Gmail', id: thread.threadId, detail: 'reply draft', freshness: thread.lastMessageAt },
  };
}
