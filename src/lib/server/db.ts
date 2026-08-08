import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite persistence for community accounts and reports.
 * DATA_DIR (default ./data) must be a persistent volume in production —
 * on Render attach a disk, on Docker mount a volume (see README).
 */
export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function open(): Database.Database {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "firewatch.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      pass TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('smoke','fire','note')),
      body TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      photo TEXT,
      status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_comments_report ON comments(report_id);
    CREATE TABLE IF NOT EXISTS flags (
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      UNIQUE(report_id, user_id)
    );
  `);
  return db;
}

// Survive dev-mode HMR with a single connection.
const g = globalThis as { __firewatchDb?: Database.Database };
export function getDb(): Database.Database {
  if (!g.__firewatchDb) g.__firewatchDb = open();
  return g.__firewatchDb;
}
