import fs from 'fs';
import path from 'path';
import { Capability, CapabilityMap, CapabilityState } from '../types/capability';
import { VaultStatus } from '../types/vault';
import { getVaultStatus } from '../vault/vaultAdapter';
import { getVaultRoot, FOLDER } from '../vault/vaultConfig';
import { getDb } from '../db/client';

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
  filingDisabled?: string;
}

// Runtime probe for the governed conversation-filing command. Computed by the impure wrapper
// (getCapabilities) so buildCapabilities stays pure and testable.
export interface FilingProbe {
  conversationsWritable: boolean;
  auditStoreOk: boolean;
  diskPressureHigh: boolean;
  diskReason?: string;
}

function readEnv(): CapabilityEnv {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || undefined,
    anthropicDisabled: process.env.ANTHROPIC_DISABLED?.trim() || undefined,
    instantlyApiKey: process.env.INSTANTLY_API_KEY?.trim() || undefined,
    liveSends: process.env.LIVE_SENDS?.trim() || undefined,
    fmcsaProvider: process.env.FMCSA_PROVIDER?.trim().toLowerCase() || undefined,
    filingDisabled: process.env.FILING_DISABLED?.trim() || undefined,
  };
}

// State of the narrow governed write command (fileApprovedConversation). Derived from real
// conditions, never asserted available just because the route exists. This is NOT generic vault
// writing — only the approval-gated, 06-Conversations-only command.
function conversationFilingState(
  env: CapabilityEnv,
  vaultStatus: VaultStatus,
  probe?: FilingProbe
): { state: CapabilityState; reason: string } {
  if (env.filingDisabled === 'true') {
    return { state: 'blocked', reason: 'FILING_DISABLED=true; production conversation filing is turned off by policy' };
  }
  if (!vaultStatus.configured) {
    return { state: 'not_configured', reason: 'Vault root is not configured; filing has no target' };
  }
  if (vaultStatus.state !== 'available') {
    return { state: 'blocked', reason: `Vault is ${vaultStatus.state}; filing cannot write safely (${vaultStatus.reason})` };
  }
  if (!probe) {
    return { state: 'degraded', reason: 'Filing command installed; runtime writability and audit store not probed' };
  }
  if (!probe.conversationsWritable) {
    return { state: 'blocked', reason: '06 Conversations folder is not writable; filing cannot proceed' };
  }
  if (!probe.auditStoreOk) {
    return { state: 'degraded', reason: 'Audit store is unavailable; filing verification and audit would be impaired' };
  }
  if (probe.diskPressureHigh) {
    return { state: 'degraded', reason: probe.diskReason ?? 'Host disk pressure exceeds the approved threshold; atomic writes are at risk' };
  }
  return {
    state: 'available',
    reason: 'Vault reachable, 06 Conversations writable, audit store healthy, approval enforcement on; writes only to 06 Conversations',
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

export function buildCapabilities(
  env: CapabilityEnv,
  vaultStatus: VaultStatus,
  filingProbe?: FilingProbe
): CapabilityMap {
  const now = new Date().toISOString();
  const anthropic = anthropicState(env);
  const vaultRead = vaultStateToCapability(vaultStatus);
  const filing = conversationFilingState(env, vaultStatus, filingProbe);

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
      id: 'conversation-filing',
      label: 'Conversation filing (governed write)',
      category: 'knowledge',
      state: filing.state,
      reason: filing.reason,
      verifiedAt: now,
    },
    {
      id: 'vault-write',
      label: 'Vault write (generic, unsupported)',
      category: 'knowledge',
      state: 'not_configured',
      reason: 'No generic vault writing exists. The only durable write is the narrow, approval-gated conversation-filing command (see conversation-filing)',
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

// Disk capacity (% used) above which filing is reported degraded. Note writes are KB-sized, so this
// guards against genuinely dangerous pressure (little absolute headroom for atomic temp+rename and
// SQLite), not routine fullness on a large volume. Overridable via env. The separate ops target of
// keeping the host under 85% is tracked operationally, not as a filing-capability signal.
const DISK_DEGRADE_PCT = Number(process.env.FILING_DISK_DEGRADE_PCT ?? '95');
const MIN_FREE_GB = Number(process.env.FILING_MIN_FREE_GB ?? '2');

function probeFiling(vaultStatus: VaultStatus): FilingProbe {
  let conversationsWritable = false;
  const root = getVaultRoot();
  if (root && vaultStatus.configured) {
    try {
      fs.accessSync(path.join(root, FOLDER.conversations), fs.constants.W_OK);
      conversationsWritable = true;
    } catch {
      conversationsWritable = false;
    }
  }

  let auditStoreOk = false;
  try {
    getDb().prepare('SELECT 1 FROM conversation_filings LIMIT 1').get();
    auditStoreOk = true;
  } catch {
    auditStoreOk = false;
  }

  let diskPressureHigh = false;
  let diskReason: string | undefined;
  try {
    const st = fs.statfsSync(root ?? '/');
    const usedPct = st.blocks > 0 ? Math.round((1 - st.bavail / st.blocks) * 100) : 0;
    const freeGb = (st.bavail * st.bsize) / 1_073_741_824;
    if (usedPct >= DISK_DEGRADE_PCT || freeGb < MIN_FREE_GB) {
      diskPressureHigh = true;
      diskReason = `Host disk at ${usedPct}% with ${freeGb.toFixed(1)}GB free (degrade at >=${DISK_DEGRADE_PCT}% or <${MIN_FREE_GB}GB free); atomic writes at risk`;
    }
  } catch {
    /* statfs unavailable; treat as no pressure signal */
  }

  return { conversationsWritable, auditStoreOk, diskPressureHigh, diskReason };
}

export function getCapabilities(): CapabilityMap {
  const vaultStatus = getVaultStatus();
  return buildCapabilities(readEnv(), vaultStatus, probeFiling(vaultStatus));
}
