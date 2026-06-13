// Capability-state model for Control Center v1. Every relevant service reports exactly one
// state with a human-readable reason. State must come from real configuration or verified
// runtime state — never inferred "available" just because code exists.

export type CapabilityState =
  | 'available'
  | 'degraded'
  | 'blocked'
  | 'not_configured'
  | 'simulated'
  | 'fixture_only'
  | 'archived';

export type CapabilityCategory = 'runtime' | 'integration' | 'knowledge' | 'ui';

export interface Capability {
  id: string;
  label: string;
  category: CapabilityCategory;
  state: CapabilityState;
  // Always present. For non-available states this explains why; for available it confirms
  // what was actually verified.
  reason: string;
  verifiedAt: string;
}

export interface CapabilityMap {
  capabilities: Capability[];
  generatedAt: string;
}
