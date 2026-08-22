import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db.js";
import {
  createRequest,
  decideRequest,
  deleteExpense,
  deletePotExpenseWithdrawal,
  expenseParticipantIds,
  getExpense,
  getPotBalance,
  getPotExpenseWithdrawal,
  getRequest,
  listMembers,
  listRequests,
  updateExpense,
  upsertPotExpenseWithdrawal,
} from "../store.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { requireActiveMember, requireAdmin, requireAuth } from "../plugins.js";
import { EPS, round2 } from "@divido/shared";
import { invalidateBalanceCache } from "../balanceCache.js";
import { logAudit } from "../audit.js";
import { publishGroupEvent } from "../lib/supabase.js";

const DATA_IMAGE_RE = /^data:image\/[a-z+]+;base64,/i;
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export const requestRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/expenses/:expenseId/modification-request", async (request) => {
    const { expenseId } = request.params as { expenseId: string };
    const user = requireAuth(request);
    const expense = await getExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto no encontrado");
    const { member, group } = await requireActiveMember(request, expense.group_id);
    const body = request.body as { action?: "edit" | "delete"; changes?: Record<string, unknown> };
    if (body.action !== "edit" && body.action !== "delete") throw badRequest("Acción inválida");
    if (expense.payer_id !== user.id && member.role !== "admin") {
      throw forbidden("Solo el creador del gasto (o un admin) puede solicitar cambios");
    }
    const pending = (await listRequests(request.db, group.id)).find(
      (r) => r.expense_id === expenseId && r.status === "pending"
    );
    if (pending) throw conflict("Ya existe una solicitud pendiente para este gasto");
    const payload = body.action === "edit" ? sanitizeEdit(body.changes ?? {}, group.currency) : {};
    const req = await createRequest(request.db, {
      groupId: group.id,
      expenseId,
      requesterId: user.id,
      action: body.action,
      payload,
    });
    return { request: req };
  });

  app.get("/api/groups/:groupId/requests", async (request) => {
    const { groupId } = request.params as { groupId: string };
    await requireAdmin(request, groupId);
    const requests = (await listRequests(request.db, groupId)).map(async (r) => ({
      ...r,
      payload: JSON.parse(r.payload) as Record<string, unknown>,
      expenseDescription: (await getExpense(request.db, r.expense_id))?.description ?? "Gasto eliminado",
    }));
    return { requests: await Promise.all(requests) };
  });

  app.post("/api/requests/:requestId/approve", async (request) => {
    const { requestId } = request.params as { requestId: string };
    const admin = await requireAdminByRequest(request, requestId);
    const req = (await getRequest(request.db, requestId))!;
    if (req.status !== "pending") throw conflict("La solicitud ya fue decidida");
    await applyRequest(request.db, req);
    await decideRequest(request.db, requestId, "approved", admin.user_id);
    invalidateBalanceCache(req.group_id);
    publishGroupEvent(req.group_id, "expense.changed");
    await logAudit(request.db, {
      groupId: req.group_id,
      entityType: "modification_request",
      entityId: requestId,
      action: "approved",
      actorId: admin.user_id,
      actorName: admin.name,
      before: { status: "pending" },
      after: { status: "approved" },
    });
    return { ok: true };
  });

  app.post("/api/requests/:requestId/reject", async (request) => {
    const { requestId } = request.params as { requestId: string };
    const admin = await requireAdminByRequest(request, requestId);
    const req = (await getRequest(request.db, requestId))!;
    if (req.status !== "pending") throw conflict("La solicitud ya fue decidida");
    await decideRequest(request.db, requestId, "rejected", admin.user_id);
    invalidateBalanceCache(req.group_id);
    publishGroupEvent(req.group_id, "requests.changed");
    await logAudit(request.db, {
      groupId: req.group_id,
      entityType: "modification_request",
      entityId: requestId,
      action: "rejected",
      actorId: admin.user_id,
      actorName: admin.name,
      before: { status: "pending" },
      after: { status: "rejected" },
    });
    return { ok: true };
  });
};

async function requireAdminByRequest(request: import("fastify").FastifyRequest, requestId: string) {
  const req = await getRequest(request.db, requestId);
  if (!req) throw notFound("Solicitud no encontrada");
  return requireAdmin(request, req.group_id);
}

function sanitizeEdit(changes: Record<string, unknown>, groupCurrency: string) {
  const out: Record<string, unknown> = {};
  if (typeof changes.description === "string" && changes.description.trim()) {
    out.description = changes.description.trim();
  }
  if (typeof changes.amount === "number" && Number.isFinite(changes.amount) && changes.amount > 0) {
    out.amount = round2(changes.amount);
  }
  if (typeof changes.payerId === "string" || changes.payerId === null) out.payerId = changes.payerId;
  if (typeof changes.paidFromPot === "boolean") out.paidFromPot = changes.paidFromPot;
  if (typeof changes.category === "string" && /^[a-z0-9_-]{1,40}$/i.test(changes.category)) {
    out.category = changes.category.toLowerCase();
  }
  if (typeof changes.iconName === "string" && /^[a-z0-9-]{1,40}$/i.test(changes.iconName)) {
    out.iconName = changes.iconName;
  }
  if (typeof changes.isCustomIcon === "boolean") out.isCustomIcon = changes.isCustomIcon;
  if ("receiptUrl" in changes && (changes.receiptUrl === null || typeof changes.receiptUrl === "string")) {
    const parsed = parseReceiptUrl(changes.receiptUrl);
    if (parsed !== null || changes.receiptUrl === null) out.receiptUrl = parsed;
  }
  if (Array.isArray(changes.participants) && changes.participants.every((p) => typeof p === "string")) {
    out.participants = changes.participants as string[];
  }
  if (changes.shares && typeof changes.shares === "object" && !Array.isArray(changes.shares)) {
    const shares: Record<string, number> = {};
    for (const [k, v] of Object.entries(changes.shares as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) shares[k] = round2(n);
    }
    if (Object.keys(shares).length) out.shares = shares;
  }
  if (typeof changes.currency === "string") {
    const cur = changes.currency.toUpperCase();
    out.currency = cur;
    if (cur !== groupCurrency) {
      const rate = Number(changes.exchangeRate);
      if (Number.isFinite(rate) && rate > 0) out.exchangeRate = rate;
    }
  }
  return out;
}

