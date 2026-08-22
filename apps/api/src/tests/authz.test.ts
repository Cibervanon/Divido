import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../index.js";
import { createTestDb } from "./helpers/sqliteDb.js";
import { signToken } from "../auth.js";

process.env.LOG_LEVEL = "silent";
process.env.RATE_LIMIT_MAX = "100000";

// ── Escenario sembrado ────────────────────────────────────────────────
// u-admin   → admin de g1
// u-member  → miembro normal de g1 (propietario del gasto e1)
// u-outsider→ usuario válido SIN membresía en g1
// u-ghost   → miembro fantasma de g1
const G1 = "g-test-1";
const E1 = "e-test-1";
const USERS = {
  admin: { id: "u-admin", name: "Admin" },
  member: { id: "u-member", name: "Member" },
  outsider: { id: "u-outsider", name: "Outsider" },
  ghost: { id: "u-ghost", name: "Fantasma" },
} as const;

let app: FastifyInstance;

function authHeader(userId: string) {
  const user = { id: userId, email: "", name: userId, avatarUrl: null, emailVerified: true, phone: null, revolut: null, paypal: null };
  return { authorization: `Bearer ${signToken(user)}` };
}

async function seed(db: Awaited<ReturnType<typeof createTestDb>>) {
  const now = new Date().toISOString();
  for (const u of Object.values(USERS)) {
    await db.prepare("INSERT INTO users (id, name, is_ghost, created_at) VALUES (?, ?, ?, ?)").run(
      u.id,
      u.name,
      u.id === USERS.ghost.id ? 1 : 0,
      now
    );
  }
  await db.prepare("INSERT INTO groups (id, name, invite_token, creator_id, created_at) VALUES (?, ?, ?, ?, ?)").run(
    G1,
    "Grupo Test",
    "tok-seed-0001",
    USERS.admin.id,
    now
  );
  const memberships: Array<[string, string]> = [
    [USERS.admin.id, "admin"],
    [USERS.member.id, "member"],
    [USERS.ghost.id, "member"],
  ];
  for (const [userId, role] of memberships) {
    await db.prepare("INSERT INTO group_members (group_id, user_id, role, status, joined_at) VALUES (?, ?, ?, 'active', ?)").run(
      G1,
      userId,
      role,
      now
    );
  }
  await db.prepare(
    `INSERT INTO expenses (id, group_id, payer_id, description, amount, currency, exchange_rate, amount_group, created_by_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'EUR', 1, ?, ?, ?, ?)`
  ).run(E1, G1, USERS.member.id, "Cena test", 30, 30, USERS.member.id, now, now);
}

beforeAll(async () => {
  const db = createTestDb();
  app = await buildApp(db, { migrations: false }); // crea tablas
  await seed(db); // siembra datos una vez existen las tablas
});

afterAll(async () => {
  await app?.close();
});

describe("Barrido de autorización — anónimo", () => {
  const cases: Array<[string, string, string]> = [
    ["GET", "/api/groups", "listar grupos"],
    ["POST", "/api/groups", "crear grupo"],
    ["GET", `/api/groups/${G1}/expenses`, "listar gastos"],
    ["POST", `/api/groups/${G1}/expenses`, "crear gasto"],
    ["GET", `/api/groups/${G1}/balances`, "balances"],
    ["PATCH", `/api/groups/${G1}`, "editar grupo"],
    ["DELETE", `/api/groups/${G1}`, "borrar grupo"],
    ["PATCH", `/api/expenses/${E1}`, "editar gasto"],
    ["DELETE", `/api/expenses/${E1}`, "borrar gasto"],
    ["POST", `/api/groups/${G1}/members/${USERS.member.id}/role`, "cambiar rol"],
    ["POST", `/api/groups/${G1}/ghost-members`, "crear fantasma"],
    ["DELETE", `/api/groups/${G1}/members/${USERS.member.id}`, "expulsar miembro"],
    ["GET", "/api/auth/me", "perfil propio"],
    ["GET", "/api/notifications", "notificaciones"],
    ["DELETE", "/api/users/me", "baja de cuenta"],
  ];

  for (const [method, url, label] of cases) {
    it(`401 sin token: ${label}`, async () => {
      const res = await app.inject({ method: method as never, url });
      expect(res.statusCode).toBe(401);
    });
  }
});

