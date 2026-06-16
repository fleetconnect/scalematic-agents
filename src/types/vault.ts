import { CapabilityState } from './capability';

// Read-only DTOs for the Obsidian vault (Plane B — durable business knowledge). Paths are
// always vault-relative; absolute filesystem paths are never exposed to the browser.

export interface VaultNoteSummary {
  path: string;
  title: string;
  folder: string;
  frontmatter: Record<string, unknown>;
  modifiedAt: string;
  // Note-level frontmatter health. 'invalid' means the YAML could not be parsed and the metadata
  // shown is filename-derived fallback, not confirmed frontmatter. Absent/'valid' = parsed cleanly.
  frontmatterStatus?: 'valid' | 'invalid';
  frontmatterError?: string;
}

export interface VaultNote extends VaultNoteSummary {
  body: string;
}

export interface SearchHit {
  path: string;
  title: string;
  folder: string;
  excerpt: string;
  score: number;
}

export interface ProjectSummary {
  path: string;
  title: string;
  status: string | null;
  phase: string | null;
  owner: string | null;
  nextAction: string | null;
  modifiedAt: string;
  staleDays: number;
  frontmatter: Record<string, unknown>;
}

export interface GoalSet {
  found: boolean;
  notes: VaultNoteSummary[];
}

export interface ConversationSummary {
  path: string;
  title: string;
  date: string | null;
  people: string[];
  companies: string[];
  modifiedAt: string;
  // 'invalid' means the note's frontmatter could not be parsed; date is filename-derived fallback
  // and people/companies are empty (not confirmed). Absent/'valid' = parsed cleanly.
  frontmatterStatus?: 'valid' | 'invalid';
}

export interface DailyNoteResult {
  found: boolean;
  date: string;
  note: VaultNote | null;
}

export interface VaultStatus {
  configured: boolean;
  reachable: boolean;
  rootLabel: string | null;
  approvedFolders: string[];
  state: CapabilityState;
  reason: string;
}
