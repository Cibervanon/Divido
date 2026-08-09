import type { FastifyPluginAsync } from "fastify";
import {
  createRequest,
  decideRequest,
  deleteExpense,
  expenseParticipantIds,
  getExpense,
  getRequest,
  listMembers,
  listRequests,
  updateExpense,
} from "../store.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { requireActiveMember, requireAdmin, requireAuth } from "../plugins.js";
import { round2 } from "@divido/shared";

export const requestRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/expenses/:expenseId/modification-request", async (request) => {
    const { expenseId } = request.params as { expenseId: string };
    const user = requireAuth(request);
    const expense = getExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto no encontrado");
    const { member, group } = requireActiveMember(request, expense.group_id);
    const body = request.body as { action?: "edit" | "delete"; changes?: Record<string, unknown> };
    if (body.action !== "edit" && body.action !== "delete") throw badRequest("Acción inválida");
    if (expense.payer_id !== user.id && member.role !== "admin") {
      throw forbidden("Solo el creador del gasto (o un admin) puede solicitar cambios");
    }
    const pending = listRequests(request.db, group.id).find(
      (r) => r.expense_id === expenseId && r.status === "pending"
    );
    if (pending) throw conflict("Ya existe una solicitud pendiente para este gasto");
    const payload = body.action === "edit" ? sanitizeEdit(body.changes ?? {}, group.currency) : {};
    const req = createRequest(request.db, {
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
    requireAdmin(request, groupId);
    const requests = listRequests(request.db, groupId).map((r) => ({
      ...r,
      payload: JSON.parse(r.payload) as Record<string, unknown>,
      expenseDescription: getExpense(request.db, r.expense_id)?.description ?? "Gasto eliminado",
    }));
    return { requests };
  });

  app.post("/api/requests/:requestId/approve", async (request) => {
    const { requestId } = request.params as { requestId: string };
    const admin = requireAdminByRequest(request, requestId);
    const req = getRequest(request.db, requestId)!;
    if (req.status !== "pending") throw conflict("La solicitud ya fue decidida");
    applyRequest(request.db, req);
    decideRequest(request.db, requestId, "approved", admin.user_id);
    return { ok: true };
  });

  app.post("/api/requests/:requestId/reject", async (request) => {
    const { requestId } = request.params as { requestId: string };
    const admin = requireAdminByRequest(request, requestId);
    const req = getRequest(request.db, requestId)!;
    if (req.status !== "pending") throw conflict("La solicitud ya fue decidida");
    decideRequest(request.db, requestId, "rejected", admin.user_id);
    return { ok: true };
  });
};

function requireAdminByRequest(request: import("fastify").FastifyRequest, requestId: string) {
  const req = getRequest(request.db, requestId);
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
  if (typeof changes.payerId === "string") out.payerId = changes.payerId;
  if (Array.isArray(changes.participants) && changes.participants.every((p) => typeof p === "string")) {
    out.participants = changes.participants as string[];
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

function applyRequest(
  db: import("node:sqlite").DatabaseSync,
  req: { expense_id: string; action: string; payload: string }
) {
  const expense = getExpense(db, req.expense_id);
  if (!expense) throw notFound("El gasto ya no existe");
  const group = db.prepare("SELECT currency FROM groups WHERE id = ?").get(expense.group_id) as {
    currency: string;
  };
  if (req.action === "delete") {
    deleteExpense(db, req.expense_id);
    return;
  }
  const changes = JSON.parse(req.payload) as Record<string, unknown>;
  const activeIds = new Set(
    listMembers(db, expense.group_id)
      .filter((m) => m.status === "active")
      .map((m) => m.user_id)
  );
  const participants = Array.isArray(changes.participants)
    ? (changes.participants as string[]).filter((p) => activeIds.has(p))
    : expenseParticipantIds(db, req.expense_id);
  if (participants.length === 0) throw badRequest("El gasto necesita al menos un participante");
  const payerId = typeof changes.payerId === "string" ? changes.payerId : expense.payer_id;
  const currency = typeof changes.currency === "string" ? changes.currency : expense.currency;
  const amount = typeof changes.amount === "number" ? changes.amount : expense.amount;
  const exchangeRate =
    currency !== group.currency && typeof changes.exchangeRate === "number"
      ? changes.exchangeRate
      : expense.exchange_rate;
  updateExpense(db, req.expense_id, {
    description: typeof changes.description === "string" ? changes.description : expense.description,
    amount,
    currency,
    exchangeRate,
    amountGroup: round2(amount * exchangeRate),
    payerId,
    participants,
  });
}
