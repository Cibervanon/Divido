import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";
import { createTestDb } from "./helpers/sqliteDb.js";
import { signToken } from "../auth.js";

process.env.LOG_LEVEL = "silent";
process.env.RATE_LIMIT_MAX = "100000";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const G = "g-store-1";
let app: FastifyInstance;
let db: ReturnType<typeof createTestDb>;
const token = (userId: string) => ({
  authorization: `Bearer ${signToken({ id: userId, email: "", name: userId, avatarUrl: null, emailVerified: true, phone: null, revolut: null, paypal: null })}`,
});

beforeAll(async () => {
  db = createTestDb();
  app = await buildApp(db, { migrations: false });

  const now = new Date().toISOString();
  await db.prepare("INSERT INTO users (id, name, created_at) VALUES ('u1', 'Uno', ?)").run(now);
  await db.prepare("INSERT INTO users (id, name, created_at) VALUES ('u2', 'Dos', ?)").run(now);
  await db.prepare("INSERT INTO groups (id, name, invite_token, creator_id, created_at) VALUES (?, 'G', 'tok-store-1', 'u1', ?)").run(G, now);
  await db.prepare("INSERT INTO group_members (group_id, user_id, role, status, joined_at) VALUES (?, 'u1', 'admin', 'active', ?)").run(G, now);
  await db.prepare(
    `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at)
     VALUES ('e-plain', ?, 'u1', 'Sin tique', 10, 'EUR', 1, 10, 'u1', ?, ?)`
  ).run(G, now, now);
  await db.prepare(
    `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at, receipt_url)
     VALUES ('e-supabase', ?, 'u1', 'Con tique cloud', 12, 'EUR', 1, 12, 'u1', ?, ?, 'supabase:g-store-1/u1/abc.jpg')`
  ).run(G, now, now);
  // Gasto que ningún otro test modifica (para el caso "sin tique")
  await db.prepare(
    `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at)
     VALUES ('e-bare', ?, 'u1', 'Intocable', 5, 'EUR', 1, 5, 'u1', ?, ?)`
  ).run(G, now, now);
});

afterAll(async () => {
  await app?.close();
});

describe("URL de subida de tiques", () => {
  it("anónimo → 401", async () => {
    const res = await app.inject({ method: "POST", url: `/api/groups/${G}/receipt-upload-url` });
    expect(res.statusCode).toBe(401);
  });

  it("sin Supabase configurado → 503 SERVICE_UNAVAILABLE", async () => {
    const res = await app.inject({ method: "POST", url: `/api/groups/${G}/receipt-upload-url`, headers: token("u1") });
    expect(res.statusCode).toBe(503);
    expect(res.json<{ code?: string }>().code).toBe("SERVICE_UNAVAILABLE");
  });

  it("extensión no soportada → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${G}/receipt-upload-url`,
      headers: token("u1"),
      body: { ext: "gif" },
    });
    expect([400, 503]).toContain(res.statusCode);
  });
});

describe("Validación del esquema supabase: en receipt_url", () => {
  it("acepta una ruta válida vía PATCH /receipt y la devuelve tal cual sin Supabase", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/expenses/e-plain/receipt",
      headers: token("u1"),
      body: { receiptUrl: "supabase:g-store-1/u1/nuevo.png" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ expense: { receiptUrl: string | null } }>().expense.receiptUrl).toBe(
      "supabase:g-store-1/u1/nuevo.png"
    );
  });

  it("rechaza rutas malformadas → 400", async () => {
    const bad = await app.inject({
      method: "PATCH",
      url: "/api/expenses/e-plain/receipt",
      headers: token("u1"),
      body: { receiptUrl: "supabase:ruta-sin-extension" },
    });
    expect(bad.statusCode).toBe(400);

    const evil = await app.inject({
      method: "PATCH",
      url: "/api/expenses/e-plain/receipt",
      headers: token("u1"),
      body: { receiptUrl: "supabase:g/x/..%2Fescape.jpg" },
    });
    expect(evil.statusCode).toBe(400);
  });

  it("sigue rechazando URLs externas que no sean data-imagen → 400", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/expenses/e-plain/receipt",
      headers: token("u1"),
      body: { receiptUrl: "https://ejemplo.com/tique.jpg" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("URL de lectura del tique", () => {
  it("gasto sin tique → 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/expenses/e-bare/receipt-url", headers: token("u1") });
    expect(res.statusCode).toBe(404);
  });

  it("gasto con tique en la nube → passthrough cuando Supabase está apagado", async () => {
    const res = await app.inject({ method: "GET", url: "/api/expenses/e-supabase/receipt-url", headers: token("u1") });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ url: string }>().url).toBe("supabase:g-store-1/u1/abc.jpg");
  });

  it("no miembro → 404 (anti-enumeración, como el resto de rutas)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/expenses/e-supabase/receipt-url", headers: token("u2") });
    expect(res.statusCode).toBe(404);
  });
});
