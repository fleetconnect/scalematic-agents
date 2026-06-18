import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'int-db-'));
process.env.SCALEMATIC_DB = path.join(dbDir, 'test.db');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sheets = require('../src/integrations/google/sheets');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gmail = require('../src/integrations/google/gmail');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const contacts = require('../src/integrations/google/contacts');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildMorningBrief } = require('../src/integrations/morningRevenueBrief');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { describeConnectors } = require('../src/integrations/connectorRegistry');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDb } = require('../src/db/client');

function configureGoogle(on: boolean) {
  if (on) {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'rt';
    process.env.GOOGLE_KPI_SHEET_ID = 'sheet-123';
  } else {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REFRESH_TOKEN;
    delete process.env.GOOGLE_KPI_SHEET_ID;
  }
}

const SHEET = [
  ['Revenue', '12,000'],
  ['Cash collected', '$9,000'],
  ['Expenses', ''],
  ['Leads contacted', '200'],
  ['Replies', '30'],
  ['Positive replies', '10'],
  ['Calls booked', '8'],
  ['Calls showed', '5'],
  ['Offers made', '4'],
  ['Deals won', '1'],
];

function provider(over: Record<string, unknown> = {}) {
  return {
    getSheetValues: async () => SHEET,
    listThreads: async () => [
      { id: 't1', messages: [{ id: 'm1', from: 'pat@acme.com', to: ['me@x.com'], subject: 'Proposal', date: '2026-06-16T10:00:00Z', snippet: 'any update?', fromMe: false }] },
      { id: 't2', messages: [{ id: 'm2', from: 'me@x.com', to: ['x@y.com'], subject: 'Done', date: '2026-06-16T11:00:00Z', snippet: 'sent', fromMe: true }] },
    ],
    listEvents: async () => [
      { id: 'e1', title: 'Discovery call', start: '2026-06-17T15:00:00Z', end: '2026-06-17T15:30:00Z', attendees: ['lead@bigco.com'], location: null },
    ],
    listContacts: async () => [
      { id: 'c1', displayName: 'Pat Lee', emails: ['pat@acme.com'], phones: ['+1 (415) 555-0100'] },
      { id: 'c2', displayName: 'Pat L.', emails: ['pat@acme.com'], phones: [] },
      { id: 'c3', displayName: 'Pat Lee', emails: ['different@other.com'], phones: [] },
    ],
    ...over,
  };
}

test('connector unavailable: KPI read is not_configured without creds (no throw)', async () => {
  configureGoogle(false);
  const r = await sheets.readKpiSnapshot();
  assert.equal(r.state, 'not_configured');
  assert.equal(r.data.metrics.length, 0);
});

test('partial data: blanks stay null/absent, never zero; source attribution present', async () => {
  configureGoogle(true);
  const r = await sheets.readKpiSnapshot(provider());
  assert.equal(r.state, 'available');
  const expenses = r.data.metrics.find((m: any) => m.key === 'expenses');
  assert.equal(expenses.present, false);
  assert.equal(expenses.value, null);
  const netCash = r.data.metrics.find((m: any) => m.key === 'net_cash');
  assert.equal(netCash.present, false);
  const revenue = r.data.metrics.find((m: any) => m.key === 'revenue');
  assert.equal(revenue.value, 12000);
  assert.equal(revenue.source.system, 'Google Sheets');
  assert.ok(r.freshness, 'freshness reported');
});

test('parseNumberCell: blank is null, not zero; handles $ , % and parentheses', () => {
  assert.equal(sheets.parseNumberCell(''), null);
  assert.equal(sheets.parseNumberCell(undefined), null);
  assert.equal(sheets.parseNumberCell('$1,058'), 1058);
  assert.equal(sheets.parseNumberCell('12.18%'), 12.18);
  assert.equal(sheets.parseNumberCell('(1,200)'), -1200);
  assert.equal(sheets.parseNumberCell('n/a'), null);
});

test('transport failure / rate limit: degrades gracefully and never throws', async () => {
  configureGoogle(true);
  const r = await sheets.readKpiSnapshot(provider({ getSheetValues: async () => { throw new Error('429 rate limit exceeded'); } }));
  assert.equal(r.state, 'degraded');
  assert.match(r.reason, /continuing with other sources/);
});

