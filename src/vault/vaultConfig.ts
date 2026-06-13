// Vault access configuration. The backend may only read the single approved vault root from
// configuration, and only within the approved folder allowlist. This module is the one place
// that knows where the vault lives and which folders are readable.

// The canonical durable-knowledge store. Overridable via VAULT_ROOT so the host can relocate
// it; defaults to the verified Obsidian vault path so the system runs out of the box.
const DEFAULT_VAULT_ROOT =
  '/Users/fleetconnect/Library/Mobile Documents/iCloud~md~obsidian/Documents/scalematic';

export function getVaultRoot(): string | null {
  const fromEnv = process.env.VAULT_ROOT?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_VAULT_ROOT;
}

// Reads are restricted to these folders. 99 Archive and root governance files are intentionally
// excluded. This is an allowlist, not a denylist: anything not listed is unreadable.
export const APPROVED_FOLDERS = [
  '00 Inbox',
  '01 People',
  '02 Companies',
  '03 Projects',
  '05 Decisions',
  '06 Conversations',
  '07 Content',
  '08 Systems',
  '09 Daily Notes',
];

export const FOLDER = {
  inbox: '00 Inbox',
  people: '01 People',
  companies: '02 Companies',
  projects: '03 Projects',
  decisions: '05 Decisions',
  conversations: '06 Conversations',
  content: '07 Content',
  systems: '08 Systems',
  daily: '09 Daily Notes',
} as const;

export const MARKDOWN_EXTENSIONS = ['.md'];
