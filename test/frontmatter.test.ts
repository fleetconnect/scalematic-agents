import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFrontmatter,
  deriveTitle,
  asStringArray,
  asStringOrNull,
  FrontmatterError,
} from '../src/vault/frontmatter';

test('parseFrontmatter returns empty frontmatter when none present', () => {
  const { frontmatter, body } = parseFrontmatter('# Title\n\nbody');
  assert.deepEqual(frontmatter, {});
  assert.equal(body, '# Title\n\nbody');
});

test('parseFrontmatter parses YAML and strips the block from the body', () => {
  const raw = '---\ntitle: Hello\ntags: [a, b]\n---\nbody text';
  const { frontmatter, body } = parseFrontmatter(raw);
  assert.equal(frontmatter.title, 'Hello');
  assert.deepEqual(frontmatter.tags, ['a', 'b']);
  assert.equal(body, 'body text');
});

test('parseFrontmatter throws FrontmatterError on invalid YAML', () => {
  const raw = '---\ntitle: "unterminated\n---\nbody';
  assert.throws(() => parseFrontmatter(raw), FrontmatterError);
});

test('parseFrontmatter ignores non-object YAML (e.g. a bare scalar)', () => {
  const raw = '---\njust a string\n---\nbody';
  const { frontmatter } = parseFrontmatter(raw);
  assert.deepEqual(frontmatter, {});
});

test('deriveTitle precedence: frontmatter title > heading > basename', () => {
  assert.equal(deriveTitle({ title: 'FM' }, '# Heading', '/x/file.md'), 'FM');
  assert.equal(deriveTitle({}, '# Heading\nbody', '/x/file.md'), 'Heading');
  assert.equal(deriveTitle({}, 'no heading', '/x/file.md'), 'file');
});

test('asStringArray coerces strings and arrays, drops non-strings', () => {
  assert.deepEqual(asStringArray('a'), ['a']);
  assert.deepEqual(asStringArray(['a', ' b ', 3]), ['a', 'b']);
  assert.deepEqual(asStringArray(undefined), []);
});

test('asStringOrNull handles strings, numbers, dates, and null', () => {
  assert.equal(asStringOrNull(' x '), 'x');
  assert.equal(asStringOrNull(''), null);
  assert.equal(asStringOrNull(42), '42');
  assert.equal(asStringOrNull(undefined), null);
});
