import crypto from 'crypto';
import { getDb } from '../db/client';
import { logger } from '../utils/logger';
import { ConnectorId, ConnectorState, ReadResult } from '../types/integrations';

// Audit + sync-state for read-first connectors. Records source ids and freshness, never tokens or
// full sensitive content. Provides a wrapper that turns any read into a graceful ReadResult so one
// failing connector never throws into the morning brief.

export interface SyncState {
  connectorId: string;
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  lastFreshness: string | null;
  lastError: string | null;
}

// Keep audit error text short and free of credentials. Strip anything token-like.
function safeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/(access_token|refresh_token|client_secret|bearer|api[_-]?key)\S*/gi, '$1=<redacted>')
    .slice(0, 300);
}

export function recordAccess(row: {
  connectorId: ConnectorId;
  operation: string;
  sourceIds?: string[];
  result: 'success' | 'empty' | 'degraded' | 'error' | 'not_configured';
  error?: string;
  dataFreshness?: string | null;
  approvalReference?: string | null;
}): string {
  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO integration_access_log
        (id, connector_id, operation, source_ids, result, error, data_freshness, approval_reference, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      row.connectorId,
      row.operation,
      JSON.stringify(row.sourceIds ?? []),
      row.result,
      row.error ?? null,
      row.dataFreshness ?? null,
      row.approvalReference ?? null,
      new Date().toISOString()
    );
  return id;
}

export function getSyncState(connectorId: ConnectorId): SyncState | null {
  const row = getDb()
    .prepare('SELECT * FROM integration_sync_state WHERE connector_id = ?')
    .get(connectorId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    connectorId,
    lastSuccessfulSync: (row.last_successful_sync as string) ?? null,
    lastAttemptedSync: (row.last_attempted_sync as string) ?? null,
    lastFreshness: (row.last_freshness as string) ?? null,
    lastError: (row.last_error as string) ?? null,
  };
}

function setSyncState(
  connectorId: ConnectorId,
  patch: { success: boolean; freshness?: string | null; error?: string | null }
): void {
  const now = new Date().toISOString();
  const prev = getSyncState(connectorId);
  const lastSuccessful = patch.success ? now : prev?.lastSuccessfulSync ?? null;
  getDb()
    .prepare(
      `INSERT INTO integration_sync_state
         (connector_id, last_successful_sync, last_attempted_sync, last_freshness, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(connector_id) DO UPDATE SET
         last_successful_sync = excluded.last_successful_sync,
         last_attempted_sync = excluded.last_attempted_sync,
         last_freshness = excluded.last_freshness,
         last_error = excluded.last_error,
         updated_at = excluded.updated_at`
    )
    .run(
      connectorId,
      lastSuccessful,
      now,
      patch.freshness ?? prev?.lastFreshness ?? null,
      patch.success ? null : patch.error ?? null,
      now
    );
}

// Run a read operation with audit + sync-state + graceful degradation. The fn returns the data and
// its freshness; on throw or not_configured we return a ReadResult carrying state + reason, never
// throwing. The morning brief relies on this so one bad connector cannot block the others.
export async function runRead<T>(
  connectorId: ConnectorId,
  operation: string,
  emptyData: T,
  fn: () => Promise<{ state: ConnectorState; data: T; reason: string; freshness?: string | null; sourceIds?: string[] }>
): Promise<ReadResult<T>> {
  const fetchedAt = new Date().toISOString();
  try {
    const out = await fn();
    const result =
      out.state === 'available' ? 'success' : out.state === 'not_configured' ? 'not_configured' : 'degraded';
    setSyncState(connectorId, { success: out.state === 'available', freshness: out.freshness ?? null });
    recordAccess({
      connectorId,
      operation,
      sourceIds: out.sourceIds,
      result,
      dataFreshness: out.freshness ?? null,
    });
    return {
      connectorId,
      state: out.state,
      data: out.data,
      reason: out.reason,
      freshness: out.freshness ?? null,
      fetchedAt,
    };
  } catch (err) {
    const error = safeError(err);
    setSyncState(connectorId, { success: false, error });
    recordAccess({ connectorId, operation, result: 'error', error });
    logger.warn(`Connector ${connectorId} read '${operation}' failed: ${error}`);
    return {
      connectorId,
      state: 'degraded',
      data: emptyData,
      reason: `Read failed; continuing with other sources (${error})`,
      freshness: null,
      fetchedAt,
      error,
    };
  }
}
