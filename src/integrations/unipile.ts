// Unipile LinkedIn Integration
import axios from 'axios';
import https from 'https';

function client() {
  return axios.create({
    baseURL: process.env.UNIPILE_BASE_URL ?? 'https://api20.unipile.com:15065',
    headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY, accept: 'application/json' },
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 30000,
  });
}

export async function getAccounts() {
  const r = await client().get('/api/v1/accounts');
  return r.data.items ?? r.data.accounts ?? [];
}

export async function getChats(limit = 20, unreadOnly = false) {
  const params: Record<string, unknown> = { limit };
  if (unreadOnly) params.unread = 'true';
  const r = await client().get('/api/v1/chats', { params });
  return r.data.items ?? r.data.chats ?? [];
}

export async function getChatMessages(chatId: string, limit = 10) {
  const r = await client().get(`/api/v1/chats/${chatId}/messages`, { params: { limit } });
  return r.data.items ?? r.data.messages ?? [];
}

export async function sendMessage(chatId: string, text: string) {
  // Requires human approval — never call directly from automated workflows
  const r = await client().post(`/api/v1/chats/${chatId}/messages`, { text });
  return r.data;
}

export async function getProfile(accountId: string) {
  const r = await client().get(`/api/v1/accounts/${accountId}`);
  return r.data;
}
