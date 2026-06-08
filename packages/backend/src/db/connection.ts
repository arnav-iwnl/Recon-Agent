import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'research.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      status TEXT DEFAULT 'running',
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      total_tokens_in INTEGER DEFAULT 0,
      total_tokens_out INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      total_steps INTEGER DEFAULT 0,
      final_report TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS agent_traces (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      agent_role TEXT,
      input TEXT,
      output TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      ended_at TEXT,
      error TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      step_index INTEGER,
      tool_name TEXT,
      tool_arguments TEXT,
      tool_result TEXT,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (trace_id) REFERENCES agent_traces(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_traces_session ON agent_traces(session_id);
    CREATE INDEX IF NOT EXISTS idx_steps_trace ON steps(trace_id);
  `);
}
