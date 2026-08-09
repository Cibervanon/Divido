import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const DB_PATH =
  process.env.DB_PATH ?? join(process.cwd(), "data", "divido.db");

function ensureDir() {
  if (DB_PATH !== ":memory:") {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  google_sub TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,
  verify_token_expires TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  type TEXT NOT NULL DEFAULT 'open',
  invite_token TEXT UNIQUE NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TEXT NOT NULL,
  left_at TEXT,
  frozen_balance REAL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  payer_id TEXT NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  exchange_rate REAL NOT NULL DEFAULT 1,
  amount_group REAL NOT NULL,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expense_participants (
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (expense_id, user_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL REFERENCES users(id),
  to_user_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  note TEXT,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modification_requests (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_participants_expense ON expense_participants(expense_id);
CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id);
CREATE INDEX IF NOT EXISTS idx_requests_group ON modification_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_requests_expense ON modification_requests(expense_id);
`;

const MIGRATIONS = [
  "ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN verify_token TEXT",
  "ALTER TABLE users ADD COLUMN verify_token_expires TEXT",
];

function migrate(db: DatabaseSync) {
  for (const sql of MIGRATIONS) {
    try {
      db.exec(sql);
    } catch {
      // La columna ya existe en bases de datos creadas con versiones anteriores.
    }
  }
}

export function openDb(): DatabaseSync {
  ensureDir();
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}
