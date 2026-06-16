import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCapabilities, CapabilityEnv, FilingProbe } from '../src/capabilities/capabilityService';
import { VaultStatus } from '../src/types/vault';

const availableVault: VaultStatus = {
  configured: true,
  reachable: true,
  rootLabel: 'scalematic',
  approvedFolders: [],
  state: 'available',
  reason: 'Vault reachable',
};

const healthyProbe: FilingProbe = {
  conversationsWritable: true,
  auditStoreOk: true,
  diskPressureHigh: false,
};

function cap(env: CapabilityEnv, vault: VaultStatus = availableVault, probe: FilingProbe = healthyProbe) {
  const map = buildCapabilities(env, vault, probe);
  const by: Record<string, string> = {};
  for (const c of map.capabilities) by[c.id] = c.state;
  return by;
}

test('reasoning runtime: not_configured without key, degraded with key, blocked when disabled', () => {
  assert.equal(cap({})['reasoning-runtime'], 'not_configured');
  assert.equal(cap({ anthropicApiKey: 'sk-x' })['reasoning-runtime'], 'degraded');
  assert.equal(
    cap({ anthropicApiKey: 'sk-x', anthropicDisabled: 'true' })['reasoning-runtime'],
    'blocked'
  );
});

test('FMCSA sentinel: fixture_only by default, available on opendata', () => {
  assert.equal(cap({})['fmcsa-sentinel'], 'fixture_only');
  assert.equal(cap({ fmcsaProvider: 'opendata' })['fmcsa-sentinel'], 'available');
});

test('outbound email: not_configured, then blocked without LIVE_SENDS, then degraded when enabled', () => {
  assert.equal(cap({})['outbound-email'], 'not_configured');
  assert.equal(cap({ instantlyApiKey: 'k' })['outbound-email'], 'blocked');
  assert.equal(cap({ instantlyApiKey: 'k', liveSends: 'true' })['outbound-email'], 'degraded');
});

test('vault-read mirrors the provided vault status; vault-write is always deferred', () => {
  assert.equal(cap({})['vault-read'], 'available');
  const degraded = cap({}, { ...availableVault, state: 'degraded', reason: 'partial' });
  assert.equal(degraded['vault-read'], 'degraded');
  const notConfigured = cap({}, { ...availableVault, configured: false, reason: 'no root' });
  assert.equal(notConfigured['vault-read'], 'not_configured');
  assert.equal(cap({})['vault-write'], 'not_configured');
});

test('static postures: conversation desk available, ops-center archived', () => {
  const states = cap({});
  assert.equal(states['conversation-desk'], 'available');
  assert.equal(states['ops-center'], 'archived');
});

test('every capability carries a non-empty reason and verifiedAt', () => {
  const map = buildCapabilities({ anthropicApiKey: 'sk-x' }, availableVault);
  for (const c of map.capabilities) {
    assert.ok(c.reason.length > 0, `${c.id} must have a reason`);
    assert.ok(c.verifiedAt.length > 0, `${c.id} must have verifiedAt`);
  }
});

test('conversation-filing: available when vault writable, audit ok, no disk pressure', () => {
  const states = cap({});
  assert.equal(states['conversation-filing'], 'available');
});

test('conversation-filing: degraded when host disk pressure exceeds threshold', () => {
  const states = cap({}, availableVault, { conversationsWritable: true, auditStoreOk: true, diskPressureHigh: true });
  assert.equal(states['conversation-filing'], 'degraded');
});

test('conversation-filing: degraded when the audit store is unavailable', () => {
  const states = cap({}, availableVault, { conversationsWritable: true, auditStoreOk: false, diskPressureHigh: false });
  assert.equal(states['conversation-filing'], 'degraded');
});

test('conversation-filing: blocked by policy when FILING_DISABLED=true', () => {
  assert.equal(cap({ filingDisabled: 'true' })['conversation-filing'], 'blocked');
});

test('conversation-filing: blocked when 06 Conversations is not writable', () => {
  const states = cap({}, availableVault, { conversationsWritable: false, auditStoreOk: true, diskPressureHigh: false });
  assert.equal(states['conversation-filing'], 'blocked');
});

test('conversation-filing: not_configured when the vault root is absent', () => {
  const noVault: VaultStatus = { configured: false, reachable: false, rootLabel: null, approvedFolders: [], state: 'not_configured', reason: 'no root' };
  assert.equal(cap({}, noVault)['conversation-filing'], 'not_configured');
});

test('conversation-filing: blocked when the vault is unavailable (degraded/blocked)', () => {
  const degradedVault: VaultStatus = { ...availableVault, state: 'degraded', reason: 'unreachable' };
  assert.equal(cap({}, degradedVault)['conversation-filing'], 'blocked');
});

test('no false generic-write availability: vault-write stays not_configured even when filing is available', () => {
  const states = cap({});
  assert.equal(states['conversation-filing'], 'available');
  assert.equal(states['vault-write'], 'not_configured');
});
