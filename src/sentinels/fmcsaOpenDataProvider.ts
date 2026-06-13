import axios from 'axios';
import { logger } from '../utils/logger';
import {
  ACTIVE_PROFILE,
  AUTHORITY_DATASET_ID,
  CENSUS_DATASET_ID,
  DOT_DATA_PORTAL_BASE,
  FmcsaAuthorityRecord,
  FmcsaProvider,
  RawRow,
  activeAuthorityWhere,
  authorityDotNumberField,
  censusDotNumberField,
  hasActiveAuthority,
  mapAuthorityRow,
  mergeCensus,
  normalizeDot,
} from './fmcsaFieldMapping';
import { diffNewDockets, readSnapshot, writeSnapshot } from './fmcsaSnapshot';

// Keyless daily pull of the DOT data portal (Socrata). The Entities-with-Operating-Authority
// dataset has no grant-date column, so a docket that is active today and was absent from
// yesterday's snapshot IS the new-authority event. The provider:
//   1. pages the full set of active-authority dockets (light: docket numbers only)
//   2. diffs that set against the prior local snapshot -> newly-active dockets
//   3. re-queries authority detail for just the new dockets and enriches with Company Census
//      (fleet size, operation class, cargo) joined on DOT number
//   4. writes the new snapshot
// FMCSA has whole-day file outages (404s). Any fetch failure logs, degrades to an empty result,
// and leaves the prior snapshot intact so the next run resumes cleanly — it never throws.

const SNAPSHOT_NAME = 'operating-authority';
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_LIMIT = Number(process.env.FMCSA_PAGE_LIMIT ?? 50_000);
const MAX_PAGES = Number(process.env.FMCSA_MAX_PAGES ?? 200);
const DETAIL_CHUNK = 100;

function resourceUrl(datasetId: string): string {
  return `${DOT_DATA_PORTAL_BASE}/${datasetId}.json`;
}

export class FmcsaOpenDataProvider implements FmcsaProvider {
  private degradedLastRun = false;

  degraded(): boolean {
    return this.degradedLastRun;
  }

  async fetchNewAuthorities(_sinceIso: string): Promise<FmcsaAuthorityRecord[]> {
    this.degradedLastRun = false;

    const currentDockets = await this.fetchActiveDocketSet();
    if (currentDockets === null) return [];

    const prior = readSnapshot(SNAPSHOT_NAME);
    const newDockets = diffNewDockets(prior, [...currentDockets]);
    writeSnapshot(SNAPSHOT_NAME, [...currentDockets]);

    if (prior === null) {
      // Cold start: establish the baseline, emit nothing. The whole active set is not "new".
      logger.info(`FMCSA open-data: baseline snapshot established (${currentDockets.size} dockets)`);
      return [];
    }

    if (!newDockets.size) return [];

    const detail = await this.fetchAuthorityDetail([...newDockets]);
    if (detail === null) return [];

    return this.enrichWithCensus(detail);
  }

  private async fetchActiveDocketSet(): Promise<Set<string> | null> {
    const docketField = ACTIVE_PROFILE.authority.docketNumber;
    const dockets = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const rows = await this.fetchJson(resourceUrl(AUTHORITY_DATASET_ID), {
        $select: docketField,
        $where: activeAuthorityWhere(),
        $order: docketField,
        $limit: PAGE_LIMIT,
        $offset: page * PAGE_LIMIT,
      });
      if (rows === null) return null;
      for (const r of rows) {
        const d = String(r[docketField] ?? '').trim();
        if (d) dockets.add(d);
      }
      if (rows.length < PAGE_LIMIT) return dockets;
    }

    logger.warn('FMCSA open-data: MAX_PAGES reached; docket set may be truncated', {
      maxPages: MAX_PAGES,
    });
    return dockets;
  }

  private async fetchAuthorityDetail(dockets: string[]): Promise<FmcsaAuthorityRecord[] | null> {
    const docketField = ACTIVE_PROFILE.authority.docketNumber;
    const detectedIso = new Date().toISOString();
    const out: FmcsaAuthorityRecord[] = [];

    for (let i = 0; i < dockets.length; i += DETAIL_CHUNK) {
      const chunk = dockets.slice(i, i + DETAIL_CHUNK);
      const inList = chunk.map((d) => `'${d}'`).join(',');
      const rows = await this.fetchJson(resourceUrl(AUTHORITY_DATASET_ID), {
        $where: `${docketField} in (${inList})`,
        $limit: DETAIL_CHUNK,
      });
      if (rows === null) return null;
      for (const row of rows) {
        if (!hasActiveAuthority(row)) continue;
        out.push(mapAuthorityRow(row, detectedIso));
      }
    }

    return out;
  }

  private async enrichWithCensus(
    records: FmcsaAuthorityRecord[]
  ): Promise<FmcsaAuthorityRecord[]> {
    const dotField = censusDotNumberField();
    const dots = [...new Set(records.map((r) => normalizeDot(r.dot_number)).filter(Boolean))];
    const censusByDot = new Map<string, RawRow>();

    for (let i = 0; i < dots.length; i += DETAIL_CHUNK) {
      const chunk = dots.slice(i, i + DETAIL_CHUNK);
      const inList = chunk.map((d) => `'${d}'`).join(',');
      const rows = await this.fetchJson(resourceUrl(CENSUS_DATASET_ID), {
        $where: `${dotField} in (${inList})`,
        $limit: DETAIL_CHUNK,
      });
      if (rows === null) {
        // Census outage: emit authority-only records rather than dropping confirmed new
        // authorities. The sentinel's fleet-size filter holds back power_units=0 until census returns.
        logger.warn('FMCSA census enrichment degraded; emitting authority-only records', {
          chunkStart: i,
        });
        break;
      }
      for (const row of rows) {
        const dot = normalizeDot(row[dotField]);
        if (dot) censusByDot.set(dot, row);
      }
    }

    return records.map((r) => {
      const census = censusByDot.get(normalizeDot(r.dot_number));
      return census ? mergeCensus(r, census) : r;
    });
  }

  private async fetchJson(url: string, params: Record<string, unknown>): Promise<RawRow[] | null> {
    try {
      const res = await axios.get<RawRow[]>(url, {
        params,
        timeout: REQUEST_TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      });
      if (!Array.isArray(res.data)) {
        logger.error('FMCSA open-data returned a non-array body; degrading', { url });
        this.degradedLastRun = true;
        return null;
      }
      return res.data;
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      // 404 is the documented daily-file outage signature; treat all fetch failures the same:
      // log, degrade, return null so the run resumes next cycle without crashing.
      logger.error('FMCSA open-data fetch failed; degrading this run', {
        url,
        status: status ?? 'network',
        error: String(err),
      });
      this.degradedLastRun = true;
      return null;
    }
  }
}
