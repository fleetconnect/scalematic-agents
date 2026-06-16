import fs from 'fs';
import path from 'path';
import {
  ConversationSummary,
  DailyNoteResult,
  GoalSet,
  ProjectSummary,
  SearchHit,
  VaultNote,
  VaultNoteSummary,
  VaultStatus,
} from '../types/vault';
import { APPROVED_FOLDERS, FOLDER, getVaultRoot } from './vaultConfig';
import {
  asStringArray,
  asStringOrNull,
  dateFromFilename,
  deriveTitle,
  tryParseFrontmatter,
} from './frontmatter';
import { logger } from '../utils/logger';
import {
  assertMarkdownPath,
  assertSafeRelativePath,
  isMarkdownPath,
  toVaultRelative,
  VaultPathError,
} from './pathSafety';

// Read-first vault adapter. It never writes, renames, moves, merges, or deletes. Every public
// read either returns normalized data or throws a clear, typed error the API surfaces verbatim.
// Absolute filesystem paths never leave this module — callers see vault-relative paths only.

export class VaultUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultUnavailableError';
  }
}

interface ResolvedRoot {
  root: string;
}

function requireReadableRoot(): ResolvedRoot {
  const root = getVaultRoot();
  if (!root) {
    throw new VaultUnavailableError('Vault root is not configured (set VAULT_ROOT)');
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(root);
  } catch {
    throw new VaultUnavailableError(`Vault root is unreachable: ${path.basename(root)}`);
  }
  if (!stat.isDirectory()) {
    throw new VaultUnavailableError('Vault root is not a directory');
  }
  try {
    fs.accessSync(root, fs.constants.R_OK);
  } catch {
    throw new VaultUnavailableError('Vault root is not readable (permission denied)');
  }
  return { root };
}

export function getVaultStatus(): VaultStatus {
  const root = getVaultRoot();
  if (!root) {
    return {
      configured: false,
      reachable: false,
      rootLabel: null,
      approvedFolders: APPROVED_FOLDERS,
      state: 'not_configured',
      reason: 'VAULT_ROOT is not configured',
    };
  }
  try {
    const stat = fs.statSync(root);
    if (!stat.isDirectory()) {
      return {
        configured: true,
        reachable: false,
        rootLabel: path.basename(root),
        approvedFolders: APPROVED_FOLDERS,
        state: 'degraded',
        reason: 'Configured vault root is not a directory',
      };
    }
    fs.accessSync(root, fs.constants.R_OK);
    const presentFolders = APPROVED_FOLDERS.filter((f) => {
      try {
        return fs.statSync(path.join(root, f)).isDirectory();
      } catch {
        return false;
      }
    });
    if (presentFolders.length === 0) {
      return {
        configured: true,
        reachable: true,
        rootLabel: path.basename(root),
        approvedFolders: APPROVED_FOLDERS,
        state: 'degraded',
        reason: 'Vault root is reachable but none of the approved folders are present',
      };
    }
    return {
      configured: true,
      reachable: true,
      rootLabel: path.basename(root),
      approvedFolders: APPROVED_FOLDERS,
      state: 'available',
      reason: `Vault reachable; ${presentFolders.length}/${APPROVED_FOLDERS.length} approved folders present`,
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      rootLabel: path.basename(root),
      approvedFolders: APPROVED_FOLDERS,
      state: 'degraded',
      reason: 'Configured vault root is unreachable or not readable',
    };
  }
}

