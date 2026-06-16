import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '../db/client';
import { getVaultRoot, FOLDER } from './vaultConfig';
import { parseFrontmatter } from './frontmatter';
import { assertSafeRelativePath, toVaultRelative } from './pathSafety';
import {
  FileConversationInput,
  FileConversationResult,
  FilingResult,
  SOURCE_TYPES,
  SourceType,
} from '../types/conversationFiling';

// Phase 2A — the single governed Plane-B write. Files one human-approved conversation note into
// 06 Conversations only. Never overwrites, never auto-merges, never forces a write with a random
// suffix. Every terminal outcome (including rejected/failed) writes an audit row. Browser callers
// only ever receive vault-relative paths.

const TARGET_FOLDER = FOLDER.conversations; // '06 Conversations'
const MAX_BODY_BYTES = 1_048_576; // 1 MB
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f]", "g");
const ILLEGAL_FILENAME = /[\\/:*?"<>|]/g;

const SOURCE_LABEL: Record<SourceType, string> = {
  linkedin: 'LinkedIn',
  email: 'Email',
  'sales-call': 'Sales Call',
  'discovery-call': 'Discovery Call',
  facebook: 'Facebook',
  'voice-note': 'Voice Note',
  'meeting-transcript': 'Meeting Transcript',
  'crm-export': 'CRM Export',
  'pasted-thread': 'Pasted Thread',
  'screenshot-text': 'Screenshot (text)',
  other: 'Other',
};

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Strip control/path/illegal-filename characters from a title segment. This sanitizes a *title*
// into a safe filename piece; it never sanitizes a caller-supplied path into a write (paths are
// rejected, not repaired). Em-dash separators are preserved to match existing notes.
function safeSegment(s: string): string {
  return s.replace(CONTROL_CHARS, ' ').replace(ILLEGAL_FILENAME, ' ').replace(/\s+/g, ' ').trim();
}

function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
}

