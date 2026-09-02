import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";
import { createTestDb } from "./helpers/sqliteDb.js";
import { signToken } from "../auth.js";

process.env.LOG_LEVEL = "silent";
process.env.RATE_LIMIT_MAX = "100000";

const G = "g-pay-1";
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
  await db.prepare("INSERT INTO users (id, name, created_at, auto_confirm_payments) VALUES ('u2', 'Dos', ?, 0)").run(now);
  await db.prepare("INSERT INTO groups (id, name, invite_token, creator_id, created_at) VALUES (?, 'G', 'tok-pay-01', 'u1', ?)").run(G, now);
  await db.prepare("INSERT INTO group_members (group_id, user_id, role, status, joined_at) VALUES (?, 'u1', 'admin', 'active', ?)").run(G, now);
  await db.prepare("INSERT INTO group_members (group_id, user_id, role, status, joined_at) VALUES (?, 'u2', 'member', 'active', ?)").run(G, now);
});

afterAll(async () => {
  await app?.close();
});

describe("Flujo de pago pendiente (create → pending → confirmar → accepted)", () => {
  it("crea un pago sin comprobante que queda 'pending' y aparece en el historial con status pending", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${G}/payments`,
      headers: token("u1"),
      payload: { toUserId: "u2", amount: 25.5, note: "Cena" },
    });
    expect(res.statusCode).toBe(200);
    const created = res.json<{ payment: { id: string; status: string } }>();
    expect(created.payment.status).toBe("pending");

    const hist = await app.inject({
      method: "GET",
      url: `/api/groups/${G}/history?limit=100&offset=0`,
      headers: token("u1"),
    });
    expect(hist.statusCode).toBe(200);
    const events = hist.json<{ events: Array<Record<string, unknown>> }>().events;
    const payEvent = events.find((e) => e.id === created.payment.id);
    expect(payEvent).toBeTruthy();
    expect(payEvent!.type).toBe("payment");
    expect(payEvent!.status).toBe("pending");
    expect(payEvent!.fromUserId).toBe("u1");
    expect(payEvent!.toUserId).toBe("u2");
    created.payment.id;
  });

  it("el destinatario (u2) ve el pago pendiente como entrante en el historial", async () => {
    const hist = await app.inject({
      method: "GET",
      url: `/api/groups/${G}/history?limit=100&offset=0`,
      headers: token("u2"),
    });
    const events = hist.json<{ events: Array<{ type: string; status: string; toUserId: string }> }>().events;
    const pendingInbound = events.filter((e) => e.type === "payment" && e.status === "pending" && e.toUserId === "u2");
    expect(pendingInbound.length).toBeGreaterThan(0);
  });

  it("el emisor (u1) NO puede confirmar su propio pago, pero sí el destinatario", async () => {
    const hist = await app.inject({ method: "GET", url: `/api/groups/${G}/history?limit=100`, headers: token("u1") });
    const ev = hist.json<{ events: Array<{ id: string; type: string; status: string }> }>().events.find((e) => e.type === "payment" && e.status === "pending");
    expect(ev).toBeTruthy();

    const self = await app.inject({
      method: "PATCH",
      url: `/api/payments/${ev!.id}/confirm`,
      headers: token("u1"),
      payload: { accepted: true },
    });
    expect(self.statusCode).toBe(403);

    const ok = await app.inject({
      method: "PATCH",
      url: `/api/payments/${ev!.id}/confirm`,
      headers: token("u2"),
      payload: { accepted: true },
    });
    expect(ok.statusCode).toBe(200);
  });

  it("tras confirmar, el evento pasa a 'accepted' y el balance del receptor aumenta", async () => {
    const hist = await app.inject({ method: "GET", url: `/api/groups/${G}/history?limit=100`, headers: token("u2") });
    const events = hist.json<{ events: Array<Record<string, unknown>> }>().events;
    const payEvent = events.find((e) => e.type === "payment" && e.fromUserId === "u1" && e.toUserId === "u2");
    expect(payEvent!.status).toBe("accepted");
  });

  it("un pago con comprobante nace directamente 'accepted'", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${G}/payments`,
      headers: token("u1"),
      payload: { toUserId: "u2", amount: 10, note: "Comp", proofUrl: "data:image/png;base64,aGVsbG8=" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ payment: { status: string } }>().payment.status).toBe("accepted");
  });
});

describe("El balance refleja la aceptación de un pago (deuda → liquidación)", () => {
  const BG = "g-balance-1";
  let payId = "";

  beforeAll(async () => {
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO groups (id, name, invite_token, creator_id, created_at) VALUES (?, 'B', 'tok-bal-01', 'u1', ?)").run(BG, now);
    await db.prepare("INSERT INTO group_members (group_id, user_id, role, status, joined_at) VALUES (?, 'u1', 'admin', 'active', ?)").run(BG, now);
    await db.prepare("INSERT INTO group_members (group_id, user_id, role, status, joined_at) VALUES (?, 'u2', 'member', 'active', ?)").run(BG, now);
    // u1 pagó un gasto de 10 que comparte con u2 a medias ⇒ u2 debe 5 a u1.
    await db.prepare(
      `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at)
       VALUES ('be1', ?, 'u1', 'Cena', 10, 'EUR', 1, 10, 'u1', ?, ?)`
    ).run(BG, now, now);
    await db.prepare("INSERT INTO expense_participants (expense_id, user_id) VALUES ('be1', 'u1')").run();
    await db.prepare("INSERT INTO expense_participants (expense_id, user_id) VALUES ('be1', 'u2')").run();
  });

  it("u2 debe 5 antes del pago", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${BG}/balances`, headers: token("u1") });
    const b = res.json<{ balances: Array<{ userId: string; net: number }> }>().balances;
    const me = b.find((x) => x.userId === "u2");
    expect(me!.net).toBe(-5);
  });

  it("u2 paga 5 a u1 (pending) y el balance NO cambia hasta aceptar", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/groups/${BG}/payments`,
      headers: token("u2"),
      payload: { toUserId: "u1", amount: 5, note: "Liquidar" },
    });
    expect(created.statusCode).toBe(200);
    payId = created.json<{ payment: { id: string } }>().payment.id;

    const res = await app.inject({ method: "GET", url: `/api/groups/${BG}/balances`, headers: token("u1") });
    const b = res.json<{ balances: Array<{ userId: string; net: number }> }>().balances;
    expect(b.find((x) => x.userId === "u2")!.net).toBe(-5);
  });

  it("al aceptar u1, la deuda de u2 se liquida (net pasa a 0)", async () => {
    const ok = await app.inject({
      method: "PATCH",
      url: `/api/payments/${payId}/confirm`,
      headers: token("u1"),
      payload: { accepted: true },
    });
    expect(ok.statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: `/api/groups/${BG}/balances`, headers: token("u1") });
    const b = res.json<{ balances: Array<{ userId: string; net: number }> }>().balances;
    expect(b.find((x) => x.userId === "u2")!.net).toBe(0);
  });
});