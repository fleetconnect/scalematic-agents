// SINGLE MIGRATION POINT for the FMCSA open-data feed.
//
// FMCSA is moving registration onto the MOTUS system through 2026; the source
// dataset ids and column names will change. Everything the provider knows about
// the wire format — dataset ids, SoQL column names, raw-row shape, raw->internal
// mapping, code lookups, and join normalization — lives in THIS file and nowhere
// else. When MOTUS lands, add a new SchemaProfile below and point ACTIVE_PROFILE
// at it; the provider, snapshot, and sentinel code do not change.
//
// Schema below was verified live against data.transportation.gov (2026-06-12):
//   Company Census            az4n-8mr2  (dated driver: add_date YYYYMMDD + fleet/location/cargo)
//   Entities w/ Op. Authority 6eyk-hxee  (dba + common/contract/broker status flags; A = active)

export interface FmcsaAuthorityRecord {
  dot_number: string;
  docket_number: string;
  legal_name: string;
  dba_name: string | null;
  authority_granted_date: string;
  authority_type: string;
  phy_city: string;
  phy_state: string;
  power_units: number;
  drivers: number;
  email?: string;
  operation_classification: string;
  cargo_carried: string[];
}

export interface FmcsaProvider {
  fetchNewAuthorities(sinceIso: string): Promise<FmcsaAuthorityRecord[]>;
}

// DOT public data portal. Socrata SoQL endpoints are keyless; an app token only
// raises the rate limit and is optional. No auth is sent.
export const DOT_DATA_PORTAL_BASE =
  process.env.FMCSA_PORTAL_BASE ?? 'https://data.transportation.gov/resource';

// Socrata dataset ids (the 4x4 identifiers on data.transportation.gov). Env-overridable
// precisely because the MOTUS migration is expected to reissue them.
export const CENSUS_DATASET_ID = process.env.FMCSA_CENSUS_DATASET ?? 'az4n-8mr2';
export const AUTHORITY_DATASET_ID = process.env.FMCSA_AUTHORITY_DATASET ?? '6eyk-hxee';

interface SchemaProfile {
  id: string;
  // Authority dataset is the primary snapshot-diff source: it has no date column, so a docket
  // appearing as active today that was absent yesterday IS the new-authority event.
  authority: {
    dotNumber: string;
    docketNumber: string;
    legalName: string;
    dbaName: string;
    city: string;
    state: string;
    commonStat: string;
    contractStat: string;
    brokerStat: string;
  };
  // Census enriches confirmed records with fleet size, operation class and cargo, joined on DOT.
  census: {
    dotNumber: string;
    powerUnits: string;
    drivers: string;
    operationClassification: string;
    cargo: string;
    city: string;
    state: string;
    addDate: string;
  };
  // Code -> human label for census carrier_operation.
  operationLabels: Record<string, string>;
  activeStatusCode: string;
}

const LEGACY_PROFILE: SchemaProfile = {
  id: 'legacy-2025',
  authority: {
    dotNumber: 'dot_number',
    docketNumber: 'docket_number',
    legalName: 'legal_name',
    dbaName: 'dba_name',
    city: 'bus_city',
    state: 'bus_state_code',
    commonStat: 'common_stat',
    contractStat: 'contract_stat',
    brokerStat: 'broker_stat',
  },
  census: {
    dotNumber: 'dot_number',
    powerUnits: 'power_units',
    drivers: 'total_drivers',
    operationClassification: 'carrier_operation',
    cargo: 'crgo_cargoothr_desc',
    city: 'phy_city',
    state: 'phy_state',
    addDate: 'add_date',
  },
  operationLabels: {
    A: 'Interstate',
    B: 'Intrastate Hazmat',
    C: 'Intrastate Non-Hazmat',
  },
  activeStatusCode: 'A',
};

// MOTUS 2026 lands here as a second profile, then ACTIVE_PROFILE flips. No other file changes.
const PROFILES: Record<string, SchemaProfile> = { [LEGACY_PROFILE.id]: LEGACY_PROFILE };

export const ACTIVE_PROFILE: SchemaProfile =
  PROFILES[process.env.FMCSA_SCHEMA_PROFILE ?? LEGACY_PROFILE.id] ?? LEGACY_PROFILE;

