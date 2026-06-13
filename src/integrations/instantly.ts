import { v4 as uuid } from 'uuid';
import axios from 'axios';
import { getDb } from '../db/client';
import { getVerdict } from '../opportunity/verdicts';
import { getApproval } from '../approvals/approvalQueue';
import { emitEvent } from '../opportunity/eventLog';
import { SendRecord, SendStatus, VerdictRecord } from '../types/opportunity';
import { logger } from '../utils/logger';

// ── Config ──────────────────────────────────────────────────────────
const INSTANTLY_BASE_URL = process.env.INSTANTLY_BASE_URL ?? 'https://api.instantly.ai';
const INSTANTLY_SEND_PATH = process.env.INSTANTLY_SEND_PATH ?? '/api/v2/emails';
const INSTANTLY_REPLIES_PATH = process.env.INSTANTLY_REPLIES_PATH ?? '/api/v2/emails';

// LIVE_SENDS is OFF unless explicitly 'true'. Flipping it is a human action in .env, never programmatic.
export function liveSendsEnabled(): boolean {
  return process.env.LIVE_SENDS === 'true';
}

// While LIVE_SENDS is false, every send routes here regardless of the lead's real address.
export function testInbox(): string[] {
  return (process.env.INSTANTLY_TEST_INBOX ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function replyPollIntervalMs(): number {
  const minutes = parseInt(process.env.REPLY_POLL_INTERVAL_MIN ?? '15', 10);
  return minutes * 60 * 1000;
}

function apiKey(): string {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) throw new Error('INSTANTLY_API_KEY not configured — cannot reach Instantly');
  return key;
}

// ── Send (the ONLY send path; asserts an approving verdict in code) ──
export interface SendApprovedInput {
  verdictId: string;
  leadAddress: string;
  subject: string;
  channel?: 'email';
}

// A send may fire ONLY when backed by an APPROVED or EDITED (post-edit) verdict.
// REJECTED, missing, or any other state throws — this is the non-negotiable gate.
function assertSendableVerdict(verdictId: string): VerdictRecord {
  const verdict = getVerdict(verdictId);
  if (!verdict) throw new Error(`Verdict not found: ${verdictId} — refusing to send`);
  if (verdict.verdict !== 'APPROVED' && verdict.verdict !== 'EDITED') {
    throw new Error(
      `Verdict ${verdictId} is ${verdict.verdict}; only APPROVED or EDITED may send`
    );
  }
  return verdict;
}

// Resolves the message body that actually ships: post-edit text for EDITED, else the approved draft.
function resolveSendBody(verdict: VerdictRecord): string {
  if (verdict.verdict === 'EDITED') {
    if (!verdict.afterText) throw new Error('EDITED verdict missing afterText');
    return verdict.afterText;
  }
  const approval = getApproval(verdict.approvalId);
  if (!approval) throw new Error(`Approval not found: ${verdict.approvalId}`);
  const body = approval.output.message as string | undefined;
  if (!body) throw new Error('Approved draft has no message body');
  return body;
}

async function instantlyApiSend(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ providerMessageId?: string }> {
  const res = await axios.post(
    `${INSTANTLY_BASE_URL}${INSTANTLY_SEND_PATH}`,
    { to_address_email: params.to, subject: params.subject, body: { text: params.body } },
    { headers: { Authorization: `Bearer ${apiKey()}` } }
  );
  const data = res.data as Record<string, unknown>;
  return { providerMessageId: (data.id as string | undefined) ?? (data.message_id as string | undefined) };
}

export async function sendApprovedMessage(input: SendApprovedInput): Promise<SendRecord> {
  const verdict = assertSendableVerdict(input.verdictId);
  const body = resolveSendBody(verdict);

  const live = liveSendsEnabled();
  let toAddress = input.leadAddress;
  if (!live) {
    const inbox = testInbox();
    if (!inbox.length) {
      throw new Error('LIVE_SENDS is false but INSTANTLY_TEST_INBOX is empty — refusing to send');
    }
    toAddress = inbox[0];
  }

  const { providerMessageId } = await instantlyApiSend({
    to: toAddress,
    subject: input.subject,
    body,
  });

  const record: SendRecord = {
    id: uuid(),
    approvalId: verdict.approvalId,
    verdictId: verdict.id,
    opportunityId: verdict.opportunityId,
    channel: input.channel ?? 'email',
    toAddress,
    routedToTestInbox: !live,
    provider: 'instantly',
    providerMessageId,
    body,
    status: 'sent',
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  db.prepare(
    `INSERT INTO sends
       (id, approval_id, verdict_id, opportunity_id, channel, to_address, routed_to_test_inbox,
        provider, provider_message_id, body, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.approvalId,
    record.verdictId,
    record.opportunityId ?? null,
    record.channel,
    record.toAddress,
    record.routedToTestInbox ? 1 : 0,
    record.provider,
    record.providerMessageId ?? null,
    record.body,
    record.status,
    record.createdAt
  );

  emitEvent('message.sent', record.id, {
    parentIds: [verdict.opportunityId, verdict.id, verdict.approvalId].filter(
      (x): x is string => !!x
    ),
    payload: {
      provider_message_id: providerMessageId,
      to_address: toAddress,
      routed_to_test_inbox: record.routedToTestInbox,
      live_sends: live,
    },
  });

  logger.info(`Send recorded ${record.id} (test_inbox=${record.routedToTestInbox})`);
  return record;
}

// ── Reply capture via polling (no webhooks this week) ───────────────
function rowToSend(r: Record<string, unknown>): SendRecord {
  return {
    id: r.id as string,
    approvalId: r.approval_id as string,
    verdictId: r.verdict_id as string,
    opportunityId: (r.opportunity_id as string | null) ?? undefined,
    channel: r.channel as 'email',
    toAddress: r.to_address as string,
    routedToTestInbox: !!(r.routed_to_test_inbox as number),
    provider: r.provider as string,
    providerMessageId: (r.provider_message_id as string | null) ?? undefined,
    body: r.body as string,
    status: r.status as SendStatus,
    replyBody: (r.reply_body as string | null) ?? undefined,
    repliedAt: (r.replied_at as string | null) ?? undefined,
    createdAt: r.created_at as string,
  };
}

export function listSends(limit = 200): SendRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM sends ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToSend);
}

async function instantlyApiFetchReply(
  providerMessageId: string
): Promise<{ replyBody: string; repliedAt: string } | null> {
  const res = await axios.get(`${INSTANTLY_BASE_URL}${INSTANTLY_REPLIES_PATH}/${providerMessageId}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  const data = res.data as Record<string, unknown>;
  const replyBody = data.reply_body as string | undefined;
  if (!replyBody) return null;
  return { replyBody, repliedAt: (data.replied_at as string | undefined) ?? new Date().toISOString() };
}

// Polls every outstanding send for a reply; logs reply.received with full lineage.
export async function pollReplies(): Promise<{ checked: number; newReplies: number }> {
  const db = getDb();
  const open = db
    .prepare("SELECT * FROM sends WHERE status = 'sent' AND provider_message_id IS NOT NULL")
    .all() as Record<string, unknown>[];

  let newReplies = 0;
  for (const row of open) {
    const send = rowToSend(row);
    if (!send.providerMessageId) continue;
    try {
      const reply = await instantlyApiFetchReply(send.providerMessageId);
      if (!reply) continue;
      db.prepare("UPDATE sends SET status = 'replied', reply_body = ?, replied_at = ? WHERE id = ?").run(
        reply.replyBody,
        reply.repliedAt,
        send.id
      );

      const lineage = [send.opportunityId, send.verdictId, send.approvalId].filter(
        (x): x is string => !!x
      );

      if (send.opportunityId) {
        const priorReplies = (
          db
            .prepare(
              "SELECT COUNT(*) as n FROM sends WHERE opportunity_id = ? AND status = 'replied' AND id != ?"
            )
            .get(send.opportunityId, send.id) as { n: number }
        ).n;
        if (priorReplies === 0) {
          emitEvent('conversation.started', send.opportunityId, {
            parentIds: lineage,
            payload: { first_reply_send_id: send.id },
          });
        }
      }

      emitEvent('reply.received', send.id, {
        parentIds: lineage,
        payload: { provider_message_id: send.providerMessageId, reply_body: reply.replyBody },
      });
      newReplies++;
    } catch (err) {
      logger.error(`Reply poll failed for send ${send.id}`, { error: String(err) });
    }
  }
  return { checked: open.length, newReplies };
}

let _pollTimer: NodeJS.Timeout | null = null;

export function startReplyPolling(): void {
  if (_pollTimer) return;
  if (!process.env.INSTANTLY_API_KEY) {
    logger.info('Reply polling not started: INSTANTLY_API_KEY absent');
    return;
  }
  const interval = replyPollIntervalMs();
  _pollTimer = setInterval(() => {
    pollReplies().catch((err) => logger.error('pollReplies tick failed', { error: String(err) }));
  }, interval);
  logger.info(`Instantly reply polling started (every ${interval / 60000} min)`);
}
