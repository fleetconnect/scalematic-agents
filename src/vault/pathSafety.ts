import path from 'path';
import { MARKDOWN_EXTENSIONS } from './vaultConfig';

// Pure path-safety primitives. No filesystem access here so they can be unit-tested in
// isolation. The adapter layers the filesystem checks (existence, symlinks) on top.

export class VaultPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultPathError';
  }
}

// True only when the first path segment is one of the approved folders.
export function isApprovedFolder(relativePath: string, approved: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const top = normalized.split('/')[0];
  return top.length > 0 && approved.includes(top);
}

// Resolve a vault-relative path to an absolute path, guaranteeing it stays inside root.
// Throws on traversal, absolute escape, null bytes, or a path that resolves to root itself.
export function resolveWithinRoot(root: string, relativePath: string): string {
  if (relativePath.includes('\0')) throw new VaultPathError('Null byte in path');
  const normalizedRoot = path.resolve(root);
  const candidate = path.resolve(normalizedRoot, relativePath);
  const rel = path.relative(normalizedRoot, candidate);
  if (rel === '') throw new VaultPathError('Path resolves to the vault root, not a note');
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
    throw new VaultPathError(`Path escapes the vault root: ${relativePath}`);
  }
  return candidate;
}

// Combined guard: approved folder + inside root. Returns the safe absolute path.
export function assertSafeRelativePath(
  root: string,
  relativePath: string,
  approved: string[]
): string {
  if (!relativePath || !relativePath.trim()) {
    throw new VaultPathError('Empty path');
  }
  if (!isApprovedFolder(relativePath, approved)) {
    throw new VaultPathError(`Folder not in the approved allowlist: ${relativePath}`);
  }
  return resolveWithinRoot(root, relativePath);
}

export function isMarkdownPath(filePath: string): boolean {
  return MARKDOWN_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

export function assertMarkdownPath(relativePath: string): void {
  if (!isMarkdownPath(relativePath)) {
    throw new VaultPathError(`Unsupported file type (markdown only): ${relativePath}`);
  }
}

// Convert an absolute path back to a forward-slash vault-relative path for the browser.
export function toVaultRelative(root: string, absolutePath: string): string {
  return path
    .relative(path.resolve(root), path.resolve(absolutePath))
    .split(path.sep)
    .join('/');
}
