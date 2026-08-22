import { DatabaseSync } from "node:sqlite";
import type { Db, PreparedStatement, SqlValue } from "../../db.js";

/**
 * Adaptador de pruebas: implementa la interfaz Db sobre SQLite en memoria.
 * El esquema y las consultas del proyecto usan sintaxis portable (TEXT, REAL,
 * placeholders "?"), por lo que funcionan tal cual sobre node:sqlite.
 * Las transacciones anidadas reutilizan la externa, igual que el adaptador pg.
 */
export function createTestDb(): Db {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");

  /** Divide scripts con varias sentencias respetando comillas simples/dobles. */
  function splitStatements(sql: string): string[] {
    const out: string[] = [];
    let current = "";
    let quote: string | null = null;
    for (const ch of sql) {
      if (quote) {
        current += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        current += ch;
        continue;
      }
      if (ch === ";") {
        const s = current.trim();
        if (s) out.push(s);
        current = "";
        continue;
      }
      current += ch;
    }
    const s = current.trim();
    if (s) out.push(s);
    return out;
  }

  let txDepth = 0;

  const db: Db = {
    prepare(sqlBase: string): PreparedStatement {
      const statements = splitStatements(sqlBase);
      if (statements.length > 1) {
        // Solo initDb usa scripts multi-sentencia, siempre vía run().
        return {
          async get() {
            throw new Error("get() no soporta múltiples sentencias");
          },
          async all() {
            throw new Error("all() no soporta múltiples sentencias");
          },
          async run(...params: SqlValue[]) {
            void params;
            for (const s of statements) raw.exec(s);
            return { changes: 0 };
          },
        };
      }
      const stmt = raw.prepare(sqlBase);
      return {
        async get(...params: SqlValue[]) {
          return stmt.get(...(params as never[])) as Record<string, unknown> | undefined;
        },
        async all(...params: SqlValue[]) {
          return stmt.all(...(params as never[])) as Record<string, unknown>[];
        },
        async run(...params: SqlValue[]) {
          const res = stmt.run(...(params as never[]));
          return { changes: Number(res.changes) };
        },
      };
    },

    async ping() {
      raw.prepare("SELECT 1").get();
    },

    async close() {
      raw.close();
    },

    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      if (txDepth > 0) return fn(db); // Transacción anidada: reutiliza la externa.
      txDepth++;
      try {
        raw.exec("BEGIN");
        const result = await fn(db);
        raw.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          raw.exec("ROLLBACK");
        } catch {
          // La transacción ya no es válida; se propaga el error original.
        }
        throw err;
      } finally {
        txDepth--;
      }
    },
  };

  return db;
}
