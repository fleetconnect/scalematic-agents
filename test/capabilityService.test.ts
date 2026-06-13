import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCapabilities, CapabilityEnv } from '../src/capabilities/capabilityService';
import { VaultStatus } from '../src/types/vault';

const availableVault: VaultStatus = {
  configured: true,
  reachable: true,
  rootLabel: 'scalematic',
  approvedFolders: [],
  state: 'available',
  reason: 'Vault reachable',
};

function cap(env: CapabilityEnv, vault: VaultStatus = availableVault) {
  const map = buildCapabilities(env, vault);
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
