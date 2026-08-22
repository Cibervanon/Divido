import type { FastifyPluginAsync } from "fastify";
import {
  anonymizeUser,
  listExpenses,
  listInformalDebtsForUser,
  listMembers,
  listPayments,
  listUserActiveGroupIds,
  parseStringArray,
  setMemberStatus,
  setRole,
  updateUser,
} from "../store.js";
import { badRequest } from "../errors.js";
import { requireAuth } from "../plugins.js";
import { sendVerificationEmail } from "../email.js";
import { getGroupBalances } from "../services.js";

const HTTP_URL_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\/[a-z+]+;base64,/i;
const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

const PHONE_RE = /^[0-9+\s().-]{5,20}$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{2,50}$/;

function normalizeHandle(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (value === "") return null;
  const cleaned = value.replace(/^@/, "").replace(/^https?:\/\/(revolut\.me|paypal\.me)\//i, "").split("?")[0];
  if (!USERNAME_RE.test(cleaned)) throw badRequest("El usuario solo puede contener letras, números y . _ -");
  return cleaned;
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.patch("/api/users/me", async (request) => {
    const user = requireAuth(request);
    const body = request.body as {
      name?: string;
      avatarUrl?: string | null;
      phone?: string | null;
      revolut?: string | null;
      paypal?: string | null;
      pinnedGroupIds?: string[];
      autoConfirmPayments?: boolean;
    };
    const patch: {
      name?: string;
      avatarUrl?: string | null;
      phone?: string | null;
      revolut?: string | null;
      paypal?: string | null;
      pinnedGroupIds?: string[];
      autoConfirmPayments?: boolean;
    } = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) throw badRequest("El nombre no puede estar vacío");
      patch.name = body.name.trim().slice(0, 80);
    }

    if (body.avatarUrl !== undefined) {
      const url = (body.avatarUrl ?? "").trim();
      if (url === "") {
        patch.avatarUrl = null;
      } else if (HTTP_URL_RE.test(url)) {
        patch.avatarUrl = url.slice(0, 2048);
      } else if (DATA_IMAGE_RE.test(url)) {
        const size = Math.ceil((url.length - url.indexOf(",") - 1) * 0.75);
        if (size > MAX_AVATAR_BYTES) {
          throw badRequest("La imagen es demasiado grande (máximo 4 MB)");
        }
        patch.avatarUrl = url;
      } else {
        throw badRequest("URL de avatar inválida");
      }
    }

    if (body.phone !== undefined) {
      const phone = body.phone?.trim() ?? "";
      if (phone !== "" && !PHONE_RE.test(phone)) throw badRequest("Número de teléfono inválido");
      patch.phone = phone === "" ? null : phone;
    }

    if (body.revolut !== undefined) patch.revolut = normalizeHandle(body.revolut);
    if (body.paypal !== undefined) patch.paypal = normalizeHandle(body.paypal);

    if (body.pinnedGroupIds !== undefined) {
      const ids = Array.isArray(body.pinnedGroupIds) ? body.pinnedGroupIds.map((v) => String(v).trim()) : [];
      patch.pinnedGroupIds = ids.slice(0, 50);
    }

    if (body.autoConfirmPayments !== undefined) {
      patch.autoConfirmPayments = Boolean(body.autoConfirmPayments);
    }

    if (Object.keys(patch).length === 0) throw badRequest("Sin cambios");
    const updated = await updateUser(request.db, user.id, patch);
    return { user: toPublicUser(updated) };
  });

  app.post("/api/users/me/send-verification-email", async (request) => {
    const user = requireAuth(request);
    if (user.emailVerified) return { alreadyVerified: true };
    if (!user.email) throw badRequest("Tu cuenta no tiene email asociado");
    const result = await sendVerificationEmail(request.db, user.email);
    return {
      alreadyVerified: result.alreadyVerified,
      sent: result.sent,
      verificationUrl: result.verificationUrl,
      expiresAt: result.expiresAt,
    };
  });

  // Export de datos personales (GDPR art. 15/20): JSON descargable con todo lo
  // que la app guarda del usuario.
  app.get("/api/users/me/export", async (request) => {
    const user = requireAuth(request);
    const [groups, payments, debts] = await Promise.all([
      request.db.prepare("SELECT * FROM group_members WHERE user_id = ?").all(user.id),
      listPaymentsForUser(request.db, user.id),
      listInformalDebtsForUser(request.db, user.id),
    ]);

    const groupExports = [];
    for (const m of groups) {
      const groupId = String(m.group_id);
      const expenses = (await listExpenses(request.db, groupId, true)).filter(
        (e) => e.payer_id === user.id || e.created_by_id === user.id
      );
      groupExports.push({
        groupId,
        role: m.role,
        status: m.status,
        joinedAt: m.joined_at,
        leftAt: m.left_at,
        frozenBalance: m.frozen_balance,
        expensesCreatedByOrPaid: expenses,
      });
    }

    const profile = await request.db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    return {
      exportedAt: new Date().toISOString(),
      profile,
      groups: groupExports,
      payments,
      informalDebts: debts,
    };
  });

  // Baja de cuenta (GDPR art. 17): anonimiza el perfil, congela el saldo en los
  // grupos activos (como al abandonar) y revoca todas las sesiones.
  app.delete("/api/users/me", async (request) => {
    const user = requireAuth(request);
    const activeGroupIds = await listUserActiveGroupIds(request.db, user.id);

    for (const groupId of activeGroupIds) {
      const bal = await getGroupBalances(request.db, groupId);
      const frozen = bal.balances.find((b) => b.userId === user.id)?.net ?? null;
      const admins = (await listMembers(request.db, groupId)).filter(
        (m) => m.status === "active" && m.role === "admin" && m.user_id !== user.id
      );
      await setMemberStatus(request.db, groupId, user.id, "ex_member", new Date().toISOString(), frozen);
      if (admins.length === 0) {
        const remaining = (await listMembers(request.db, groupId)).filter((m) => m.status === "active");
        if (remaining.length > 0) {
          await setRole(request.db, groupId, remaining[0].user_id, "admin");
        }
      }
    }

    await anonymizeUser(request.db, user.id);
    return { ok: true };
  });
};

async function listPaymentsForUser(db: import("../db.js").Db, userId: string) {
  return db.prepare(
    `SELECT p.*, g.name AS group_name FROM payments p
     JOIN groups g ON g.id = p.group_id
     WHERE p.from_user_id = ? OR p.to_user_id = ?
     ORDER BY p.created_at DESC`
  ).all(userId, userId);
}

function toPublicUser(user: {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  email_verified: number;
  phone: string | null;
  revolut: string | null;
  paypal: string | null;
  pinned_group_ids: string;
  auto_confirm_payments: number;
}) {
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name,
    avatarUrl: user.avatar_url,
    emailVerified: Boolean(user.email_verified),
    phone: user.phone,
    revolut: user.revolut,
    paypal: user.paypal,
    pinnedGroupIds: parseStringArray(user.pinned_group_ids),
    autoConfirmPayments: Boolean(user.auto_confirm_payments),
  };
}
