import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Isolate DB + vault before module load (db client computes its path at import).
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rob-db-'));
process.env.SCALEMATIC_DB = path.join(dbDir, 'test.db');
process.env.VAULT_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'rob-vault-'));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const adapter = require('../src/vault/vaultAdapter');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fileApprovedConversation } = require('../src/vault/conversationFiling');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseFrontmatter, tryParseFrontmatter } = require('../src/vault/frontmatter');

const CONV = '06 Conversations';

// Reproduces the real-world failure: an unquoted value containing `: ` inside makes js-yaml throw.
const MALFORMED = [
  '---',
  'date: 2026-06-03',
  'type: conversation',
  'channel: Fathom Video Call — "Kalei <> Joe: AI Partner Intro Meeting"',
  'source_reference: malformed-src-ref-001',
  '---',
  'This is the malformed note body about the Acme deal.',
  '',
].join('\n');

function vaultWith(notes: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rob-vault-'));
  fs.mkdirSync(path.join(root, CONV), { recursive: true });
  for (const [name, content] of Object.entries(notes)) {
    fs.writeFileSync(path.join(root, CONV, name), content, 'utf-8');
  }
  process.env.VAULT_ROOT = root;
  return root;
}

function noLeak(obj: unknown, root: string): boolean {
  return !JSON.stringify(obj).includes(root) && !JSON.stringify(obj).includes(os.tmpdir());
}

function base(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reviewedMarkdown: 'A brand new unrelated conversation about widgets.',
    proposedTitle: 'New Unrelated Call',
    conversationDate: '2026-06-10',
    sourceType: 'sales-call',
    people: ['Pat Smith'],
    companies: ['Widgets Inc'],
    approvalReference: 'approval-x',
    ...over,
  };
}

test('1-3: malformed note does not break conversations/recent/search; it is included as invalid', () => {
  const root = vaultWith({ '2026-06-03 — Malformed Note.md': MALFORMED, 'Good.md': '---\ndate: 2026-06-09\ntype: conversation\npeople:\n  - Ann\n---\nBody about apples.' });
  const convos = adapter.conversations();
  assert.equal(convos.length, 2);
  const bad = convos.find((c: any) => c.path.endsWith('Malformed Note.md'));
  assert.ok(bad, 'malformed note present in conversations');
  assert.equal(bad.frontmatterStatus, 'invalid');
  assert.equal(bad.date, '2026-06-03', 'date falls back to the filename prefix for malformed notes');
  assert.doesNotThrow(() => adapter.recentNotes(10));
  const hits = adapter.searchNotes('Acme');
  assert.ok(hits.find((h: any) => h.path.endsWith('Malformed Note.md')), 'malformed note still searchable by body');
  assert.ok(noLeak(convos, root) && noLeak(hits, root), 'no absolute path leak');
});

test('10-11: malformed note carries a safe error and only vault-relative paths', () => {
  const root = vaultWith({ 'Malformed Note.md': MALFORMED });
  const notes = adapter.listNotes(CONV);
  const bad = notes[0];
  assert.equal(bad.frontmatterStatus, 'invalid');
  assert.ok(typeof bad.frontmatterError === 'string' && bad.frontmatterError.length > 0);
  assert.ok(!bad.frontmatterError.includes('/Users/') && !bad.frontmatterError.includes(os.tmpdir()));
  assert.ok(bad.path.startsWith(CONV + '/') && noLeak(notes, root));
});

test('4 & 9: filing scan survives a malformed unrelated note and still allows a valid write', () => {
  vaultWith({ 'Malformed Note.md': MALFORMED });
  const r = fileApprovedConversation(base());
  assert.equal(r.result, 'created');
  assert.ok(r.relativePath.startsWith(CONV + '/'));
});

test('5: malformed note still triggers target-path collision -> needs_review (no overwrite)', () => {
  const root = vaultWith({ '2026-06-03 — Joe Testouri — Fathom Video Call.md': MALFORMED });
  const before = fs.readFileSync(path.join(root, CONV, '2026-06-03 — Joe Testouri — Fathom Video Call.md'), 'utf-8');
  const r = fileApprovedConversation(base({
    conversationDate: '2026-06-03',
    people: ['Joe Testouri'],
    companies: [],
    proposedTitle: 'Fathom Video Call',
    reviewedMarkdown: 'Different content than the malformed note.',
  }));
  assert.equal(r.result, 'needs_review');
  const after = fs.readFileSync(path.join(root, CONV, '2026-06-03 — Joe Testouri — Fathom Video Call.md'), 'utf-8');
  assert.equal(after, before, 'malformed note untouched');
});

test('6: malformed note detectable by raw content hash -> needs_review', () => {
  vaultWith({ 'Malformed Note.md': MALFORMED });
  const r = fileApprovedConversation(base({
    reviewedMarkdown: 'This is the malformed note body about the Acme deal.',
  }));
  assert.equal(r.result, 'needs_review');
  assert.ok(r.candidates.some((c: string) => c.endsWith('Malformed Note.md')));
});

test('7: malformed note detectable by source-reference text -> needs_review', () => {
  vaultWith({ 'Malformed Note.md': MALFORMED });
  const r = fileApprovedConversation(base({ sourceReference: 'malformed-src-ref-001' }));
  assert.equal(r.result, 'needs_review');
  assert.ok(r.candidates.some((c: string) => c.endsWith('Malformed Note.md')));
});

test('12: no existing vault note is modified during any filing operation', () => {
  const root = vaultWith({ 'Malformed Note.md': MALFORMED });
  const p = path.join(root, CONV, 'Malformed Note.md');
  const before = fs.readFileSync(p, 'utf-8');
  fileApprovedConversation(base()); // created elsewhere
  fileApprovedConversation(base({ sourceReference: 'malformed-src-ref-001' })); // needs_review
  assert.equal(fs.readFileSync(p, 'utf-8'), before);
});

test('13: strict parser still rejects malformed YAML; tolerant parser degrades', () => {
  assert.throws(() => parseFrontmatter(MALFORMED));
  const t = tryParseFrontmatter(MALFORMED);
  assert.equal(t.valid, false);
  assert.ok(t.body.includes('Acme'), 'body preserved for malformed note');
});

test('14: unexpected vault unavailability still fails honestly', () => {
  process.env.VAULT_ROOT = path.join(os.tmpdir(), 'missing-rob-vault-xyz');
  const r = fileApprovedConversation(base());
  assert.equal(r.result, 'failed');
});
