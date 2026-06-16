import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Isolate BEFORE the module (and its db client) load: point the DB and vault at throwaway temp
// locations so we never touch the real operational store or the operator's vault.
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-db-'));
process.env.SCALEMATIC_DB = path.join(dbDir, 'test.db');
process.env.VAULT_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-vault-'));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fileApprovedConversation } = require('../src/vault/conversationFiling');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDb } = require('../src/db/client');

const CONV = '06 Conversations';

function freshVault(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-vault-'));
  fs.mkdirSync(path.join(root, CONV), { recursive: true });
  process.env.VAULT_ROOT = root;
  return root;
}

function base(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reviewedMarkdown: 'Talked about the pipeline and next steps.',
    proposedTitle: 'ScaleMatic Introduction Call',
    conversationDate: '2026-06-15',
    sourceType: 'sales-call',
    people: ['Brian Hong', 'Kalei Poteat'],
    companies: ['ScaleMatic'],
    approvalReference: 'approval-123',
    ...over,
  };
}

test('created: writes a verified note into 06 Conversations and returns a relative path', () => {
  const root = freshVault();
  const r = fileApprovedConversation(base());
  assert.equal(r.result, 'created');
  assert.ok(r.relativePath.startsWith(CONV + '/'), 'relative path under 06 Conversations');
  assert.ok(!path.isAbsolute(r.relativePath) && !r.relativePath.includes(root), 'no absolute path leak');
  const abs = path.join(root, r.relativePath);
  assert.ok(fs.existsSync(abs), 'file exists');
  const text = fs.readFileSync(abs, 'utf-8');
  assert.match(text, /type: conversation/);
  assert.match(text, /review_status: human-approved/);
  assert.match(text, /Talked about the pipeline/);
});

test('rejected: missing approvalReference', () => {
  freshVault();
  const r = fileApprovedConversation(base({ approvalReference: '' }));
  assert.equal(r.result, 'rejected');
});

test('rejected: empty content', () => {
  freshVault();
  assert.equal(fileApprovedConversation(base({ reviewedMarkdown: '   ' })).result, 'rejected');
});

test('rejected: oversized payload', () => {
  freshVault();
  const big = 'x'.repeat(1_048_577);
  assert.equal(fileApprovedConversation(base({ reviewedMarkdown: big })).result, 'rejected');
});

test('rejected: invalid date and invalid sourceType', () => {
  freshVault();
  assert.equal(fileApprovedConversation(base({ conversationDate: '06/15/2026' })).result, 'rejected');
  assert.equal(fileApprovedConversation(base({ sourceType: 'telepathy' })).result, 'rejected');
});

test('rejected: null byte in content', () => {
  freshVault();
  const withNull = 'a' + String.fromCharCode(0) + 'b';
  assert.equal(fileApprovedConversation(base({ reviewedMarkdown: withNull })).result, 'rejected');
});

test('traversal/illegal title is sanitized and stays inside 06 Conversations', () => {
  const root = freshVault();
  const r = fileApprovedConversation(base({ proposedTitle: '../../etc/passwd', people: [], companies: [] }));
  assert.equal(r.result, 'created');
  assert.ok(r.relativePath.startsWith(CONV + '/'), 'no escape from target folder');
  const abs = path.join(root, r.relativePath);
  assert.ok(fs.realpathSync(abs).startsWith(fs.realpathSync(path.join(root, CONV))), 'resolved inside folder');
});

test('idempotent retry with same key returns already_exists and the same path', () => {
  freshVault();
  const payload = base({ idempotencyKey: 'idem-1' });
  const first = fileApprovedConversation(payload);
  assert.equal(first.result, 'created');
  const second = fileApprovedConversation(payload);
  assert.equal(second.result, 'already_exists');
  assert.equal(second.relativePath, first.relativePath);
});

test('duplicate content without key returns needs_review with candidates (no overwrite)', () => {
  freshVault();
  const first = fileApprovedConversation(base());
  assert.equal(first.result, 'created');
  // Different title (different filename) but identical body → duplicate content detected.
  const second = fileApprovedConversation(base({ proposedTitle: 'A Totally Different Title' }));
  assert.equal(second.result, 'needs_review');
  assert.ok(Array.isArray(second.candidates) && second.candidates.length >= 1);
});

test('filename collision with different content returns needs_review and never overwrites', () => {
  const root = freshVault();
  const first = fileApprovedConversation(base());
  assert.equal(first.result, 'created');
  const before = fs.readFileSync(path.join(root, first.relativePath), 'utf-8');
  // Same title+person+date → same filename, but different body.
  const second = fileApprovedConversation(base({ reviewedMarkdown: 'Completely different content here.' }));
  assert.equal(second.result, 'needs_review');
  const after = fs.readFileSync(path.join(root, first.relativePath), 'utf-8');
  assert.equal(after, before, 'existing note must be untouched');
});

test('no temp files are left behind after a successful write', () => {
  const root = freshVault();
  fileApprovedConversation(base());
  const leftovers = fs.readdirSync(path.join(root, CONV)).filter((f) => f.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('vault unavailable returns failed', () => {
  process.env.VAULT_ROOT = path.join(os.tmpdir(), 'definitely-missing-vault-cf-xyz');
  const r = fileApprovedConversation(base());
  assert.equal(r.result, 'failed');
});

test('every outcome writes an audit row', () => {
  freshVault();
  const r = fileApprovedConversation(base({ idempotencyKey: 'audit-check' }));
  const row = getDb()
    .prepare('SELECT * FROM conversation_filings WHERE id = ?')
    .get(r.auditId) as Record<string, unknown> | undefined;
  assert.ok(row, 'audit row exists');
  assert.equal(row!.outcome, 'created');
  assert.equal(row!.command, 'fileApprovedConversation');
  assert.ok(String(row!.content_fingerprint).length === 64, 'fingerprint stored');
  assert.ok(!String(row!.final_relative_path).includes(os.tmpdir()), 'audit stores relative path');
});