test('no-secret logging: token-like text is redacted in the audit log', async () => {
  configureGoogle(true);
  const r = await sheets.readKpiSnapshot(provider({ getSheetValues: async () => { throw new Error('auth failed access_token=SUPERSECRET123 refresh_token=NOPE'); } }));
  const row = getDb().prepare('SELECT error FROM integration_access_log WHERE connector_id = ? ORDER BY created_at DESC LIMIT 1').get('google-sheets') as any;
  assert.ok(row.error, 'error recorded');
  assert.ok(!row.error.includes('SUPERSECRET123'), 'access token redacted');
  assert.ok(!row.error.includes('NOPE'), 'refresh token redacted');
  assert.equal(r.state, 'degraded');
});

test('empty results: no threads yields an empty list, available state', async () => {
  configureGoogle(true);
  const r = await gmail.searchThreads({ company: 'Nobody' }, 10, provider({ listThreads: async () => [] }));
  assert.equal(r.state, 'available');
  assert.deepEqual(r.data, []);
});

test('Gmail unanswered detection is correct (counterpart spoke last)', async () => {
  configureGoogle(true);
  const r = await gmail.readUnanswered(10, provider());
  assert.equal(r.data.length, 1);
  assert.equal(r.data[0].threadId, 't1');
  assert.equal(r.data[0].unanswered, true);
});

test('duplicate records grouped by shared email; distinct people not merged', () => {
  const recs = [
    { contactId: 'c1', displayName: 'Pat Lee', emails: ['pat@acme.com'], phones: ['4155550100'], source: { system: 'Google Contacts', freshness: null } },
    { contactId: 'c2', displayName: 'Pat L.', emails: ['pat@acme.com'], phones: [], source: { system: 'Google Contacts', freshness: null } },
    { contactId: 'c3', displayName: 'Pat Lee', emails: ['different@other.com'], phones: [], source: { system: 'Google Contacts', freshness: null } },
  ];
  const { duplicates } = contacts.dedupeContacts(recs);
  assert.equal(duplicates.length, 1, 'one duplicate group (shared email)');
  assert.equal(duplicates[0].length, 2);
  const ids = duplicates[0].map((d: any) => d.contactId).sort();
  assert.deepEqual(ids, ['c1', 'c2']);
});

test('mixed business data: same name different email is not merged', () => {
  const recs = [
    { contactId: 'a', displayName: 'John Smith', emails: ['john@alpha.com'], phones: [], source: { system: 'x', freshness: null } },
    { contactId: 'b', displayName: 'John Smith', emails: ['john@beta.com'], phones: [], source: { system: 'x', freshness: null } },
  ];
  const { duplicates } = contacts.dedupeContacts(recs);
  assert.equal(duplicates.length, 0, 'distinct people with same name are not merged');
});

test('descriptors are honest and expose no secret values', () => {
  configureGoogle(false);
  const offList = describeConnectors();
  const sheetsD = offList.find((c: any) => c.id === 'google-sheets');
  assert.equal(sheetsD.capabilityState, 'not_configured');
  assert.deepEqual(sheetsD.permissionsGranted, ['READ']);
  // Now set distinctive secret VALUES and confirm none leak into descriptors (env-var NAMES in
  // reason strings are fine; actual credential values must never appear).
  process.env.GOOGLE_CLIENT_ID = 'id';
  process.env.GOOGLE_CLIENT_SECRET = 'XYZSECRETVALUE';
  process.env.GOOGLE_REFRESH_TOKEN = 'XYZREFRESHVALUE';
  const json = JSON.stringify(describeConnectors());
  assert.ok(!json.includes('XYZSECRETVALUE') && !json.includes('XYZREFRESHVALUE'), 'no secret values exposed');
  configureGoogle(false);
});

function readResult(connectorId: string, state: string, data: unknown, extra: Record<string, unknown> = {}) {
  return { connectorId, state, data, reason: '', freshness: state === 'available' ? '2026-06-17T08:00:00Z' : null, fetchedAt: '2026-06-17T08:00:00Z', ...extra };
}

