import yaml from 'js-yaml';
import path from 'path';

// Read-only YAML frontmatter parsing. We parse to read metadata; we never re-dump or rewrite
// the source, so the operator's files are returned exactly as authored.

export class FrontmatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrontmatterError';
  }
}

export interface ParsedNote {
  frontmatter: Record<string, unknown>;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(raw: string): ParsedNote {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: {}, body: raw };

  let frontmatter: Record<string, unknown> = {};
  try {
    const loaded = yaml.load(match[1]);
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      frontmatter = loaded as Record<string, unknown>;
    }
  } catch (err) {
    throw new FrontmatterError(`Invalid YAML frontmatter: ${(err as Error).message}`);
  }

  return { frontmatter, body: raw.slice(match[0].length) };
}

export function deriveTitle(
  frontmatter: Record<string, unknown>,
  body: string,
  filePath: string
): string {
  const fmTitle = frontmatter.title;
  if (typeof fmTitle === 'string' && fmTitle.trim()) return fmTitle.trim();
  const heading = body.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return path.basename(filePath, path.extname(filePath));
}

// Coerce a frontmatter value that may be a string or an array of strings into a clean
// string array. Anything else yields an empty array — we never invent values.
export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string').map((v) => v.trim());
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function asStringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  // Unquoted YAML dates (e.g. `date: 2026-02-01`) load as Date objects. Normalize to a
  // YYYY-MM-DD string so date fields read cleanly and daily-note matching by date works.
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return String(value);
  return null;
}
