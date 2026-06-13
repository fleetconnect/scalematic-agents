import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import {
  isApprovedFolder,
  resolveWithinRoot,
  assertSafeRelativePath,
  isMarkdownPath,
  assertMarkdownPath,
  toVaultRelative,
  VaultPathError,
} from '../src/vault/pathSafety';

const APPROVED = ['03 Projects', '09 Daily Notes'];
const ROOT = '/tmp/vault-root';

test('isApprovedFolder accepts only allowlisted top segment', () => {
  assert.equal(isApprovedFolder('03 Projects/x.md', APPROVED), true);
  assert.equal(isApprovedFolder('99 Archive/x.md', APPROVED), false);
  assert.equal(isApprovedFolder('x.md', APPROVED), false);
  assert.equal(isApprovedFolder('/03 Projects/x.md', APPROVED), true);
});

test('resolveWithinRoot rejects traversal, absolute escape, null byte, and root itself', () => {
  assert.throws(() => resolveWithinRoot(ROOT, '../etc/passwd'), VaultPathError);
  assert.throws(() => resolveWithinRoot(ROOT, '03 Projects/../../escape'), VaultPathError);
  assert.throws(() => resolveWithinRoot(ROOT, 'a\0b'), VaultPathError);
  assert.throws(() => resolveWithinRoot(ROOT, '.'), VaultPathError);
  assert.throws(() => resolveWithinRoot(ROOT, '/etc/passwd'), VaultPathError);
});

test('resolveWithinRoot returns an absolute path inside root for a safe path', () => {
  const abs = resolveWithinRoot(ROOT, '03 Projects/x.md');
  assert.equal(abs, path.join(path.resolve(ROOT), '03 Projects/x.md'));
});

test('assertSafeRelativePath enforces both allowlist and containment', () => {
  assert.throws(() => assertSafeRelativePath(ROOT, '', APPROVED), VaultPathError);
  assert.throws(() => assertSafeRelativePath(ROOT, '99 Archive/x.md', APPROVED), VaultPathError);
  assert.throws(() => assertSafeRelativePath(ROOT, '03 Projects/../../x', APPROVED), VaultPathError);
  const abs = assertSafeRelativePath(ROOT, '03 Projects/x.md', APPROVED);
  assert.ok(abs.endsWith(path.join('03 Projects', 'x.md')));
});

test('markdown guards', () => {
  assert.equal(isMarkdownPath('a.md'), true);
  assert.equal(isMarkdownPath('a.MD'), true);
  assert.equal(isMarkdownPath('a.txt'), false);
  assert.throws(() => assertMarkdownPath('a.txt'), VaultPathError);
  assert.doesNotThrow(() => assertMarkdownPath('a.md'));
});

test('toVaultRelative produces forward-slash relative path', () => {
  const abs = path.join(path.resolve(ROOT), '03 Projects', 'sub', 'x.md');
  assert.equal(toVaultRelative(ROOT, abs), '03 Projects/sub/x.md');
});
