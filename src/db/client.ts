import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CREATE_TABLES } from './schema';

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'scalematic.db');

let _db: Database.Database | null = null;

function runMigrations(db: Database.Database): void {
  const cols = (db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>).map((c) => c.name);
  if (!cols.includes('input_tokens')) db.exec('ALTER TABLE tasks ADD COLUMN input_tokens INTEGER');
  if (!cols.includes('output_tokens')) db.exec('ALTER TABLE tasks ADD COLUMN output_tokens INTEGER');

  const oppCols = (db.prepare(`PRAGMA table_info(opportunities)`).all() as Array<{ name: string }>).map((c) => c.name);
  if (oppCols.length && !oppCols.includes('thesis_status')) {
    db.exec("ALTER TABLE opportunities ADD COLUMN thesis_status TEXT NOT NULL DEFAULT 'untested'");
  }
  if (oppCols.length && !oppCols.includes('prediction')) {
    db.exec('ALTER TABLE opportunities ADD COLUMN prediction TEXT');
  }
}

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.exec(CREATE_TABLES);
    runMigrations(_db);
  }
  return _db;
}