// Recursively collect markdown files under an approved folder. Symlinks are skipped (never
// followed). A missing folder yields an empty list, not an error — an empty folder is a valid,
// honest state.
function collectMarkdownFiles(root: string, folder: string): string[] {
  const start = path.join(root, folder);
  const out: string[] = [];
  let rootStat: fs.Stats;
  try {
    rootStat = fs.lstatSync(start);
  } catch {
    return out;
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return out;

  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && isMarkdownPath(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(start);
  return out;
}

// Bounded warning for malformed notes: log each affected vault-relative path once per process so a
// single bad note does not flood logs on every request. Absolute paths are never logged.
const warnedInvalidNotes = new Set<string>();
function warnInvalidNote(rel: string, error?: string): void {
  if (warnedInvalidNotes.has(rel)) return;
  warnedInvalidNotes.add(rel);
  logger.warn(`Vault note has invalid frontmatter; using fallback metadata: ${rel}${error ? ` (${error})` : ''}`);
}

function summarizeFile(root: string, absPath: string): VaultNoteSummary {
  const raw = fs.readFileSync(absPath, 'utf-8');
  const parsed = tryParseFrontmatter(raw);
  const rel = toVaultRelative(root, absPath);
  const summary: VaultNoteSummary = {
    path: rel,
    title: deriveTitle(parsed.frontmatter, parsed.body, absPath),
    folder: rel.split('/')[0] ?? '',
    frontmatter: parsed.frontmatter,
    modifiedAt: fs.statSync(absPath).mtime.toISOString(),
  };
  if (!parsed.valid) {
    warnInvalidNote(rel, parsed.error);
    summary.frontmatterStatus = 'invalid';
    summary.frontmatterError = 'Frontmatter could not be parsed; filename-derived fallback used';
  }
  return summary;
}

export function readNote(relativePath: string): VaultNote {
  const { root } = requireReadableRoot();
  assertMarkdownPath(relativePath);
  const abs = assertSafeRelativePath(root, relativePath, APPROVED_FOLDERS);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(abs);
  } catch {
    throw new VaultPathError(`Note not found: ${relativePath}`);
  }
  if (stat.isSymbolicLink()) throw new VaultPathError('Refusing to read a symbolic link');
  if (!stat.isFile()) throw new VaultPathError(`Not a file: ${relativePath}`);

  const raw = fs.readFileSync(abs, 'utf-8');
  const parsed = tryParseFrontmatter(raw);
  const rel = toVaultRelative(root, abs);
  const note: VaultNote = {
    path: rel,
    title: deriveTitle(parsed.frontmatter, parsed.body, abs),
    folder: rel.split('/')[0] ?? '',
    frontmatter: parsed.frontmatter,
    modifiedAt: stat.mtime.toISOString(),
    body: parsed.body,
  };
  if (!parsed.valid) {
    warnInvalidNote(rel, parsed.error);
    note.frontmatterStatus = 'invalid';
    note.frontmatterError = 'Frontmatter could not be parsed; filename-derived fallback used';
  }
  return note;
}

function foldersToScan(folder?: string): string[] {
  if (folder) {
    if (!APPROVED_FOLDERS.includes(folder)) {
      throw new VaultPathError(`Folder not in the approved allowlist: ${folder}`);
    }
    return [folder];
  }
  return APPROVED_FOLDERS;
}

export function listNotes(folder?: string): VaultNoteSummary[] {
  const { root } = requireReadableRoot();
  const summaries: VaultNoteSummary[] = [];
  for (const f of foldersToScan(folder)) {
    for (const abs of collectMarkdownFiles(root, f)) {
      summaries.push(summarizeFile(root, abs));
    }
  }
  return summaries;
}

export function recentNotes(limit = 25, folder?: string): VaultNoteSummary[] {
  const all = listNotes(folder);
  all.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return all.slice(0, Math.max(0, limit));
}

export function searchNotes(query: string, folder?: string, limit = 50): SearchHit[] {
  const { root } = requireReadableRoot();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];

  for (const f of foldersToScan(folder)) {
    for (const abs of collectMarkdownFiles(root, f)) {
      const raw = fs.readFileSync(abs, 'utf-8');
      const parsed = tryParseFrontmatter(raw);
      if (!parsed.valid) warnInvalidNote(toVaultRelative(root, abs), parsed.error);
      const { frontmatter, body } = parsed;
      const title = deriveTitle(frontmatter, body, abs);
      const hayBody = body.toLowerCase();
      const hayTitle = title.toLowerCase();
      const titleHit = hayTitle.includes(q);
      const bodyIdx = hayBody.indexOf(q);
      if (!titleHit && bodyIdx < 0) continue;

      const score = (titleHit ? 10 : 0) + (bodyIdx >= 0 ? 1 : 0);
      const rel = toVaultRelative(root, abs);
      let excerpt = '';
      if (bodyIdx >= 0) {
        const start = Math.max(0, bodyIdx - 60);
        excerpt = body.slice(start, bodyIdx + q.length + 60).replace(/\s+/g, ' ').trim();
      } else {
        excerpt = body.replace(/\s+/g, ' ').trim().slice(0, 120);
      }
      hits.push({ path: rel, title, folder: rel.split('/')[0] ?? '', excerpt, score });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return hits.slice(0, Math.max(0, limit));
}

function staleDays(modifiedAtIso: string): number {
  const then = new Date(modifiedAtIso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

export function projectSummaries(): ProjectSummary[] {
  const notes = listNotes(FOLDER.projects);
  return notes
    .map((n) => ({
      path: n.path,
      title: n.title,
      status: asStringOrNull(n.frontmatter.status),
      phase: asStringOrNull(n.frontmatter.phase),
      owner: asStringOrNull(n.frontmatter.owner),
      nextAction:
        asStringOrNull(n.frontmatter.next_action) ?? asStringOrNull(n.frontmatter.nextAction),
      modifiedAt: n.modifiedAt,
      staleDays: staleDays(n.modifiedAt),
      frontmatter: n.frontmatter,
    }))
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

// Goals are not yet a fixed file in the vault. We identify a goals note by frontmatter
// type/tags or a title containing "goals", scanning approved folders. If none exist we report
// found:false rather than inventing anything.
export function goals(): GoalSet {
  const notes = listNotes();
  const matches = notes.filter((n) => {
    const type = asStringOrNull(n.frontmatter.type)?.toLowerCase() ?? '';
    const tags = asStringArray(n.frontmatter.tags).map((t) => t.toLowerCase());
    return (
      type.includes('goal') ||
      tags.includes('goals') ||
      tags.includes('goal') ||
      /goals?/i.test(n.title)
    );
  });
  return { found: matches.length > 0, notes: matches };
}

export function conversations(): ConversationSummary[] {
  const notes = listNotes(FOLDER.conversations);
  return notes
    .map((n) => {
      const invalid = n.frontmatterStatus === 'invalid';
      // For malformed notes, frontmatter is empty; fall back to the filename date and leave
      // people/companies empty rather than presenting unconfirmed values.
      const date = asStringOrNull(n.frontmatter.date) ?? (invalid ? dateFromFilename(n.path) : null);
      return {
        path: n.path,
        title: n.title,
        date,
        people: asStringArray(n.frontmatter.people),
        companies: asStringArray(n.frontmatter.companies),
        modifiedAt: n.modifiedAt,
        ...(invalid ? { frontmatterStatus: 'invalid' as const } : {}),
      };
    })
    .sort((a, b) => (b.date ?? b.modifiedAt).localeCompare(a.date ?? a.modifiedAt));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Daily note lookup is by date (YYYY-MM-DD). We match a note in 09 Daily Notes whose filename
// or frontmatter date contains the requested day. Missing is a valid state (found:false).
export function dailyNote(date?: string): DailyNoteResult {
  const target = (date ?? todayIso()).trim();
  const notes = listNotes(FOLDER.daily);
  const match = notes.find((n) => {
    const fmDate = asStringOrNull(n.frontmatter.date);
    return n.path.includes(target) || n.title.includes(target) || fmDate === target;
  });
  if (!match) return { found: false, date: target, note: null };
  return { found: true, date: target, note: readNote(match.path) };
}
