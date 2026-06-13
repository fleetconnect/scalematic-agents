import axios from 'axios';
import { v4 as uuid } from 'uuid';
import { createApproval, getApproval } from '../approvals/approvalQueue';
import { Approval } from '../types/approval';
import { logger } from '../utils/logger';

const BASE_URL = process.env.GHL_BASE_URL ?? 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

function headers() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: VERSION,
    'Content-Type': 'application/json',
  };
}

const locationId = () => process.env.GHL_LOCATION_ID ?? '';

// ── Typed response shapes ─────────────────────────────────────────

export interface GhlContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tags: string[];
  customFields: Record<string, unknown>[];
  source: string;
  createdAt: string;
}

export interface GhlOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  monetaryValue: number;
  contact: { id: string; name: string; email: string };
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
}

export interface GhlConversation {
  id: string;
  contactId: string;
  lastMessageBody: string;
  lastMessageDate: string;
  unreadCount: number;
  type: string;
}

export interface GhlCalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  contactId: string;
  assignedUserId: string;
  status: string;
}

// ── Proposal action discriminated union ───────────────────────────

export type GhlProposalAction =
  | { type: 'contact_update'; contactId: string; fields: Partial<Pick<GhlContact, 'firstName' | 'lastName' | 'email' | 'phone' | 'tags'>> & { customFields?: Record<string, unknown>[] } }
  | { type: 'opportunity_update'; opportunityId: string; fields: Partial<Pick<GhlOpportunity, 'name' | 'pipelineStageId' | 'status' | 'monetaryValue'>> }
  | { type: 'message_draft'; contactId: string; channel: 'email' | 'sms'; subject?: string; body: string };

// ── Read operations (safe, no side effects) ───────────────────────

export async function searchContact(query: string): Promise<GhlContact[]> {
  const r = await axios.get(`${BASE_URL}/contacts/`, {
    headers: headers(),
    params: { locationId: locationId(), query, limit: 20 },
  });
  return (r.data.contacts ?? []) as GhlContact[];
}

export async function getContact(contactId: string): Promise<GhlContact | null> {
  const r = await axios.get(`${BASE_URL}/contacts/${contactId}`, { headers: headers() });
  return (r.data.contact ?? null) as GhlContact | null;
}

export async function getRecentConversations(limit = 20): Promise<GhlConversation[]> {
  const r = await axios.get(`${BASE_URL}/conversations/search`, {
    headers: headers(),
    params: { locationId: locationId(), limit },
  });
  return (r.data.conversations ?? []) as GhlConversation[];
}

export async function getOpportunity(opportunityId: string): Promise<GhlOpportunity | null> {
  const r = await axios.get(`${BASE_URL}/opportunities/${opportunityId}`, { headers: headers() });
  return (r.data.opportunity ?? null) as GhlOpportunity | null;
}

export async function searchOpportunities(query: string, pipelineId?: string): Promise<GhlOpportunity[]> {
  const params: Record<string, string | number> = { location_id: locationId(), limit: 50 };
  if (query) params.query = query;
  if (pipelineId) params.pipeline_id = pipelineId;
  const r = await axios.get(`${BASE_URL}/opportunities/search`, { headers: headers(), params });
  return (r.data.opportunities ?? []) as GhlOpportunity[];
}

export async function getCalendarEvents(startTime: string, endTime: string): Promise<GhlCalendarEvent[]> {
  const r = await axios.get(`${BASE_URL}/calendars/events`, {
    headers: headers(),
    params: { locationId: locationId(), startTime, endTime },
  });
  return (r.data.events ?? []) as GhlCalendarEvent[];
}

// ── Write proposals (approval-gated — no direct GHL mutation) ─────

export function proposeContactUpdate(
  contactId: string,
  fields: GhlProposalAction & { type: 'contact_update' } extends { fields: infer F } ? F : never,
  reason: string
): Approval {
  const action: GhlProposalAction = { type: 'contact_update', contactId, fields };
  const approval = createApproval(
    uuid(),
    'crm',
    { action, reason, proposed_at: new Date().toISOString() }
  );
  logger.info(`GHL contact update proposed: ${contactId} → approval ${approval.id}`);
  return approval;
}

export function proposeOpportunityUpdate(
  opportunityId: string,
  fields: GhlProposalAction & { type: 'opportunity_update' } extends { fields: infer F } ? F : never,
  reason: string
): Approval {
  const action: GhlProposalAction = { type: 'opportunity_update', opportunityId, fields };
  const approval = createApproval(
    uuid(),
    'crm',
    { action, reason, proposed_at: new Date().toISOString() }
  );
  logger.info(`GHL opportunity update proposed: ${opportunityId} → approval ${approval.id}`);
  return approval;
}

export function proposeMessageDraft(
  contactId: string,
  channel: 'email' | 'sms',
  body: string,
  reason: string,
  subject?: string
): Approval {
  const action: GhlProposalAction = { type: 'message_draft', contactId, channel, body, subject };
  const approval = createApproval(
    uuid(),
    'messaging',
    { action, reason, proposed_at: new Date().toISOString() }
  );
  logger.info(`GHL message draft proposed for contact ${contactId} → approval ${approval.id}`);
  return approval;
}

// ── Execute approved proposal ─────────────────────────────────────

export async function executeGhlProposal(approvalId: string): Promise<Record<string, unknown>> {
  const approval = getApproval(approvalId);
  if (!approval) throw new Error(`Approval not found: ${approvalId}`);
  if (approval.status !== 'approved') {
    throw new Error(`Cannot execute approval ${approvalId}: status is "${approval.status}", must be "approved"`);
  }

  const action = approval.output.action as GhlProposalAction;

  if (action.type === 'contact_update') {
    const r = await axios.put(
      `${BASE_URL}/contacts/${action.contactId}`,
      action.fields,
      { headers: headers() }
    );
    logger.info(`GHL contact updated: ${action.contactId} (approval ${approvalId})`);
    return r.data as Record<string, unknown>;
  }

  if (action.type === 'opportunity_update') {
    const r = await axios.put(
      `${BASE_URL}/opportunities/${action.opportunityId}`,
      action.fields,
      { headers: headers() }
    );
    logger.info(`GHL opportunity updated: ${action.opportunityId} (approval ${approvalId})`);
    return r.data as Record<string, unknown>;
  }

  if (action.type === 'message_draft') {
    const body: Record<string, unknown> = {
      type: action.channel === 'email' ? 'Email' : 'SMS',
      contactId: action.contactId,
      message: action.body,
    };
    if (action.subject) body.subject = action.subject;
    const r = await axios.post(`${BASE_URL}/conversations/messages`, body, { headers: headers() });
    logger.info(`GHL message sent to contact ${action.contactId} via ${action.channel} (approval ${approvalId})`);
    return r.data as Record<string, unknown>;
  }

  throw new Error(`Unknown proposal action type: ${(action as GhlProposalAction).type}`);
}