test('morning brief assembles with PARTIAL connectors and never treats missing as zero', () => {
  const kpiSnap = {
    state: 'available',
    capturedAt: '2026-06-17T08:00:00Z',
    source: { system: 'Google Sheets', id: 'sheet-123', freshness: '2026-06-17T08:00:00Z' },
    reason: 'ok',
    metrics: [
      { key: 'leads_contacted', label: 'Leads contacted', value: 200, present: true, source: { system: 'Google Sheets', freshness: null } },
      { key: 'replies', label: 'Replies', value: 30, present: true, source: { system: 'Google Sheets', freshness: null } },
      { key: 'positive_replies', label: 'Positive replies', value: 10, present: true, source: { system: 'Google Sheets', freshness: null } },
      { key: 'calls_booked', label: 'Calls booked', value: 8, present: true, source: { system: 'Google Sheets', freshness: null } },
      { key: 'calls_showed', label: 'Calls showed', value: 2, present: true, source: { system: 'Google Sheets', freshness: null } },
      { key: 'offers_made', label: 'Offers made', value: null, present: false, source: { system: 'Google Sheets', freshness: null } },
    ],
  };
  const threads = [
    { threadId: 't1', subject: 'Proposal', from: 'pat@acme.com', to: ['me@x.com'], lastMessageAt: '2026-06-16T10:00:00Z', unanswered: true, snippet: 'update?', source: { system: 'Gmail', id: 't1', freshness: '2026-06-17T08:00:00Z' } },
  ];
  const brief = buildMorningBrief({
    now: '2026-06-17T08:00:00Z',
    kpi: readResult('google-sheets', 'available', kpiSnap),
    unanswered: readResult('gmail', 'available', threads),
    meetings: readResult('google-calendar', 'not_configured', []),
    connectors: [
      { id: 'google-sheets', capabilityState: 'available', dataFreshness: null, errorState: null },
      { id: 'gmail', capabilityState: 'available', dataFreshness: null, errorState: null },
      { id: 'google-calendar', capabilityState: 'not_configured', dataFreshness: null, errorState: null },
      { id: 'google-contacts', capabilityState: 'not_configured', dataFreshness: null, errorState: null },
    ],
    obsidian: { recentNotes: ['Note A'], state: 'available', source: { system: 'Obsidian', freshness: '2026-06-17T08:00:00Z' } },
  });
  assert.ok(brief.primaryFocus.outcome.includes('unanswered'));
  assert.equal(brief.kpiBottleneck.constraint, 'reply rate (leads → replies)');
  assert.equal(brief.followUpsReady.length, 1);
  assert.equal(brief.followUpsReady[0].requiresApproval, true);
  assert.ok(brief.systemHealth.missingSources.includes('google-calendar'));
  assert.ok(brief.bestProspect.sources.length >= 1, 'best prospect cites a source');
  assert.ok(brief.revenueAtRisk.openProposals[0].includes('Phase 2'), 'GHL not asserted in Phase 1');
  assert.ok(brief.inferenceNotes.some((n: string) => /inferred/i.test(n)));
});

test('morning brief survives ALL Phase 1 connectors unavailable', () => {
  const brief = buildMorningBrief({
    now: '2026-06-17T08:00:00Z',
    kpi: readResult('google-sheets', 'not_configured', { state: 'not_configured', metrics: [], capturedAt: null, source: { system: 'Google Sheets', freshness: null }, reason: 'x' }),
    unanswered: readResult('gmail', 'not_configured', []),
    meetings: readResult('google-calendar', 'not_configured', []),
    connectors: [
      { id: 'google-sheets', capabilityState: 'not_configured', dataFreshness: null, errorState: null },
      { id: 'gmail', capabilityState: 'not_configured', dataFreshness: null, errorState: null },
      { id: 'google-calendar', capabilityState: 'not_configured', dataFreshness: null, errorState: null },
      { id: 'google-contacts', capabilityState: 'not_configured', dataFreshness: null, errorState: null },
    ],
    obsidian: { recentNotes: [], state: 'degraded', source: { system: 'Obsidian', freshness: null } },
  });
  assert.equal(brief.kpiBottleneck, null);
  assert.equal(brief.bestProspect, null);
  assert.equal(brief.followUpsReady.length, 0);
  assert.equal(brief.systemHealth.missingSources.length, 4);
  assert.ok(brief.primaryFocus.outcome.length > 0, 'still produces a focus');
});
