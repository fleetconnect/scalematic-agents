import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import { publishEvent } from './eventBus';
import { EventType, OpportunityEvent } from '../types/opportunity';
import { logger } from '../utils/logger';

export function emitEvent(
  type: EventType,
  subjectId: string,
  options: {
    entityRef?: string;
    parentIds?: string[];
    payload?: Record<string, unknown>;
  } = {}
): OpportunityEvent {
  const db = getDb();
  const event: OpportunityEvent = {
    id: uuid(),
    type,
    entityRef: options.entityRef,
    subjectId,
    parentIds: options.parentIds ?? [],
    payload: options.payload ?? {},
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO opportunity_events (id, type, entity_ref, subject_id, parent_ids, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    event.id,
    event.type,
    event.entityRef ?? null,
    event.subjectId,
    JSON.stringify(event.parentIds),
    JSON.stringify(event.payload),
    event.createdAt
  );

  logger.info(`Event: ${type} (${subjectId})`);
  publishEvent(event);
  return event;
}

function rowToEvent(r: Record<string, unknown>): OpportunityEvent {
  return {
    id: r.id as string,
    type: r.type as EventType,
    entityRef: (r.entity_ref as string | null) ?? undefined,
    subjectId: r.subject_id as string,
    parentIds: JSON.parse(r.parent_ids as string),
    payload: JSON.parse(r.payload as string),
    createdAt: r.created_at as string,
  };
}

export function listEvents(limit = 100): OpportunityEvent[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM opportunity_events ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToEvent);
}

export function eventsForSubject(subjectId: string): OpportunityEvent[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM opportunity_events WHERE subject_id = ? ORDER BY created_at ASC')
    .all(subjectId) as Record<string, unknown>[];
  return rows.map(rowToEvent);
}