export type RawRow = Record<string, unknown>;

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function num(v: unknown): number {
  const n = Number(str(v));
  return Number.isFinite(n) ? n : 0;
}

function nullableStr(v: unknown): string | null {
  const s = str(v);
  return s.length ? s : null;
}

function splitCargo(v: unknown): string[] {
  const s = str(v);
  if (!s || s.toUpperCase() === 'UNSPECIFIED') return [];
  return s
    .split(/[,;|]/)
    .map((c) => c.trim())
    .filter(Boolean);
}

// FMCSA census add_date is YYYYMMDD text; render ISO date for evidence and signal timestamps.
function isoFromYyyymmdd(raw: string): string {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : raw;
}

export function censusDotNumberField(): string {
  return ACTIVE_PROFILE.census.dotNumber;
}

export function authorityDotNumberField(): string {
  return ACTIVE_PROFILE.authority.dotNumber;
}

// SoQL predicate selecting rows that hold at least one active operating-authority class.
export function activeAuthorityWhere(): string {
  const a = ACTIVE_PROFILE.authority;
  const code = ACTIVE_PROFILE.activeStatusCode;
  return `${a.commonStat}='${code}' OR ${a.contractStat}='${code}' OR ${a.brokerStat}='${code}'`;
}

// DOT numbers are zero-padded in the authority dataset and unpadded in census. Join on the
// normalized (zero-stripped) form.
export function normalizeDot(v: unknown): string {
  return str(v).replace(/\D/g, '').replace(/^0+/, '');
}

// True when the authority row shows at least one active operating-authority class.
export function hasActiveAuthority(raw: RawRow): boolean {
  const a = ACTIVE_PROFILE.authority;
  const active = ACTIVE_PROFILE.activeStatusCode;
  return (
    str(raw[a.commonStat]) === active ||
    str(raw[a.contractStat]) === active ||
    str(raw[a.brokerStat]) === active
  );
}

function deriveAuthorityType(raw: RawRow): string {
  const a = ACTIVE_PROFILE.authority;
  const active = ACTIVE_PROFILE.activeStatusCode;
  const types: string[] = [];
  if (str(raw[a.commonStat]) === active) types.push('Common');
  if (str(raw[a.contractStat]) === active) types.push('Contract');
  if (str(raw[a.brokerStat]) === active) types.push('Broker');
  return types.join('/') || 'Unknown';
}

// Maps one authority-dataset row to the internal record. Fleet/operation/cargo are census-only
// and filled by mergeCensus; detectedIso (the diff-detection date) stands in for the grant date
// because the public authority dataset carries no grant-date column.
export function mapAuthorityRow(raw: RawRow, detectedIso: string): FmcsaAuthorityRecord {
  const a = ACTIVE_PROFILE.authority;
  return {
    dot_number: str(raw[a.dotNumber]),
    docket_number: str(raw[a.docketNumber]),
    legal_name: str(raw[a.legalName]),
    dba_name: nullableStr(raw[a.dbaName]),
    authority_granted_date: detectedIso.slice(0, 10),
    authority_type: deriveAuthorityType(raw),
    phy_city: str(raw[a.city]),
    phy_state: str(raw[a.state]),
    power_units: 0,
    drivers: 0,
    operation_classification: '',
    cargo_carried: [],
  };
}

// Folds census fields onto an authority-derived record (joined on normalized DOT). Prefers the
// census physical address and uses the census add_date as the recorded operation start when present.
export function mergeCensus(record: FmcsaAuthorityRecord, raw: RawRow): FmcsaAuthorityRecord {
  const c = ACTIVE_PROFILE.census;
  const opCode = str(raw[c.operationClassification]);
  const addIso = isoFromYyyymmdd(str(raw[c.addDate]));
  return {
    ...record,
    power_units: num(raw[c.powerUnits]),
    drivers: num(raw[c.drivers]),
    operation_classification: ACTIVE_PROFILE.operationLabels[opCode] ?? opCode,
    cargo_carried: splitCargo(raw[c.cargo]),
    phy_city: str(raw[c.city]) || record.phy_city,
    phy_state: str(raw[c.state]) || record.phy_state,
    authority_granted_date: addIso || record.authority_granted_date,
  };
}
