import { v4 as uuid } from 'uuid';
import { getDb } from '../db/client';
import { MemoryCategory, MemoryDocument, MemorySearchResult } from '../types/memory';
import { logger } from '../utils/logger';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function score(query: string, document: MemoryDocument): number {
  const qTokens = new Set(tokenize(query));
  const dTokens = tokenize(document.title + ' ' + document.content);
  let hits = 0;
  for (const token of dTokens) {
    if (qTokens.has(token)) hits++;
  }
  return hits / Math.max(qTokens.size, 1);
}

export function searchMemory(query: string, limit = 5, category?: MemoryCategory): MemorySearchResult[] {
  const db = getDb();
  const rows = category
    ? db.prepare('SELECT * FROM memory_documents WHERE category = ?').all(category)
    : db.prepare('SELECT * FROM memory_documents').all();

  const docs = rows as MemoryDocument[];
  const results = docs
    .map((doc) => ({ document: doc, score: score(query, doc) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

export function upsertMemoryDocument(
  title: string,
  category: MemoryCategory,
  source: string,
  content: string,
  id?: string
): MemoryDocument {
  const db = getDb();
  const now = new Date().toISOString();
  const docId = id ?? uuid();

  const existing = db.prepare('SELECT id FROM memory_documents WHERE id = ?').get(docId);
  if (existing) {
    db.prepare(
      'UPDATE memory_documents SET title=?, category=?, source=?, content=?, updated_at=? WHERE id=?'
    ).run(title, category, source, content, now, docId);
  } else {
    db.prepare(
      'INSERT INTO memory_documents (id, title, category, source, content, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
    ).run(docId, title, category, source, content, now, now);
  }

  logger.info(`Memory document upserted: ${title} [${category}]`);
  return { id: docId, title, category, source, content, createdAt: now, updatedAt: now };
}

export function getMemoryContext(query: string, maxChars = 3000): string {
  const results = searchMemory(query, 5);
  if (!results.length) return '';

  const chunks = results.map((r) => {
    const truncated = r.document.content.slice(0, 600);
    return `[${r.document.category}] ${r.document.title}:\n${truncated}`;
  });

  return chunks.join('\n\n---\n\n').slice(0, maxChars);
}
