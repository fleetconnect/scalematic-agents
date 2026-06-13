// Thin REST client over the Express backend. In dev, Vite proxies /api to :3100.
// Every call surfaces the backend's error body so the UI can show the real reason a
// verdict or send was refused rather than a generic failure.
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data && data.error ? data.error : `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  systemStatus: () => request('/system/status'),

  // Approvals
  pendingApprovals: () => request('/approvals'),
  reviewContext: (id) => request(`/approvals/${id}/review-context`),

  // Verdicts (the human write path)
  recordVerdict: (approvalId, body) =>
    request(`/approvals/${approvalId}/verdict`, { method: 'POST', body: JSON.stringify(body) }),
  verdicts: (limit = 200) => request(`/verdicts?limit=${limit}`),

  // Opportunities
  opportunities: (limit = 100) => request(`/opportunities?limit=${limit}`),
  lineage: (id) => request(`/opportunities/${id}/lineage`),
  setThesisStatus: (id, status, evidence) =>
    request(`/opportunities/${id}/thesis-status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, evidence }),
    }),

  // Events
  events: (limit = 100) => request(`/events?limit=${limit}`),

  // Metrics
  weeklyReview: (windowDays = 7) => request(`/weekly-review?window_days=${windowDays}`),
  sends: (limit = 200) => request(`/sends?limit=${limit}`),
};
