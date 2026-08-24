import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";
import { createTestDb } from "./helpers/sqliteDb.js";
import { signToken } from "../auth.js";

process.env.LOG_LEVEL = "silent";
process.env.RATE_LIMIT_MAX = "100000";
process.env.EXPORT_RATE_LIMIT_MAX = "100000";

const G = "g-export-1";
const TOTAL_EXPENSES = 1500; // > 1000 para forzar más de un lote de streaming
let app: FastifyInstance;
let db: ReturnType<typeof createTestDb>;
const token = (userId: string) => ({
  authorization: `Bearer ${signToken({ id: userId, email: "", name: userId, avatarUrl: null, emailVerified: true, phone: null, revolut: null, paypal: null, pinnedGroupIds: [], autoConfirmPayments: false })}`,
});

beforeAll(async () => {
  db = createTestDb();
  app = await buildApp(db, { migrations: false });

  const now = new Date().toISOString();
  await db.prepare("INSERT INTO users (id, name, created_at) VALUES ('u1', 'Uno', ?)").run(now);
  await db.prepare("INSERT INTO users (id, name, created_at) VALUES ('u2', 'Dos', ?)").run(now);
  await db
    .prepare("INSERT INTO groups (id, name, invite_token, creator_id, created_at) VALUES (?, 'Grupo Export', 'tok-export-01', 'u1', ?)")
    .run(G, now);
  await db
    .prepare("INSERT INTO group_members (group_id, user_id, role, status, joined_at) VALUES (?, 'u1', 'admin', 'active', ?)")
    .run(G, now);
  await db
    .prepare("INSERT INTO group_members (group_id, user_id, role, status, joined_at) VALUES (?, 'u2', 'member', 'active', ?)")
    .run(G, now);

  for (let i = 0; i < TOTAL_EXPENSES; i++) {
    // Un minuto entre gasto y gasto: created_at estrictamente creciente sin empates.
    const date = new Date(Date.UTC(2025, 0, 1) + i * 60_000).toISOString();
    await db
      .prepare(
        `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'EUR', 1, ?, 'u1', ?, ?)`
      )
      .run(`e-${String(i).padStart(4, "0")}`, G, i % 2 === 0 ? "u1" : "u2", `Gasto export ${i}`, 20 + i, 20 + i, date, date);
  }
  // Participante extra en el primer gasto (más reciente, orden DESC)
  await db.prepare("INSERT INTO expense_participants (expense_id, user_id) VALUES ('e-0000', 'u2')").run();
});

afterAll(async () => {
  await app?.close();
});

describe("GET /api/groups/:groupId/export.csv", () => {
  it("anónimo → 401", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G}/export.csv` });
    expect(res.statusCode).toBe(401);
  });

  it("devuelve cabeceras de descarga y BOM UTF-8", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G}/export.csv`, headers: token("u1") });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(String(res.headers["content-disposition"])).toContain("attachment");
    expect(String(res.headers["content-disposition"])).toContain("divido-Grupo_Export.csv");
    expect(res.body.startsWith("\uFEFF")).toBe(true);
    expect(res.body).toContain("INFORME DE GASTOS COMPARTIDOS - Grupo Export");
    expect(res.body).toContain(`Gastos registrados: ${TOTAL_EXPENSES}`);
  });

  it("contiene una fila por gasto en orden DESC (streaming por lotes)", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G}/export.csv`, headers: token("u1") });
    const lines = res.body.split("\r\n").filter((l) => l.length > 0);
    // BOM+3 líneas de cabecera + línea vacía + cabecera de columnas + 1500 filas
    const dataLines = lines.filter((l) => /^(\d{1,2}\/\d{1,2}\/\d{4})/.test(l.replace(/^\uFEFF/, "")));
    expect(dataLines).toHaveLength(TOTAL_EXPENSES);
    // La primera fila es la más reciente (e-1499) y la última la más antigua (e-0000)
    expect(dataLines[0]).toContain("Gasto export 1499");
    const lastRow = dataLines[dataLines.length - 1];
    expect(lastRow).toContain("Gasto export 0");
    expect(lastRow).toContain("Dos"); // participante con nombre resuelto
  });

  it("escapa separadores en descripciones con ; y comillas", async () => {
    await db
      .prepare(
        `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at)
         VALUES ('e-tricky', ?, 'u1', 'Cena; la "buena"', 10, 'EUR', 1, 10, 'u1', '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z')`
      )
      .run(G);
    const res = await app.inject({ method: "GET", url: `/api/groups/${G}/export.csv`, headers: token("u1") });
    expect(res.body).toContain('"Cena; la ""buena"""');
  });
});
