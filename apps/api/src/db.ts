import { Pool } from "pg";

export type SqlValue = string | number | boolean | null | undefined;

export interface PreparedStatement {
  get(...params: SqlValue[]): Promise<Record<string, unknown> | undefined>;
  all(...params: SqlValue[]): Promise<Record<string, unknown>[]>;
  run(...params: SqlValue[]): Promise<{ changes: number }>;
}

export interface Db {
  prepare(sql: string): PreparedStatement;
  ping(): Promise<void>;
  close(): Promise<void>;
}

function toPostgresSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export function createDb(connectionString: string): Db {
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada");
  }
  const pool = new Pool({
    connectionString,
    max: 10,
    ssl: /neon\.tech|sslmode=require/i.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  return {
    prepare(sql) {
      const text = toPostgresSql(sql);
      return {
        async get(...params) {
          const res = await pool.query(text, params);
          return res.rows[0] as Record<string, unknown> | undefined;
        },
        async all(...params) {
          const res = await pool.query(text, params);
          return res.rows as Record<string, unknown>[];
        },
        async run(...params) {
          const res = await pool.query(text, params);
          return { changes: res.rowCount ?? 0 };
        },
      };
    },
    async ping() {
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
    },
  };
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
  is_ghost BOOLEAN NOT NULL DEFAULT FALSE,
  phone TEXT,
  revolut TEXT,
  paypal TEXT,
  verify_token TEXT,
  verify_token_expires TEXT,
  reset_token TEXT,
  reset_token_expires TEXT,
  pinned_group_ids TEXT NOT NULL DEFAULT '[]',
  auto_confirm_payments INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  type TEXT NOT NULL DEFAULT 'open',
  invite_token TEXT UNIQUE NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id),
  logo_url TEXT,
  enabled_extras TEXT NOT NULL DEFAULT '[]',
  simplify_debts INTEGER NOT NULL DEFAULT 0,
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
  claim_token TEXT,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  payer_id TEXT REFERENCES users(id),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  exchange_rate REAL NOT NULL DEFAULT 1,
  amount_group REAL NOT NULL,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  paid_from_pot INTEGER NOT NULL DEFAULT 0,
  receipt_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  icon_name TEXT NOT NULL DEFAULT 'wallet',
  is_custom_icon INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expense_participants (
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  share_amount REAL,
  PRIMARY KEY (expense_id, user_id)
);

CREATE TABLE IF NOT EXISTS expense_comments (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL REFERENCES users(id),
  to_user_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  note TEXT,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
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

CREATE TABLE IF NOT EXISTS group_events (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS informal_debts (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users(id),
  creditor_id TEXT NOT NULL REFERENCES users(id),
  debtor_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'money',
  prize TEXT,
  winner_ids TEXT,
  loser_ids TEXT,
  amount REAL NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS common_pot_contributions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  amount REAL NOT NULL,
  note TEXT,
  expense_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  frequency TEXT NOT NULL DEFAULT 'monthly',
  responsible_id TEXT NOT NULL REFERENCES users(id),
  payer_id TEXT REFERENCES users(id),
  participants TEXT,
  created_by TEXT REFERENCES users(id),
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  auto_create INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  keys TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  link_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  expense INTEGER NOT NULL DEFAULT 1,
  payment INTEGER NOT NULL DEFAULT 1,
  pique INTEGER NOT NULL DEFAULT 1,
  recurring INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_participants_expense ON expense_participants(expense_id);
CREATE INDEX IF NOT EXISTS idx_comments_expense ON expense_comments(expense_id);
CREATE INDEX IF NOT EXISTS idx_payments_group ON payments(group_id);
CREATE INDEX IF NOT EXISTS idx_requests_group ON modification_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_requests_expense ON modification_requests(expense_id);
CREATE INDEX IF NOT EXISTS idx_events_group ON group_events(group_id);
CREATE INDEX IF NOT EXISTS idx_informal_debts_group ON informal_debts(group_id);
CREATE INDEX IF NOT EXISTS idx_pot_group ON common_pot_contributions(group_id);
CREATE INDEX IF NOT EXISTS idx_recurring_group ON recurring_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
`;

const MIGRATIONS = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token_expires TEXT",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TEXT",
  "ALTER TABLE groups ADD COLUMN IF NOT EXISTS logo_url TEXT",
  "ALTER TABLE expense_participants ADD COLUMN IF NOT EXISTS share_amount REAL",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN NOT NULL DEFAULT FALSE",
  "ALTER TABLE groups ADD COLUMN IF NOT EXISTS enabled_extras TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS revolut TEXT",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal TEXT",
  "ALTER TABLE group_members ADD COLUMN IF NOT EXISTS claim_token TEXT",
  "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_from_pot INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT",
  "ALTER TABLE expenses ALTER COLUMN payer_id DROP NOT NULL",
  "ALTER TABLE common_pot_contributions ADD COLUMN IF NOT EXISTS expense_id TEXT",
  "ALTER TABLE common_pot_contributions ALTER COLUMN user_id DROP NOT NULL",
  "ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS auto_create INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_group_ids TEXT NOT NULL DEFAULT '[]'",
  "ALTER TABLE groups ADD COLUMN IF NOT EXISTS simplify_debts INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR'",
  "ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS payer_id TEXT REFERENCES users(id)",
  "ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS participants TEXT",
  "ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id)",
  "ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS next_run_at TEXT",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_confirm_payments INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_url TEXT",
  "ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'",
  "ALTER TABLE informal_debts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'money'",
  "ALTER TABLE informal_debts ADD COLUMN IF NOT EXISTS prize TEXT",
  "ALTER TABLE informal_debts ADD COLUMN IF NOT EXISTS winner_ids TEXT",
  "ALTER TABLE informal_debts ADD COLUMN IF NOT EXISTS loser_ids TEXT",
  "UPDATE informal_debts SET loser_ids = json_build_array(debtor_id)::text, winner_ids = json_build_array(creditor_id)::text WHERE loser_ids IS NULL",
  "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'",
  "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS icon_name TEXT NOT NULL DEFAULT 'wallet'",
  "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_custom_icon INTEGER NOT NULL DEFAULT 0",
];

export async function initDb(db: Db): Promise<void> {
  await db.prepare(SCHEMA).run();
  for (const sql of MIGRATIONS) {
    await db.prepare(sql).run();
  }
}
