import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";
import { createTestDb } from "./helpers/sqliteDb.js";
import { signToken } from "../auth.js";

process.env.LOG_LEVEL = "silent";
process.env.RATE_LIMIT_MAX = "100000";

const G = "g-page-1";
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
  await db.prepare("INSERT INTO groups (id, name, invite_token, creator_id, created_at) VALUES (?, 'G', 'tok-page-01', 'u1', ?)").run(G, now);
  await db.prepare("INSERT INTO group_members (group_id, user_id, role, status, joined_at) VALUES (?, 'u1', 'admin', 'active', ?)").run(G, now);
  // 120 gastos con fechas escalonadas (DESC por created_at)
  for (let i = 0; i < 120; i++) {
    const desc = i % 2 === 0 ? `Pizza ${i}` : `Taxi ${i}`;
    const date = new Date(Date.UTC(2026, 0, 1 + Math.floor(i / 30), i % 24)).toISOString();
    await db.prepare(
      `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at)
       VALUES (?, ?, 'u1', ?, ?, 'EUR', 1, ?, 'u1', ?, ?)`
    ).run(`e-${String(i).padStart(3, "0")}`, G, desc, 10 + i, 10 + i, date, date);
  }
});

afterAll(async () => {
  await app?.close();
});

describe("Paginación de gastos", () => {
  it("primera página: 50 items, total 120, hasMore", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G}/expenses?limit=50&offset=0`, headers: token("u1") });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ expenses: unknown[]; total: number; hasMore: boolean }>();
    expect(body.expenses).toHaveLength(50);
    expect(body.total).toBe(120);
    expect(body.hasMore).toBe(true);
  });

  it("última página: 20 items y hasMore=false", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G}/expenses?limit=50&offset=100`, headers: token("u1") });
    const body = res.json<{ expenses: unknown[]; total: number; hasMore: boolean }>();
    expect(body.expenses).toHaveLength(20);
    expect(body.hasMore).toBe(false);
  });

  it("sin limit devuelve todo (retrocompatibilidad)", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G}/expenses`, headers: token("u1") });
    const body = res.json<{ expenses: unknown[]; hasMore: boolean }>();
    expect(body.expenses).toHaveLength(120);
    expect(body.hasMore).toBe(false);
  });

  it("limit se acota al máximo 200 y mínimo 1", async () => {
    const big = await app.inject({ method: "GET", url: `/api/groups/${G}/expenses?limit=99999`, headers: token("u1") });
    expect(big.json<{ expenses: unknown[] }>().expenses.length).toBeLessThanOrEqual(200);
    const tiny = await app.inject({ method: "GET", url: `/api/groups/${G}/expenses?limit=-5`, headers: token("u1") });
    expect(tiny.json<{ expenses: unknown[] }>().expenses.length).toBe(1);
  });

  it("total respeta los filtros aplicados (q=Pizza → 60)", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G}/expenses?q=pizza&limit=10`, headers: token("u1") });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ total: number; expenses: Array<{ description: string }> }>();
    expect(body.total).toBe(60);
    expect(body.expenses.every((e) => e.description.toLowerCase().includes("pizza"))).toBe(true);
  });
});

describe("Paginación del historial", () => {
  it("limit/offset sobre el feed combinado con total y hasMore", async () => {
    const first = await app.inject({ method: "GET", url: `/api/groups/${G}/history?limit=100&offset=0`, headers: token("u1") });
    const b1 = first.json<{ events: unknown[]; total: number; hasMore: boolean }>();
    expect(b1.events).toHaveLength(100);
    expect(b1.total).toBe(120); // solo eventos tipo gasto en este seed
    expect(b1.hasMore).toBe(true);

    const last = await app.inject({ method: "GET", url: `/api/groups/${G}/history?limit=100&offset=100`, headers: token("u1") });
    const b2 = last.json<{ events: unknown[]; hasMore: boolean }>();
    expect(b2.events).toHaveLength(20);
    expect(b2.hasMore).toBe(false);
  });
});
