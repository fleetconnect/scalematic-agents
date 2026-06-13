import { Capability, CapabilityMap, CapabilityState } from '../types/capability';
import { VaultStatus } from '../types/vault';
import { getVaultStatus } from '../vault/vaultAdapter';

// Capability honesty layer for Control Center v1. State is derived from real configuration
// (process.env) and verified runtime state (vault reachability) — never inferred "available"
// just because the code exists. Each capability carries a human-readable reason explaining
// why it is in its state, which the UI surfaces verbatim.

export interface CapabilityEnv {
  anthropicApiKey?: string;
  anthropicDisabled?: string;
  instantlyApiKey?: string;
  liveSends?: string;
  fmcsaProvider?: string;
}

function readEnv(): CapabilityEnv {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || undefined,
    anthropicDisabled: process.env.ANTHROPIC_DISABLED?.trim() || undefined,
    instantlyApiKey: process.env.INSTANTLY_API_KEY?.trim() || undefined,
    liveSends: process.env.LIVE_SENDS?.trim() || undefined,
    fmcsaProvider: process.env.FMCSA_PROVIDER?.trim().toLowerCase() || undefined,
  };
}

// The Anthropic-backed reasoning runtime. A configured key cannot prove available credits
// without spending, so a present key yields "degraded" (verified: key present, credits not
// probed). An explicit ANTHROPIC_DISABLED override forces "blocked". No key is "not_configured".
function anthropicState(env: CapabilityEnv): { state: CapabilityState; reason: string } {
  if (env.anthropicDisabled === 'true') {
    return { state: 'blocked', reason: 'ANTHROPIC_DISABLED=true; reasoning runtime is turned off by configuration' };
  }
  if (!env.anthropicApiKey) {
    return { state: 'not_configured', reason: 'ANTHROPIC_API_KEY is not set; reasoning runtime cannot start' };
  }
  return {
    state: 'degraded',
    reason: 'ANTHROPIC_API_KEY is configured; credit balance is not probed at startup, so availability is unverified',
  };
}

function vaultStateToCapability(status: VaultStatus): { state: CapabilityState; reason: string } {
  if (!status.configured) return { state: 'not_configured', reason: status.reason };
  if (status.state === 'available') return { state: 'available', reason: status.reason };
  if (status.state === 'degraded') return { state: 'degraded', reason: status.reason };
  return { state: 'blocked', reason: status.reason };
}

export function buildCapabilities(env: CapabilityEnv, vaultStatus: VaultStatus): CapabilityMap {
  const now = new Date().toISOString();
  const anthropic = anthropicState(env);
  const vaultRead = vaultStateToCapability(vaultStatus);

  // Outbound email sending: requires both an Instantly key and the LIVE_SENDS gate. Without
  // the key it is not_configured; with the key but sends disabled it is blocked (key present
  // but the live gate is off); fully enabled it is degraded (key present, not test-sent here).
  let sendState: CapabilityState;
  let sendReason: string;
  if (!env.instantlyApiKey) {
    sendState = 'not_configured';
    sendReason = 'INSTANTLY_API_KEY is not set; outbound email sending is unavailable';
  } else if (env.liveSends !== 'true') {
    sendState = 'blocked';
    sendReason = 'INSTANTLY_API_KEY is set but LIVE_SENDS is not "true"; live sending is gated off';
  } else {
    sendState = 'degraded';
    sendReason = 'INSTANTLY_API_KEY is set and LIVE_SENDS is enabled; deliverability is not verified here';
  }

  // FMCSA prospect sentinel: keyless Open Data is the live provider; the default fixture
  // provider keeps the loop runnable offline and is reported honestly as fixture_only.
  const fmcsaLive = env.fmcsaProvider === 'opendata';

  const capabilities: Capability[] = [
    {
      id: 'reasoning-runtime',
      label: 'Reasoning runtime (Anthropic)',
      category: 'runtime',
      state: anthropic.state,
      reason: anthropic.reason,
      verifiedAt: now,
    },
    {
      id: 'fmcsa-sentinel',
      label: 'FMCSA prospect sentinel',
      category: 'integration',
      state: fmcsaLive ? 'available' : 'fixture_only',
      reason: fmcsaLive
        ? 'FMCSA_PROVIDER=opendata; keyless FMCSA Open Data (Socrata) is the active source'
        : 'FMCSA_PROVIDER is not "opendata"; running on the offline fixture provider',
      verifiedAt: now,
    },
    {
      id: 'outbound-email',
      label: 'Outbound email (Instantly)',
      category: 'integration',
      state: sendState,
      reason: sendReason,
      verifiedAt: now,
    },
    {
      id: 'vault-read',
      label: 'Vault read (durable knowledge)',
      category: 'knowledge',
      state: vaultRead.state,
      reason: vaultRead.reason,
      verifiedAt: now,
    },
    {
      id: 'vault-write',
      label: 'Vault write (durable knowledge)',
      category: 'knowledge',
      state: 'not_configured',
      reason: 'Plane-B writes are deferred; Control Center v1 is read-only against the vault',
      verifiedAt: now,
    },
    {
      id: 'conversation-desk',
      label: 'Conversation Intelligence Desk',
      category: 'ui',
      state: 'available',
      reason: 'Download-only in Phase 1; produces Markdown for manual filing, no automatic vault writes',
      verifiedAt: now,
    },
    {
      id: 'ops-center',
      label: 'ops-center (legacy UI)',
      category: 'ui',
      state: 'archived',
      reason: 'Superseded by ops-dashboard as the canonical Control Center UI; retained for reference only',
      verifiedAt: now,
    },
  ];

  return { capabilities, generatedAt: now };
}

export function getCapabilities(): CapabilityMap {
  return buildCapabilities(readEnv(), getVaultStatus());
}
