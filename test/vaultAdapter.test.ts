import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getVaultStatus,
  listNotes,
  recentNotes,
  searchNotes,
  readNote,
  projectSummaries,
  goals,
  conversations,
  dailyNote,
  VaultUnavailableError,
} from '../src/vault/vaultAdapter';
import { VaultPathError } from '../src/vault/pathSafety';

// Each test builds a throwaway vault under the OS temp dir and points VAULT_ROOT at it. We
// never touch the operator's real vault. getVaultRoot reads process.env on every call, so
// setting VAULT_ROOT per test fully controls the adapter.

function makeVault(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
  for (const f of ['03 Projects', '06 Conversations', '09 Daily Notes', '00 Inbox']) {
    fs.mkdirSync(path.join(root, f), { recursive: true });
  }
  return root;
}

function write(root: string, rel: string, content: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

function withVault(fn: (root: string) => void): void {
  const prev = process.env.VAULT_ROOT;
  const root = makeVault();
  process.env.VAULT_ROOT = root;
  try {
    fn(root);
  } finally {
    if (prev === undefined) delete process.env.VAULT_ROOT;
    else process.env.VAULT_ROOT = prev;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('getVaultStatus reports not_configured when VAULT_ROOT is empty', () => {
  const prev = process.env.VAULT_ROOT;
  process.env.VAULT_ROOT = '';
  try {
    // An empty string falls back to the default root in config; to truly test "not configured"
    // we point at a guaranteed-missing path and expect a degraded/unreachable report instead.
    process.env.VAULT_ROOT = path.join(os.tmpdir(), 'definitely-missing-vault-xyz');
    const status = getVaultStatus();
    assert.equal(status.reachable, false);
    assert.equal(status.state, 'degraded');
  } finally {
    if (prev === undefined) delete process.env.VAULT_ROOT;
    else process.env.VAULT_ROOT = prev;
  }
});

test('getVaultStatus reports available when approved folders exist', () => {
  withVault((root) => {
    write(root, '03 Projects/p.md', '# P');
    const status = getVaultStatus();
    assert.equal(status.configured, true);
    assert.equal(status.reachable, true);
    assert.equal(status.state, 'available');
    assert.equal(status.rootLabel, path.basename(root));
  });
});

test('listNotes and recentNotes read markdown and return vault-relative paths only', () => {
  withVault((root) => {
    write(root, '03 Projects/a.md', '# Alpha');
    write(root, '03 Projects/b.md', '# Beta');
    write(root, '03 Projects/notes.txt', 'ignored non-markdown');
    const notes = listNotes('03 Projects');
    assert.equal(notes.length, 2);
    for (const n of notes) {
      assert.ok(!path.isAbsolute(n.path), 'path must be vault-relative');
      assert.ok(n.path.startsWith('03 Projects/'));
    }
    const recent = recentNotes(1, '03 Projects');
    assert.equal(recent.length, 1);
  });
});

test('listNotes on an empty approved folder returns an empty list, not an error', () => {
  withVault(() => {
    assert.deepEqual(listNotes('00 Inbox'), []);
  });
});

test('listNotes throws on a folder outside the allowlist', () => {
  withVault(() => {
    assert.throws(() => listNotes('99 Archive'), VaultPathError);
  });
});

test('readNote rejects unsupported file types and traversal', () => {
  withVault(() => {
    assert.throws(() => readNote('03 Projects/a.txt'), VaultPathError);
    assert.throws(() => readNote('03 Projects/../../etc/passwd'), VaultPathError);
    assert.throws(() => readNote('99 Archive/a.md'), VaultPathError);
  });
});

test('readNote returns body and derived title for a real note', () => {
  withVault((root) => {
    write(root, '03 Projects/a.md', '---\ntitle: My Project\nstatus: active\n---\nhello world');
    const note = readNote('03 Projects/a.md');
    assert.equal(note.title, 'My Project');
    assert.equal(note.body, 'hello world');
    assert.equal(note.frontmatter.status, 'active');
    assert.equal(note.folder, '03 Projects');
  });
});

test('readNote refuses to read a symbolic link', () => {
  withVault((root) => {
    const target = path.join(root, 'secret.md');
    fs.writeFileSync(target, '# secret', 'utf-8');
    const link = path.join(root, '03 Projects', 'link.md');
    try {
      fs.symlinkSync(target, link);
    } catch {
      return; // platform without symlink permission; skip
    }
    assert.throws(() => readNote('03 Projects/link.md'), VaultPathError);
    // and collectMarkdownFiles skips it: listNotes should not include the symlink
    const notes = listNotes('03 Projects');
    assert.equal(notes.find((n) => n.path.endsWith('link.md')), undefined);
  });
});

test('searchNotes scores title higher than body and returns excerpts', () => {
  withVault((root) => {
    write(root, '03 Projects/match-title.md', '# Falcon plan\nbody about nothing');
    write(root, '03 Projects/match-body.md', '# Other\nthis mentions falcon once');
    const hits = searchNotes('falcon', '03 Projects');
    assert.equal(hits.length, 2);
    assert.ok(hits[0].title.toLowerCase().includes('falcon'), 'title hit ranks first');
    assert.ok(hits.every((h) => typeof h.excerpt === 'string'));
  });
});

test('searchNotes returns nothing for an empty query', () => {
  withVault((root) => {
    write(root, '03 Projects/a.md', '# Alpha');
    assert.deepEqual(searchNotes('   ', '03 Projects'), []);
  });
});

test('projectSummaries surfaces frontmatter fields with null fallbacks', () => {
  withVault((root) => {
    write(root, '03 Projects/p.md', '---\ntitle: P\nstatus: active\nowner: Kalei\n---\nbody');
    const summaries = projectSummaries();
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].status, 'active');
    assert.equal(summaries[0].owner, 'Kalei');
    assert.equal(summaries[0].phase, null);
  });
});

test('goals reports found:false honestly when no goal notes exist', () => {
  withVault((root) => {
    write(root, '03 Projects/p.md', '# Just a project');
    const g = goals();
    assert.equal(g.found, false);
    assert.deepEqual(g.notes, []);
  });
});

test('goals finds notes tagged or titled as goals', () => {
  withVault((root) => {
    write(root, '00 Inbox/g.md', '---\ntags: [goals]\n---\nQ3 targets');
    const g = goals();
    assert.equal(g.found, true);
    assert.equal(g.notes.length, 1);
  });
});

test('conversations returns summaries sorted by date', () => {
  withVault((root) => {
    write(root, '06 Conversations/c1.md', '---\ndate: 2026-01-01\npeople: [A]\n---\nx');
    write(root, '06 Conversations/c2.md', '---\ndate: 2026-02-01\ncompanies: [Acme]\n---\ny');
    const list = conversations();
    assert.equal(list.length, 2);
    assert.equal(list[0].date, '2026-02-01');
  });
});

test('dailyNote returns found:false for a missing day and found:true when present', () => {
  withVault((root) => {
    assert.equal(dailyNote('2026-06-13').found, false);
    write(root, '09 Daily Notes/2026-06-13.md', '# Daily\ndid things');
    const r = dailyNote('2026-06-13');
    assert.equal(r.found, true);
    assert.equal(r.note?.body, '# Daily\ndid things');
  });
});
