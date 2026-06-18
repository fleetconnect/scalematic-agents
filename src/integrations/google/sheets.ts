import {
  GoogleProvider,
  googleConfigReason,
  googleCredsPresent,
  kpiSheetId,
  loadGoogleProvider,
} from './googleAuth';
import { runRead } from '../integrationAudit';
import { KpiMetric, KpiSnapshot, ReadResult, SourceRef } from '../../types/integrations';

// Google Sheets KPI reader. The sheet is the source of truth for numbers; Hermes only reads.
// A blank cell is reported as present:false / value:null — never coerced to zero. No targets are
// invented. Sheet ownership is preserved (read-only scope).

export const KPI_METRICS: { key: string; label: string; aliases: string[] }[] = [
  { key: 'revenue', label: 'Revenue', aliases: ['revenue', 'gross revenue'] },
  { key: 'cash_collected', label: 'Cash collected', aliases: ['cash collected', 'collected'] },
  { key: 'expenses', label: 'Expenses', aliases: ['expenses', 'expense'] },
  { key: 'net_cash', label: 'Net cash', aliases: ['net cash', 'net'] },
  { key: 'leads_contacted', label: 'Leads contacted', aliases: ['leads contacted', 'leads'] },
  { key: 'emails_sent', label: 'Emails sent', aliases: ['emails sent', 'email sent'] },
  { key: 'linkedin_activity', label: 'LinkedIn activity', aliases: ['linkedin activity', 'linkedin'] },
  { key: 'replies', label: 'Replies', aliases: ['replies'] },
  { key: 'positive_replies', label: 'Positive replies', aliases: ['positive replies', 'positive reply'] },
  { key: 'meaningful_conversations', label: 'Meaningful conversations', aliases: ['meaningful conversations', 'conversations'] },
  { key: 'calls_booked', label: 'Calls booked', aliases: ['calls booked', 'booked'] },
  { key: 'calls_showed', label: 'Calls showed', aliases: ['calls showed', 'showed', 'shows'] },
  { key: 'offers_made', label: 'Offers made', aliases: ['offers made', 'offers'] },
  { key: 'deals_won', label: 'Deals won', aliases: ['deals won', 'wins', 'closed won'] },
  { key: 'average_deal_value', label: 'Average deal value', aliases: ['average deal value', 'avg deal value'] },
  { key: 'overdue_follow_ups', label: 'Overdue follow-ups', aliases: ['overdue follow-ups', 'overdue follow ups', 'overdue followups'] },
  { key: 'open_proposals', label: 'Open proposals', aliases: ['open proposals', 'proposals open'] },
  { key: 'stale_opportunities', label: 'Stale opportunities', aliases: ['stale opportunities', 'stale opps'] },
];

function norm(s: string): string {
  return s.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Parse a cell into a number, or null if blank/non-numeric. Blank is NOT zero. Strips $ , % and
// whitespace; supports parenthesised negatives like (1,200).
export function parseNumberCell(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const t = raw.trim();
  if (t === '') return null;
  const neg = /^\(.*\)$/.test(t);
  const cleaned = t.replace(/[(),$%\s]/g, '');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

// Pure: extract the 18 KPI metrics from a sheet's values. Finds a labelled cell and reads its
// right-neighbour (Metric | Value layout) or below-neighbour (header row over values row).
export function parseKpiValues(rows: string[][], source: SourceRef): KpiMetric[] {
  const index = new Map<string, { value: string | undefined }>();
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < (rows[r]?.length ?? 0); c++) {
      const cell = rows[r][c];
      if (typeof cell !== 'string' || !cell.trim()) continue;
      const right = rows[r][c + 1];
      const below = rows[r + 1]?.[c];
      index.set(norm(cell), { value: right ?? below });
    }
  }
  return KPI_METRICS.map((m) => {
    let cellValue: string | undefined;
    for (const alias of m.aliases) {
      const hit = index.get(norm(alias));
      if (hit) {
        cellValue = hit.value;
        break;
      }
    }
    const value = parseNumberCell(cellValue);
    return {
      key: m.key,
      label: m.label,
      value,
      present: value !== null,
      source,
    };
  });
}

const RANGE = 'A1:Z200';

export async function readKpiSnapshot(provider?: GoogleProvider): Promise<ReadResult<KpiSnapshot>> {
  const sheetId = kpiSheetId();
  const sourceBase: SourceRef = { system: 'Google Sheets', id: sheetId, detail: 'KPI sheet', freshness: null };
  const empty: KpiSnapshot = {
    state: 'not_configured',
    metrics: [],
    capturedAt: null,
    source: sourceBase,
    reason: 'KPI sheet not read',
  };
  return runRead('google-sheets', 'readKpiSnapshot', empty, async () => {
    if (!googleCredsPresent() || !sheetId) {
      const reason = !sheetId ? 'GOOGLE_KPI_SHEET_ID is not set' : googleConfigReason();
      return { state: 'not_configured', data: { ...empty, reason }, reason };
    }
    const p = provider ?? (await loadGoogleProvider());
    const rows = await p.getSheetValues(sheetId, RANGE);
    const capturedAt = new Date().toISOString();
    const source: SourceRef = { ...sourceBase, freshness: capturedAt };
    const metrics = parseKpiValues(rows, source);
    const presentCount = metrics.filter((m) => m.present).length;
    const snapshot: KpiSnapshot = {
      state: 'available',
      metrics,
      capturedAt,
      source,
      reason: `Read ${presentCount}/${metrics.length} KPI metrics from the sheet (blanks left null)`,
    };
    return {
      state: 'available',
      data: snapshot,
      reason: snapshot.reason,
      freshness: capturedAt,
      sourceIds: sheetId ? [sheetId] : [],
    };
  });
}