async function applyRequest(
  db: Db,
  req: { expense_id: string; action: string; payload: string }
) {
  const expense = await getExpense(db, req.expense_id);
  if (!expense) throw notFound("El gasto ya no existe");
  const group = (await db.prepare("SELECT currency FROM groups WHERE id = ?").get(expense.group_id)) as {
    currency: string;
  };
  if (req.action === "delete") {
    await deleteExpense(db, req.expense_id);
    return;
  }
  const changes = JSON.parse(req.payload) as Record<string, unknown>;
  const activeIds = new Set(
    (await listMembers(db, expense.group_id))
      .filter((m) => m.status === "active")
      .map((m) => m.user_id)
  );
  const participants = Array.isArray(changes.participants)
    ? (changes.participants as string[]).filter((p) => activeIds.has(p))
    : await expenseParticipantIds(db, req.expense_id);
  if (participants.length === 0) throw badRequest("El gasto necesita al menos un participante");
  const wasPaidFromPot = Boolean(expense.paid_from_pot);
  const paidFromPot = typeof changes.paidFromPot === "boolean" ? changes.paidFromPot : wasPaidFromPot;
  if (paidFromPot && !wasPaidFromPot) {
    const extras = (await db.prepare("SELECT enabled_extras FROM groups WHERE id = ?").get(expense.group_id)) as {
      enabled_extras: string;
    };
    if (!JSON.parse(extras.enabled_extras).includes("common_pot")) {
      throw badRequest("El extra de bote común no está activo en este grupo");
    }
  }
  const payerId = paidFromPot
    ? null
    : typeof changes.payerId === "string"
      ? changes.payerId
      : expense.payer_id ?? expense.created_by_id;
  const currency = typeof changes.currency === "string" ? changes.currency : expense.currency;
  const amount = typeof changes.amount === "number" ? changes.amount : expense.amount;
  const exchangeRate =
    currency !== group.currency && typeof changes.exchangeRate === "number"
      ? changes.exchangeRate
      : expense.exchange_rate;
  const amountGroup = round2(amount * exchangeRate);
  if (paidFromPot) {
    const potBalance = await getPotBalance(db, expense.group_id);
    const withdrawal = await getPotExpenseWithdrawal(db, req.expense_id);
    const available = potBalance - (withdrawal?.amount ?? 0);
    if (available + EPS < amountGroup) {
      throw badRequest("Saldo insuficiente en el bote común");
    }
  }
  const receiptUrl =
    changes.receiptUrl === null || typeof changes.receiptUrl === "string"
      ? (changes.receiptUrl as string | null)
      : expense.receipt_url;
  let shares: Record<string, number> | undefined;
  if (
    Array.isArray(changes.participants) &&
    changes.shares &&
    typeof changes.shares === "object" &&
    !Array.isArray(changes.shares)
  ) {
    const candidate = changes.shares as Record<string, number>;
    const valid = participants.every((p) => Number.isFinite(Number(candidate[p])) && Number(candidate[p]) >= 0);
    const sum = participants.reduce((s, p) => s + Number(candidate[p]), 0);
    if (valid && Math.abs(sum - amountGroup) <= Math.max(0.02, participants.length * 0.01)) {
      shares = candidate;
    }
  }
  await updateExpense(db, req.expense_id, {
    description: typeof changes.description === "string" ? changes.description : expense.description,
    amount,
    currency,
    exchangeRate,
    amountGroup,
    payerId,
    paidFromPot,
    receiptUrl,
    participants,
    shares,
    category: typeof changes.category === "string" ? changes.category : expense.category,
    iconName: typeof changes.iconName === "string" ? changes.iconName : expense.icon_name,
    isCustomIcon: typeof changes.isCustomIcon === "boolean" ? changes.isCustomIcon : Boolean(expense.is_custom_icon),
  });
  const description = typeof changes.description === "string" ? changes.description : expense.description;
  if (paidFromPot) {
    await upsertPotExpenseWithdrawal(db, {
      groupId: expense.group_id,
      expenseId: req.expense_id,
      amountGroup,
      description,
    });
  } else if (wasPaidFromPot) {
    await deletePotExpenseWithdrawal(db, req.expense_id);
  }
}

function parseReceiptUrl(raw: string | null): string | null {
  if (raw === null || raw === "") return null;
  if (!DATA_IMAGE_RE.test(raw)) throw badRequest("El tique debe ser una imagen");
  const comma = raw.indexOf(",");
  const bytes = Math.ceil(((raw.length - comma - 1) * 3) / 4);
  if (bytes > MAX_RECEIPT_BYTES) throw badRequest("El tique supera los 5 MB");
  return raw;
}
