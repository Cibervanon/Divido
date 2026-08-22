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
  /**
   * Ejecuta `fn` dentro de una transacción. Si `fn` lanza, se hace ROLLBACK.
   * Las llamadas anidadas a transaction reutilizan la transacción externa.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
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
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const txDb: Db = {
        prepare(sql) {
          const text = toPostgresSql(sql);
          return {
            async get(...params) {
              const res = await client.query(text, params);
              return res.rows[0] as Record<string, unknown> | undefined;
            },
            async all(...params) {
              const res = await client.query(text, params);
              return res.rows as Record<string, unknown>[];
            },
            async run(...params) {
              const res = await client.query(text, params);
              return { changes: res.rowCount ?? 0 };
            },
          };
        },
        ping: () => client.query("SELECT 1").then(() => undefined),
        close: () => Promise.resolve(),
        transaction: (inner) => inner(txDb),
      };
      try {
        await client.query("BEGIN");
        const result = await fn(txDb);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // La conexión ya no es válida; se libera igualmente.
        }
        throw err;
      } finally {
        client.release();
      }
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
  type TEXT NOT NULL DEFAULT 'open' CHECK (type IN ('open','closed')),
  invite_token TEXT UNIQUE NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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
  payer_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  exchange_rate REAL NOT NULL DEFAULT 1,
  amount_group REAL NOT NULL CHECK (amount_group > 0),
  created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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
  from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount REAL NOT NULL CHECK (amount > 0),
  note TEXT,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','pending_confirmation','rejected')),
  created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_name TEXT NOT NULL,
  diff TEXT,
  created_at TEXT NOT NULL
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

-- Nuevos índices para filtros y consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_expenses_group_created ON expenses(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_group_category ON expenses(group_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_group_payer ON expenses(group_id, payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_group_status ON payments(group_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = 0;
CREATE INDEX IF NOT EXISTS idx_requests_group_status ON modification_requests(group_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_group_entity ON audit_log(group_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_group_created ON audit_log(group_id, created_at DESC);
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
  // CHECK constraints para integridad de datos (PostgreSQL no soporta IF NOT EXISTS en constraints)
  "DO $$ BEGIN ALTER TABLE expenses ADD CONSTRAINT chk_expense_amount_positive CHECK (amount > 0); EXCEPTION WHEN duplicate_object THEN END $$;",
  "DO $$ BEGIN ALTER TABLE expenses ADD CONSTRAINT chk_expense_amount_group_positive CHECK (amount_group > 0); EXCEPTION WHEN duplicate_object THEN END $$;",
  "DO $$ BEGIN ALTER TABLE payments ADD CONSTRAINT chk_payment_amount_positive CHECK (amount > 0); EXCEPTION WHEN duplicate_object THEN END $$;",
  "DO $$ BEGIN ALTER TABLE payments ADD CONSTRAINT chk_payment_status CHECK (status IN ('confirmed','pending_confirmation','rejected')); EXCEPTION WHEN duplicate_object THEN END $$;",
  "DO $$ BEGIN ALTER TABLE groups ADD CONSTRAINT chk_group_type CHECK (type IN ('open','closed')); EXCEPTION WHEN duplicate_object THEN END $$;",
  // Normalización: todo grupo existente debe tener estado 'open' por defecto
  "UPDATE groups SET type = 'open' WHERE type IS NULL OR type NOT IN ('open','closed')",
  // Baja de cuenta (GDPR): marca al usuario como eliminado sin romper las FKs contables
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted INTEGER NOT NULL DEFAULT 0",
];

export async function initDb(db: Db, opts: { migrations?: boolean } = {}): Promise<void> {
  await db.prepare(SCHEMA).run();
  // Las migraciones son sentencias idempotentes específicas de PostgreSQL
  // para bases de datos preexistentes; un esquema recién creado ya incluye
  // todas esas columnas y constraints (útil para tests en memoria).
  if (opts.migrations === false) return;
  for (const sql of MIGRATIONS) {
    await db.prepare(sql).run();
  }
}
