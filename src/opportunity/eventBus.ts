import { EventEmitter } from 'events';
import { OpportunityEvent } from '../types/opportunity';

// In-process pub/sub so the SSE endpoint can push events the moment they are written.
// The SQLite event log remains the source of truth; this bus is a live notification layer
// on top of it. A subscriber that misses a tick can always backfill from GET /events.
const bus = new EventEmitter();
// One SSE client per browser tab; a handful at most for a single operator. Raise the cap
// only so a stray listener leak surfaces as a warning rather than silently.
bus.setMaxListeners(50);

const CHANNEL = 'opportunity.event';

export function publishEvent(event: OpportunityEvent): void {
  bus.emit(CHANNEL, event);
}

export function subscribeEvents(listener: (event: OpportunityEvent) => void): () => void {
  bus.on(CHANNEL, listener);
  return () => bus.off(CHANNEL, listener);
}
