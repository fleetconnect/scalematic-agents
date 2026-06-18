import {
  GoogleProvider,
  RawContact,
  googleConfigReason,
  googleCredsPresent,
  loadGoogleProvider,
} from './googleAuth';
import { runRead } from '../integrationAudit';
import { ContactMatch, ContactRecord, ReadResult, SourceRef } from '../../types/integrations';

// Google Contacts reader (read-only — no contact writes in this phase). Provides search, email/
// phone lookup, identity resolution, and duplicate detection. Duplicates are grouped only on a
// shared email or phone — never on name alone, so distinct people are not merged accidentally.

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}
export function normalizePhone(p: string): string {
  return p.replace(/[^\d+]/g, '').replace(/^\+?1(?=\d{10}$)/, '');
}

function toRecord(c: RawContact, freshness: string | null): ContactRecord {
  return {
    contactId: c.id,
    displayName: c.displayName,
    emails: c.emails.map(normalizeEmail).filter(Boolean),
    phones: c.phones.map(normalizePhone).filter(Boolean),
    source: { system: 'Google Contacts', id: c.id, detail: 'contact', freshness },
  };
}

// Pure: group records that share an email or phone (union-find). Distinct people who merely share
// a name are NOT grouped. Returns the flat record list plus groups of size > 1 as duplicates.
export function dedupeContacts(records: ContactRecord[]): { records: ContactRecord[]; duplicates: ContactRecord[][] } {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) ?? r;
    return r;
  };
  records.forEach((_, i) => parent.set(i, i));
  const byKey = new Map<string, number>();
  records.forEach((rec, i) => {
    for (const key of [...rec.emails.map((e) => `e:${e}`), ...rec.phones.map((p) => `p:${p}`)]) {
      if (byKey.has(key)) {
        const a = find(byKey.get(key) as number);
        const b = find(i);
        if (a !== b) parent.set(a, b);
      } else {
        byKey.set(key, i);
      }
    }
  });
  const groups = new Map<number, ContactRecord[]>();
  records.forEach((rec, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(rec);
  });
  return { records, duplicates: [...groups.values()].filter((g) => g.length > 1) };
}

export async function searchContacts(query: string, provider?: GoogleProvider): Promise<ReadResult<ContactMatch>> {
  const empty: ContactMatch = { query, matches: [], duplicates: [] };
  return runRead('google-contacts', 'searchContacts', empty, async () => {
    if (!googleCredsPresent()) {
      return { state: 'not_configured', data: empty, reason: googleConfigReason() };
    }
    const p = provider ?? (await loadGoogleProvider());
    const raw = await p.listContacts(query);
    const freshness = new Date().toISOString();
    const records = raw.map((c) => toRecord(c, freshness));
    const { duplicates } = dedupeContacts(records);
    return {
      state: 'available',
      data: { query, matches: records, duplicates },
      reason: `Found ${records.length} contact(s); ${duplicates.length} duplicate group(s)`,
      freshness,
      sourceIds: records.map((r) => r.contactId),
    };
  });
}

// Email/phone lookup + canonical person linking: resolve the single best identity for a query.
export async function lookupByEmail(email: string, provider?: GoogleProvider): Promise<ReadResult<ContactMatch>> {
  const res = await searchContacts(email, provider);
  const target = normalizeEmail(email);
  const matches = res.data.matches.filter((m) => m.emails.includes(target));
  return { ...res, data: { query: email, matches, duplicates: res.data.duplicates } };
}

export function asSourceRefs(records: ContactRecord[]): SourceRef[] {
  return records.map((r) => r.source);
}
