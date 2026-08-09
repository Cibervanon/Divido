import type { FastifyPluginAsync } from "fastify";
import {
  createExpense,
  deleteExpense,
  expenseParticipantIds,
  getExpense,
  getMemberRow,
  listExpenses,
  listMembers,
  updateExpense,
} from "../store.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { requireActiveMember, requireAuth } from "../plugins.js";
import { EDIT_WINDOW_MS } from "../config.js";

export const expenseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/groups/:groupId/expenses", async (request) => {
    const { groupId } = request.params as { groupId: string };
    await requireActiveMember(request, groupId);
    const user = requireAuth(request);
    const member = await getMemberRow(request.db, groupId, user.id);
    const includeDeleted = member?.role === "admin";
    const expenses = (await listExpenses(request.db, groupId, includeDeleted)).map(async (e) => ({
      ...(await toExpenseDto(request, e)),
      editable: isEditable(e.created_at),
    }));
    return { expenses: await Promise.all(expenses) };
  });

  app.get("/api/expenses/:expenseId", async (request) => {
    const { expenseId } = request.params as { expenseId: string };
    const expense = await getExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto no encontrado");
    await requireActiveMember(request, expense.group_id);
    return { expense: await toExpenseDto(request, expense) };
  });

  app.post("/api/groups/:groupId/expenses", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const { member, group } = await requireActiveMember(request, groupId);
    const user = requireAuth(request);
    const body = request.body as {
      description?: string;
      amount?: number;
      currency?: string;
      exchangeRate?: number;
      participants?: string[];
      payerId?: string;
    };
    const description = body.description?.trim();
    const amount = Number(body.amount);
    if (!description) throw badRequest("La descripción es obligatoria");
    if (!Number.isFinite(amount) || amount <= 0) throw badRequest("Importe inválido");
    const activeIds = new Set(
      (await listMembers(request.db, groupId))
        .filter((m) => m.status === "active")
        .map((m) => m.user_id)
    );
    const payerId = body.payerId ?? user.id;
    if (!activeIds.has(payerId)) throw badRequest("El pagador debe ser un miembro activo");
    const participants = body.participants ?? [payerId];
    if (participants.length === 0) throw badRequest("Debes seleccionar al menos un participante");
    for (const p of participants) {
      if (!activeIds.has(p)) throw badRequest("Hay participantes que no son miembros activos");
    }
    const expenseCurrency = (body.currency ?? group.currency).toUpperCase();
    const exchangeRate = body.currency && body.currency.toUpperCase() !== group.currency
      ? Number(body.exchangeRate ?? 0)
      : 1;
    if (expenseCurrency !== group.currency && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      throw badRequest("Indica el tipo de cambio congelado para la moneda extranjera");
    }
    const amountGroup = round2(amount * exchangeRate);
    const expense = await createExpense(request.db, {
      groupId,
      payerId,
      description,
      amount,
      currency: expenseCurrency,
      exchangeRate,
      amountGroup,
      createdById: user.id,
      participants: [...new Set(participants)],
    });
    return { expense: await toExpenseDto(request, expense), editable: true };
  });

  app.patch("/api/expenses/:expenseId", async (request) => {
    const { expenseId } = request.params as { expenseId: string };
    const user = requireAuth(request);
    const expense = await getExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto no encontrado");
    const { member, group } = await requireActiveMember(request, expense.group_id);
    if (!isEditable(expense.created_at)) {
      throw conflict(
        "El gasto tiene más de 24 horas. Solicita una modificación que un administrador debe aprobar."
      );
    }
    if (expense.payer_id !== user.id && member.role !== "admin") {
      throw forbidden("Solo puedes editar gastos que hayas creado (o siendo administrador)");
    }
    const body = request.body as {
      description?: string;
      amount?: number;
      currency?: string;
      exchangeRate?: number;
      participants?: string[];
      payerId?: string;
    };
    const activeIds = new Set(
      (await listMembers(request.db, group.id))
        .filter((m) => m.status === "active")
        .map((m) => m.user_id)
    );
    const payerId = body.payerId ?? expense.payer_id;
    if (!activeIds.has(payerId)) throw badRequest("El pagador debe ser un miembro activo");
    const participants = body.participants ?? (await expenseParticipantIds(request.db, expenseId));
    for (const p of participants) {
      if (!activeIds.has(p)) throw badRequest("Hay participantes que no son miembros activos");
    }
    const description = body.description?.trim() ?? expense.description;
    const amount = body.amount != null ? Number(body.amount) : expense.amount;
    if (!Number.isFinite(amount) || amount <= 0) throw badRequest("Importe inválido");
    const expenseCurrency = (body.currency ?? expense.currency).toUpperCase();
    const exchangeRate =
      body.currency && body.currency.toUpperCase() !== group.currency
        ? Number(body.exchangeRate ?? expense.exchange_rate)
        : expenseCurrency !== group.currency
          ? expense.exchange_rate
          : 1;
    if (expenseCurrency !== group.currency && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      throw badRequest("Tipo de cambio inválido");
    }
    const updated = await updateExpense(request.db, expenseId, {
      description,
      amount,
      currency: expenseCurrency,
      exchangeRate,
      amountGroup: round2(amount * exchangeRate),
      payerId,
      participants,
    });
    return { expense: await toExpenseDto(request, updated), editable: false };
  });

  app.delete("/api/expenses/:expenseId", async (request) => {
    const { expenseId } = request.params as { expenseId: string };
    const user = requireAuth(request);
    const expense = await getExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto no encontrado");
    const { member } = await requireActiveMember(request, expense.group_id);
    if (!isEditable(expense.created_at)) {
      throw conflict(
        "El gasto tiene más de 24 horas. Solicita la eliminación y un administrador deberá aprobarla."
      );
    }
    if (expense.payer_id !== user.id && member.role !== "admin") {
      throw forbidden("Solo puedes eliminar gastos que hayas creado (o siendo administrador)");
    }
    await deleteExpense(request.db, expenseId);
    return { ok: true };
  });
};

function isEditable(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
}

async function toExpenseDto(
  request: import("fastify").FastifyRequest,
  e: {
    id: string;
    group_id: string;
    payer_id: string;
    description: string;
    amount: number;
    currency: string;
    exchange_rate: number;
    amount_group: number;
    created_by_id: string;
    created_at: string;
    updated_at: string;
    deleted: number;
    payer_name?: string;
  }
) {
  const participantIds = await expenseParticipantIds(request.db, e.id);
  const share = participantIds.length ? round2(e.amount_group / participantIds.length) : 0;
  return {
    id: e.id,
    groupId: e.group_id,
    payerId: e.payer_id,
    payerName: e.payer_name ?? "Usuario",
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    exchangeRate: e.exchange_rate,
    amountGroup: e.amount_group,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    deleted: Boolean(e.deleted),
    participants: participantIds,
    share,
    participantsCount: participantIds.length,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
