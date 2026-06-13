import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { SignalObject } from '../types/opportunity';
import { saveSignal, signalExistsByDedupKey } from '../opportunity/store';
import { scoreSignal } from '../opportunity/scoring';
import { emitEvent } from '../opportunity/eventLog';
import { logger } from '../utils/logger';
import { FmcsaAuthorityRecord, FmcsaProvider } from './fmcsaFieldMapping';
import { FmcsaOpenDataProvider } from './fmcsaOpenDataProvider';

export type { FmcsaAuthorityRecord, FmcsaProvider } from './fmcsaFieldMapping';

class FixtureProvider implements FmcsaProvider {
  async fetchNewAuthorities(): Promise<FmcsaAuthorityRecord[]> {
    const file = path.join(__dirname, 'fixtures', 'fmcsa-sample.json');
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw) as FmcsaAuthorityRecord[];
  }
}

// Keyless FMCSA Open Data (Socrata) is the live provider; the fixture keeps the
// loop runnable offline and is the default until the portal pull is verified.
// Select with FMCSA_PROVIDER=opendata.
export function getFmcsaProvider(): FmcsaProvider {
  const choice = (process.env.FMCSA_PROVIDER ?? 'fixture').toLowerCase();
  if (choice === 'opendata') return new FmcsaOpenDataProvider();
  return new FixtureProvider();
}

function providerDegraded(provider: FmcsaProvider): boolean {
  const maybe = provider as { degraded?: () => boolean };
  return typeof maybe.degraded === 'function' ? maybe.degraded() : false;
}

// Rules-first filtering (structured source — don't waste LLM calls).
// Minimum fleet size keeps single-truck owner-operators out of the for-hire ICP.
const MIN_POWER_UNITS = 2;

function entityRefFor(rec: FmcsaAuthorityRecord): string {
  const slug = (rec.dba_name ?? rec.legal_name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `company:${slug}-${rec.dot_number}`;
}

function recordToSignal(rec: FmcsaAuthorityRecord): SignalObject {
  const now = new Date().toISOString();
  const fleet = rec.power_units;
  const specificity = Math.min(1, 0.5 + fleet / 40); // bigger fleet = more specific buying condition

  const signal: SignalObject = {
    id: uuid(),
    source: 'fmcsa',
    signalType: 'expansion',
    entityRefs: [entityRefFor(rec)],
    rawEvidence: `New ${rec.authority_type} operating authority granted ${rec.authority_granted_date} to ${rec.legal_name}${rec.dba_name ? ` (DBA ${rec.dba_name})` : ''} in ${rec.phy_city}, ${rec.phy_state}: ${fleet} power units, ${rec.drivers} drivers, hauling ${rec.cargo_carried.join(', ')}.`,
    evidenceUrl: `https://safer.fmcsa.dot.gov/CompanySnapshot.aspx?dot=${rec.dot_number}`,
    detectedAt: rec.authority_granted_date,
    freshnessHalflifeDays: 90, // new-MC-authority window per architecture section 2.2
    confidence: 0.9, // structured government record
    firstParty: true, // their own filing
    metadata: { ...rec },
    createdAt: now,
  };
  signal.score = scoreSignal(signal, { specificity, corroborationCount: 1 });
  return signal;
}

export interface SentinelRunResult {
  fetched: number;
  filtered: number;
  newSignals: number;
  duplicates: number;
  degraded: boolean;
  signals: SignalObject[];
}

export async function runFmcsaSentinel(
  options: { sinceIso?: string } = {}
): Promise<SentinelRunResult> {
  const since = options.sinceIso ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
  const provider = getFmcsaProvider();
  const records = await provider.fetchNewAuthorities(since);
  const degraded = providerDegraded(provider);

  const passing = records.filter((r) => r.power_units >= MIN_POWER_UNITS);

  const emitted: SignalObject[] = [];
  let duplicates = 0;

  for (const rec of passing) {
    const dedupKey = `fmcsa:${rec.docket_number}`;
    if (signalExistsByDedupKey(dedupKey)) {
      duplicates++;
      continue;
    }
    const signal = recordToSignal(rec);
    saveSignal(signal, dedupKey);
    emitEvent('signal.detected', signal.id, {
      entityRef: signal.entityRefs[0],
      payload: { source: 'fmcsa', score: signal.score, docket: rec.docket_number },
    });
    emitted.push(signal);
  }

  logger.info(
    `FMCSA sentinel: fetched ${records.length}, passed filter ${passing.length}, new ${emitted.length}, dup ${duplicates}${degraded ? ', DEGRADED (source outage)' : ''}`
  );

  return {
    fetched: records.length,
    filtered: passing.length,
    newSignals: emitted.length,
    duplicates,
    degraded,
    signals: emitted,
  };
}
