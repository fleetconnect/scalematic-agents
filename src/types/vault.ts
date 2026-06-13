import { CapabilityState } from './capability';

// Read-only DTOs for the Obsidian vault (Plane B — durable business knowledge). Paths are
// always vault-relative; absolute filesystem paths are never exposed to the browser.

export interface VaultNoteSummary {
  path: string;
  title: string;
  folder: string;
  frontmatter: Record<string, unknown>;
  modifiedAt: string;
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
