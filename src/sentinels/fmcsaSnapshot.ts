import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Local snapshot of the last successful FMCSA pull. The diff between the prior
// snapshot's docket set and the current pull is what defines a "new authority"
// signal. Stored under data/ (git-ignored). A corrupt or absent snapshot is a
// cold start, not an error — the provider treats first-run dockets as new but the
// SoQL since-window bounds that set, and DB dedup is the final backstop.

const SNAPSHOT_DIR = path.join(__dirname, '../../data/fmcsa-snapshots');

export interface FmcsaSnapshot {
  capturedAt: string;
  dockets: string[];
}

function snapshotPath(name: string): string {
  return path.join(SNAPSHOT_DIR, `${name}.json`);
}

export function readSnapshot(name: string): FmcsaSnapshot | null {
  const file = snapshotPath(name);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as FmcsaSnapshot;
    if (!Array.isArray(parsed.dockets)) return null;
    return parsed;
  } catch (err) {
    logger.warn('FMCSA snapshot unreadable, treating as cold start', {
      name,
      error: String(err),
    });
    return null;
  }
}

export function writeSnapshot(name: string, dockets: string[]): void {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const prior = snapshotPath(name);
  if (fs.existsSync(prior)) {
    fs.copyFileSync(prior, snapshotPath(`${name}.prev`));
  }
  const snapshot: FmcsaSnapshot = {
    capturedAt: new Date().toISOString(),
    dockets: [...new Set(dockets)].sort(),
  };
  fs.writeFileSync(snapshotPath(name), JSON.stringify(snapshot, null, 2));
}

// Dockets present in the current pull but absent from the prior snapshot.
export function diffNewDockets(prior: FmcsaSnapshot | null, currentDockets: string[]): Set<string> {
  const priorSet = new Set(prior?.dockets ?? []);
  const out = new Set<string>();
  for (const d of currentDockets) {
    if (d && !priorSet.has(d)) out.add(d);
  }
  return out;
}