// Bare scalar when safe, double-quoted (escaped) when the value could break YAML.
function yamlScalar(v: string): string {
  if (v === '') return '""';
  if (/^[A-Za-z0-9 .,'()&/+_-]+$/.test(v) && !/^\s|\s$/.test(v)) return v;
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function audit(row: {
  approvalReference: string;
  idempotencyKey?: string;
  fingerprint: string;
  proposedTitle: string;
  relativePath: string | null;
  result: FilingResult;
  verification: 'verified' | 'failed' | 'skipped';
  error?: string;
}): string {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO conversation_filings
        (id, command, approval_reference, idempotency_key, content_fingerprint, proposed_title,
         final_relative_path, duplicate_result, verification, outcome, error, created_at)
       VALUES (?, 'fileApprovedConversation', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      row.approvalReference,
      row.idempotencyKey ?? null,
      row.fingerprint,
      row.proposedTitle,
      row.relativePath,
      row.result,
      row.verification,
      row.result,
      row.error ?? null,
      new Date().toISOString()
    );
  return id;
}

interface ExistingNote {
  rel: string;
  sourceReference: string | null;
  fingerprint: string;
}

function scanConversations(root: string, dir: string): ExistingNote[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: ExistingNote[] = [];
  for (const name of entries) {
    if (!name.toLowerCase().endsWith('.md')) continue;
    const abs = path.join(dir, name);
    let st: fs.Stats;
    try {
      st = fs.lstatSync(abs);
    } catch {
      continue;
    }
    if (st.isSymbolicLink() || !st.isFile()) continue;
    const raw = fs.readFileSync(abs, 'utf-8');
    const { frontmatter } = parseFrontmatter(raw);
    const sr = frontmatter.source_reference;
    out.push({
      rel: toVaultRelative(root, abs),
      sourceReference: typeof sr === 'string' ? sr.trim() : null,
      fingerprint: typeof frontmatter.content_hash === 'string' ? frontmatter.content_hash : '',
    });
  }
  return out;
}

export function fileApprovedConversation(input: FileConversationInput): FileConversationResult {
  const proposedTitle = (input.proposedTitle ?? '').toString();
  const fingerprint = sha256((input.reviewedMarkdown ?? '').trim());

  const reject = (reason: string): FileConversationResult => {
    const auditId = audit({
      approvalReference: input.approvalReference ?? '',
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      proposedTitle,
      relativePath: null,
      result: 'rejected',
      verification: 'skipped',
      error: reason,
    });
    return { result: 'rejected', reason, auditId };
  };

  // ── Validation (no write on any failure) ────────────────────────────────
  if (!input.approvalReference || !input.approvalReference.trim()) {
    return reject('Missing approvalReference — human approval is required and never inferred');
  }
  if (!input.reviewedMarkdown || !input.reviewedMarkdown.trim()) {
    return reject('Empty reviewedMarkdown');
  }
  if (Buffer.byteLength(input.reviewedMarkdown, 'utf8') > MAX_BODY_BYTES) {
    return reject('Payload exceeds the 1 MB body limit');
  }
  if (input.reviewedMarkdown.includes('\0')) {
    return reject('Null byte in content');
  }
  if (!input.sourceType || !SOURCE_TYPES.includes(input.sourceType)) {
    return reject(`Invalid sourceType: ${String(input.sourceType)}`);
  }
  const date = (input.conversationDate ?? '').trim() || todayIso();
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    return reject(`Invalid conversationDate (expected YYYY-MM-DD): ${String(input.conversationDate)}`);
  }
  const titleSeg = safeSegment(proposedTitle);
  if (!titleSeg) return reject('Empty or unsafe proposedTitle');

  const people = cleanList(input.people);
  const companies = cleanList(input.companies);
  const projects = cleanList(input.projects);
  const primaryRaw = people[0] ?? companies[0] ?? null;
  const primarySeg = primaryRaw ? safeSegment(primaryRaw) : '';

  // ── Filename resolution ─────────────────────────────────────────────────
  // Preferred: "YYYY-MM-DD — Primary — Type.md". Documented fallback when no person/company:
  // "YYYY-MM-DD — Conversation — <8-char fingerprint>.md".
  const baseName = primarySeg
    ? `${date} — ${primarySeg} — ${titleSeg}`
    : `${date} — Conversation — ${fingerprint.slice(0, 8)}`;
  const relPath = `${TARGET_FOLDER}/${baseName}.md`;

  // Guarantee the resolved path stays inside 06 Conversations (allowlist of exactly one folder).
  let finalAbs: string;
  let root: string;
  try {
    const r = getVaultRoot();
    if (!r) return reject('Vault root is not configured');
    root = r;
    finalAbs = assertSafeRelativePath(root, relPath, [TARGET_FOLDER]);
  } catch (err) {
    return reject(`Unsafe resolved path: ${(err as Error).message}`);
  }

  const dir = path.join(root, TARGET_FOLDER);
  // Confirm the vault + target folder are available and writable before doing anything.
  try {
    const st = fs.statSync(dir);
    if (!st.isDirectory()) throw new Error('not a directory');
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    const auditId = audit({
      approvalReference: input.approvalReference,
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      proposedTitle,
      relativePath: null,
      result: 'failed',
      verification: 'skipped',
      error: 'Vault unavailable or 06 Conversations not writable',
    });
    return { result: 'failed', reason: 'Vault unavailable or target folder not writable', auditId };
  }

  // ── Duplicate / idempotency ─────────────────────────────────────────────
  // Exact idempotent retry: a prior created row with the same key whose file still exists.
  if (input.idempotencyKey && input.idempotencyKey.trim()) {
    const prior = getDb()
      .prepare(
        `SELECT final_relative_path AS rel FROM conversation_filings
         WHERE idempotency_key = ? AND outcome = 'created' ORDER BY created_at DESC LIMIT 1`
      )
      .get(input.idempotencyKey.trim()) as { rel: string | null } | undefined;
    if (prior?.rel && fs.existsSync(path.join(root, prior.rel))) {
      const auditId = audit({
        approvalReference: input.approvalReference,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        proposedTitle,
        relativePath: prior.rel,
        result: 'already_exists',
        verification: 'skipped',
      });
      return { result: 'already_exists', relativePath: prior.rel, auditId };
    }
  }

  const existing = scanConversations(root, dir);
  const candidates = new Set<string>();

  // Target filename already taken: same content = idempotent already_exists; different = collision.
  if (fs.existsSync(finalAbs)) {
    const raw = fs.readFileSync(finalAbs, 'utf-8');
    const { frontmatter: existingFm } = parseFrontmatter(raw);
    if (existingFm.content_hash === fingerprint) {
      const auditId = audit({
        approvalReference: input.approvalReference,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        proposedTitle,
        relativePath: relPath,
        result: 'already_exists',
        verification: 'verified',
      });
      return { result: 'already_exists', relativePath: relPath, auditId };
    }
    candidates.add(relPath);
  }

  // Same source reference, or identical body content elsewhere → human decides (never overwrite).
  const srcRef = (input.sourceReference ?? '').trim();
  for (const n of existing) {
    if (srcRef && n.sourceReference && n.sourceReference === srcRef) candidates.add(n.rel);
    if (n.fingerprint === fingerprint) candidates.add(n.rel);
  }

  if (candidates.size > 0) {
    const list = [...candidates];
    const auditId = audit({
      approvalReference: input.approvalReference,
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      proposedTitle,
      relativePath: null,
      result: 'needs_review',
      verification: 'skipped',
      error: `Possible duplicate of: ${list.join(', ')}`,
    });
    return { result: 'needs_review', candidates: list, reason: 'Possible duplicate detected', auditId };
  }

  // ── Build content ───────────────────────────────────────────────────────
  const fm: string[] = [
    '---',
    `date: ${date}`,
    'type: conversation',
    `channel: ${yamlScalar(SOURCE_LABEL[input.sourceType])}`,
  ];
  const addList = (key: string, items: string[]): void => {
    if (items.length === 0) return;
    fm.push(`${key}:`);
    for (const it of items) fm.push(`  - ${yamlScalar(it)}`);
  };
  addList('people', people);
  addList('companies', companies);
  addList('projects', projects);
  fm.push(`source_reference: ${yamlScalar(srcRef || 'User-provided')}`);
  fm.push('status: filed');
  fm.push('review_status: human-approved');
  fm.push(`content_hash: ${fingerprint}`);
  fm.push('---');

  const headingPrimary = primaryRaw ?? 'Conversation';
  const body = input.reviewedMarkdown.replace(/\s+$/, '');
  // Add the H1 unless the reviewed body already opens with one (avoid a duplicate title; this is a
  // structural guard, not content repair).
  const opensWithH1 = /^\s*#\s+/.test(body);
  const heading = opensWithH1 ? '' : `# ${date} — ${headingPrimary} — ${proposedTitle.trim()}\n\n`;
  const content = `${fm.join('\n')}\n\n${heading}${body}\n`;

  // ── Atomic, verified write ──────────────────────────────────────────────
  const tmp = path.join(dir, `.${baseName}.tmp-${crypto.randomBytes(6).toString('hex')}`);
  try {
    const fd = fs.openSync(tmp, 'wx');
    try {
      fs.writeSync(fd, content);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    // Final race guard: never overwrite a note that appeared between the check and the rename.
    if (fs.existsSync(finalAbs)) {
      fs.unlinkSync(tmp);
      const auditId = audit({
        approvalReference: input.approvalReference,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        proposedTitle,
        relativePath: null,
        result: 'needs_review',
        verification: 'skipped',
        error: 'Target appeared during write',
      });
      return {
        result: 'needs_review',
        candidates: [relPath],
        reason: 'Target appeared during write',
        auditId,
      };
    }

    fs.renameSync(tmp, finalAbs); // atomic within the same directory

    const readBack = fs.readFileSync(finalAbs, 'utf-8');
    const hashOk = sha256(readBack) === sha256(content);
    const { frontmatter } = parseFrontmatter(readBack);
    const dateOk = typeof frontmatter.date === 'string' || frontmatter.date instanceof Date;
    const fmOk = frontmatter.type === 'conversation' && dateOk && Boolean(frontmatter.review_status);
    const verified = hashOk && fmOk;

    const auditId = audit({
      approvalReference: input.approvalReference,
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      proposedTitle,
      relativePath: relPath,
      result: verified ? 'created' : 'failed',
      verification: verified ? 'verified' : 'failed',
      error: verified ? undefined : 'Post-write verification failed (hash or frontmatter)',
    });

    if (!verified) {
      return { result: 'failed', relativePath: relPath, reason: 'Post-write verification failed', auditId };
    }
    return { result: 'created', relativePath: relPath, auditId };
  } catch (err) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* best effort temp cleanup */
    }
    const auditId = audit({
      approvalReference: input.approvalReference,
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      proposedTitle,
      relativePath: null,
      result: 'failed',
      verification: 'failed',
      error: (err as Error).message,
    });
    return { result: 'failed', reason: (err as Error).message, auditId };
  }
}