describe("Barrido de autorización — miembro no admin", () => {
  it("403 al editar el grupo", async () => {
    const res = await app.inject({ method: "PATCH", url: `/api/groups/${G1}`, headers: authHeader(USERS.member.id), payload: { name: "Hack" } });
    expect(res.statusCode).toBe(403);
  });

  it("403 al borrar el grupo", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/groups/${G1}`, headers: authHeader(USERS.member.id) });
    expect(res.statusCode).toBe(403);
  });

  it("403 al leer el token de invitación", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G1}/invite`, headers: authHeader(USERS.member.id) });
    expect(res.statusCode).toBe(403);
  });

  it("403 al auto-promoverse a admin", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${G1}/members/${USERS.member.id}/role`,
      headers: authHeader(USERS.member.id),
      payload: { role: "admin" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("403 al crear miembros fantasma", async () => {
    const res = await app.inject({ method: "POST", url: `/api/groups/${G1}/ghost-members`, headers: authHeader(USERS.member.id), payload: { name: "Sombra" } });
    expect(res.statusCode).toBe(403);
  });

  it("403 al expulsar a otro miembro", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/groups/${G1}/members/${USERS.admin.id}`, headers: authHeader(USERS.member.id) });
    expect(res.statusCode).toBe(403);
  });

  it("200 leyendo auditoría siendo miembro activo", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G1}/audit`, headers: authHeader(USERS.member.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("audit");
  });

  it("200 listando gastos propios del grupo", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G1}/expenses`, headers: authHeader(USERS.member.id) });
    expect(res.statusCode).toBe(200);
  });
});

describe("Barrido de autorización — usuario externo (sin membresía)", () => {
  it("404 al listar gastos de un grupo ajeno", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G1}/expenses`, headers: authHeader(USERS.outsider.id) });
    expect(res.statusCode).toBe(404);
  });

  it("404 al ver balances de un grupo ajeno", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G1}/balances`, headers: authHeader(USERS.outsider.id) });
    expect(res.statusCode).toBe(404);
  });

  it("404 al crear gasto en un grupo ajeno", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${G1}/expenses`,
      headers: authHeader(USERS.outsider.id),
      payload: { description: "Intruso", amount: 5, participantIds: [USERS.outsider.id] },
    });
    expect(res.statusCode).toBe(404);
  });

  it("404 al leer la auditoría de un grupo ajeno", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G1}/audit`, headers: authHeader(USERS.outsider.id) });
    expect(res.statusCode).toBe(404);
  });
});

describe("Reglas especiales de negocio", () => {
  it("400: un miembro fantasma no puede ser promovido a admin (aunque lo pida un admin)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${G1}/members/${USERS.ghost.id}/role`,
      headers: authHeader(USERS.admin.id),
      payload: { role: "admin" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("sin cuenta");
  });

  it("400: rol inválido rechazado antes de tocar la base de datos", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${G1}/members/${USERS.member.id}/role`,
      headers: authHeader(USERS.admin.id),
      payload: { role: "superadmin" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("Cordura — perfiles legítimos funcionan", () => {
  it("admin lista sus grupos", async () => {
    const res = await app.inject({ method: "GET", url: "/api/groups", headers: authHeader(USERS.admin.id) });
    expect(res.statusCode).toBe(200);
  });

  it("admin obtiene token de invitación", async () => {
    const res = await app.inject({ method: "GET", url: `/api/groups/${G1}/invite`, headers: authHeader(USERS.admin.id) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("inviteToken");
  });

  it("member ve su perfil", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me", headers: authHeader(USERS.member.id) });
    expect(res.statusCode).toBe(200);
  });
});
