// GoHighLevel CRM Integration
import axios from 'axios';

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

export async function getOpportunities(limit = 50, pipelineId?: string) {
  const params: Record<string, string | number> = { location_id: locationId(), limit };
  if (pipelineId) params.pipeline_id = pipelineId;
  const r = await axios.get(`${BASE_URL}/opportunities/search`, { headers: headers(), params });
  return r.data.opportunities ?? [];
}

export async function getPipelines() {
  const r = await axios.get(`${BASE_URL}/opportunities/pipelines`, {
    headers: headers(),
    params: { locationId: locationId() },
  });
  return r.data.pipelines ?? [];
}

export async function getContacts(limit = 50, query?: string) {
  const params: Record<string, string | number> = { locationId: locationId(), limit };
  if (query) params.query = query;
  const r = await axios.get(`${BASE_URL}/contacts/`, { headers: headers(), params });
  return r.data.contacts ?? [];
}

export async function getContact(contactId: string) {
  const r = await axios.get(`${BASE_URL}/contacts/${contactId}`, { headers: headers() });
  return r.data.contact ?? null;
}

export async function updateOpportunityStage(opportunityId: string, pipelineStageId: string) {
  const r = await axios.put(
    `${BASE_URL}/opportunities/${opportunityId}`,
    { pipelineStageId },
    { headers: headers() }
  );
  return r.data;
}

export async function createTask(contactId: string, title: string, dueDate: string, assignedTo?: string) {
  const body: Record<string, unknown> = { title, dueDate, contactId };
  if (assignedTo) body.assignedTo = assignedTo;
  const r = await axios.post(`${BASE_URL}/contacts/${contactId}/tasks`, body, { headers: headers() });
  return r.data;
}

export async function addContactNote(contactId: string, body: string) {
  const r = await axios.post(
    `${BASE_URL}/contacts/${contactId}/notes`,
    { body },
    { headers: headers() }
  );
  return r.data;
}

export async function getConversations(limit = 20) {
  const r = await axios.get(`${BASE_URL}/conversations/search`, {
    headers: headers(),
    params: { locationId: locationId(), limit },
  });
  return r.data.conversations ?? [];
}
