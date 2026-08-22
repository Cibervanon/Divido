import type { FastifyPluginAsync } from "fastify";
import { EPS } from "@divido/shared";
import {
  createExpense,
  createExpenseComment,
  deleteExpense,
  deleteExpenseComment,
  deletePotExpenseWithdrawal,
  expenseParticipantIds,
  expenseParticipantShares,
  getExpense,
  getExpenseComment,
  getMemberRow,
  getPotBalance,
  getPotExpenseWithdrawal,
  listExpenseComments,
  listExpenses,
  countExpensesFiltered,
  countExpensesInGroup,
  listExpensesFiltered,
  listExpensesWithDetails,
  listMembers,
  updateExpense,
  upsertPotExpenseWithdrawal,
} from "../store.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { requireActiveMember, requireAuth } from "../plugins.js";
import { createAndPushNotification } from "../push.js";
import { EDIT_WINDOW_MS } from "../config.js";
import { createExpenseSchema, updateExpenseSchema, type CreateExpenseInput, type UpdateExpenseInput } from "../schemas/index.js";
import { parseBody } from "../validate.js";
import { invalidateBalanceCache } from "../balanceCache.js";
import { logAudit } from "../audit.js";

const DATA_IMAGE_RE = /^data:image\/[a-z+]+;base64,/i;
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export const expenseRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/groups/:groupId/expenses", async (request) => {
    const { groupId } = request.params as { groupId: string };
    await requireActiveMember(request, groupId);
    const user = requireAuth(request);
    const member = await getMemberRow(request.db, groupId, user.id);
    const includeDeleted = member?.role === "admin";

    // Filtros opcionales via query string
    const query = request.query as {
      category?: string;
      payerId?: string;
      from?: string;
      to?: string;
      q?: string;
      limit?: string;
      offset?: string;
    };
    const hasFilters = query.category || query.payerId || query.from || query.to || query.q;

    // Paginación: limit ∈ [1,200] (defecto 50); offset ≥ 0. Sin limit → compatibilidad completa.
    const limit =
      query.limit != null && query.limit !== ""
        ? Math.min(Math.max(Number(query.limit) || 50, 1), 200)
        : undefined;
    const offset = Math.max(Number(query.offset ?? 0) || 0, 0);

    let rows;
    let total: number;
    if (hasFilters) {
      const filters = {
        category: query.category,
        payerId: query.payerId,
        from: query.from,
        to: query.to,
        q: query.q,
      };
      rows = await listExpensesFiltered(request.db, groupId, filters, includeDeleted, { limit, offset });
      total = await countExpensesFiltered(request.db, groupId, filters, includeDeleted);
    } else {
      rows = await listExpensesWithDetails(request.db, groupId, includeDeleted, { limit, offset });
      total = await countExpensesInGroup(request.db, groupId, includeDeleted);
    }
    const expenses = rows.map((e) => ({
      ...expenseRowToDto(e),
      editable: isEditable(e.created_at),
    }));
    return {
      expenses,
      total,
      hasMore: limit != null ? offset + expenses.length < total : false,
    };
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
    if (group.type === "closed") {
      throw badRequest("El grupo está cerrado. No se pueden añadir nuevos gastos.");
    }
    const body = parseBody(createExpenseSchema, request.body) as CreateExpenseInput;
    const paidFromPot = body.paidFromPot ?? false;
    const receiptUrl = parseReceiptUrl((request.body as any).receiptUrl);
    const category = parseCategory((request.body as any).category);
    const iconName = parseIconName((request.body as any).iconName);
    const isCustomIcon = (request.body as any).isCustomIcon === true;
    const members = await listMembers(request.db, groupId);
    const activeIds = new Set(
      members.filter((m) => m.status === "active").map((m) => m.user_id)
    );
    if (paidFromPot) {
      if (!group.enabledExtras.includes("common_pot")) {
        throw badRequest("El extra de bote común no está activo en este grupo");
      }
    }
    const payerId = paidFromPot ? null : body.payerId ?? user.id;
    if (payerId !== null && !activeIds.has(payerId)) throw badRequest("El pagador debe ser un miembro activo");
    const participants = body.participants ?? (paidFromPot ? [...activeIds] : [payerId ?? ""].filter(Boolean)) as string[];
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
    const amountGroup = round2(body.amount * exchangeRate);
    if (paidFromPot) {
      const potBalance = await getPotBalance(request.db, groupId);
      if (potBalance + EPS < amountGroup) {
        throw badRequest("Saldo insuficiente en el bote común");
      }
    }
    const uniqueParticipants = [...new Set(participants)];
    const expense = await createExpense(request.db, {
      groupId,
      payerId,
      description: body.description,
      amount: body.amount,
      currency: expenseCurrency,
      exchangeRate,
      amountGroup,
      createdById: user.id,
      participants: uniqueParticipants,
      shares: parseShares(body.shares, uniqueParticipants, amountGroup),
      paidFromPot,
      receiptUrl,
      category,
      iconName,
      isCustomIcon,
    });
    if (paidFromPot) {
      await upsertPotExpenseWithdrawal(request.db, {
        groupId,
        expenseId: expense.id,
        amountGroup,
        description: body.description,
      });
    }
    const ghostIds = new Set(members.filter((m) => m.is_ghost).map((m) => m.user_id));
    const notified = uniqueParticipants.filter((p) => p !== user.id && !ghostIds.has(p));
    if (notified.length > 0) {
      const payerName = paidFromPot
        ? "Bote común"
        : (members.find((m) => m.user_id === payerId)?.name ?? user.name);
      for (const p of notified) {
        await createAndPushNotification(request.db, {
          userId: p,
          type: "EXPENSE_ADDED",
          title: `Nuevo gasto en ${group.name}`,
          body: `${payerName} añadió "${body.description}" por ${amountGroup.toFixed(2)} ${group.currency}.`,
          linkUrl: `/groups/${groupId}`,
        });
      }
    }
    invalidateBalanceCache(groupId);
    await logAudit(request.db, {
      groupId,
      entityType: "expense",
      entityId: expense.id,
      action: "created",
      actorId: user.id,
      actorName: user.name,
      after: { description: body.description, amount: body.amount, currency: expenseCurrency, participants: uniqueParticipants },
    });
    return { expense: await toExpenseDto(request, expense), editable: true };
  });

  app.patch("/api/expenses/:expenseId", async (request) => {
    const { expenseId } = request.params as { expenseId: string };
    const user = requireAuth(request);
    const expense = await getExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto no encontrado");
    const { member, group } = await requireActiveMember(request, expense.group_id);
    if (group.type === "closed") {
      throw badRequest("El grupo está cerrado. No se pueden modificar gastos.");
    }
    if (!isEditable(expense.created_at)) {
      throw conflict(
        "El gasto tiene más de 24 horas. Solicita una modificación que un administrador debe aprobar."
      );
    }
if (expense.payer_id !== user.id && member.role !== "admin") {
      throw forbidden("Solo puedes editar gastos que hayas creado (o siendo administrador)");
    }
    const body = parseBody(updateExpenseSchema, request.body) as UpdateExpenseInput;
    const rawBody = request.body as Record<string, unknown>;
    const wasPaidFromPot = Boolean(expense.paid_from_pot);
    const paidFromPot = body.paidFromPot !== undefined ? body.paidFromPot : wasPaidFromPot;
    if (paidFromPot && !group.enabledExtras.includes("common_pot")) {
      throw badRequest("El extra de bote común no está activo en este grupo");
    }
    const activeIds = new Set(
      (await listMembers(request.db, group.id))
        .filter((m) => m.status === "active")
        .map((m) => m.user_id)
    );
    const payerId = paidFromPot ? null : body.payerId ?? (expense.payer_id ?? user.id);
    if (payerId !== null && !activeIds.has(payerId)) throw badRequest("El pagador debe ser un miembro activo");
    const participants = body.participants ?? (await expenseParticipantIds(request.db, expenseId)) as string[];
    for (const p of participants) {
      if (!activeIds.has(p)) throw badRequest("Hay participantes que no son miembros activos");
    }
    const description = body.description?.trim() ?? expense.description;
    const amount = body.amount != null ? body.amount : expense.amount;
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
    const amountGroup = round2(amount * exchangeRate);
    if (paidFromPot) {
      const potBalance = await getPotBalance(request.db, expense.group_id);
      const withdrawal = await getPotExpenseWithdrawal(request.db, expenseId);
      const available = potBalance - (withdrawal?.amount ?? 0);
      if (available + EPS < amountGroup) {
        throw badRequest("Saldo insuficiente en el bote común");
      }
    }
    const receiptUrl = rawBody.receiptUrl !== undefined ? parseReceiptUrl(rawBody.receiptUrl) : expense.receipt_url;
    const hasShares =
      body.shares === undefined || body.shares === null
        ? undefined
        : parseShares(body.shares, participants, amountGroup);
    const category = body.category === undefined ? undefined : parseCategory(body.category);
    const iconName = body.iconName === undefined ? undefined : parseIconName(body.iconName);
    const isCustomIcon = body.isCustomIcon === undefined ? undefined : body.isCustomIcon === true;
    const updated = await updateExpense(request.db, expenseId, {
      description,
      amount,
      currency: expenseCurrency,
      exchangeRate,
      amountGroup,
      payerId,
      participants,
      shares: hasShares,
      paidFromPot,
      receiptUrl,
      category,
      iconName,
      isCustomIcon,
    });
    if (paidFromPot) {
      await upsertPotExpenseWithdrawal(request.db, {
        groupId: expense.group_id,
        expenseId,
        amountGroup,
        description,
      });
    } else if (wasPaidFromPot) {
      await deletePotExpenseWithdrawal(request.db, expenseId);
    }
    invalidateBalanceCache(expense.group_id);
    await logAudit(request.db, {
      groupId: expense.group_id,
      entityType: "expense",
      entityId: expenseId,
      action: "updated",
      actorId: user.id,
      actorName: user.name,
      before: { description: expense.description, amount: expense.amount, currency: expense.currency, payer_id: expense.payer_id },
      after: { description, amount, currency: expenseCurrency, payerId },
    });
    return { expense: await toExpenseDto(request, updated), editable: false };
  });

  app.delete("/api/expenses/:expenseId", async (request) => {
    const { expenseId } = request.params as { expenseId: string };
    const user = requireAuth(request);
    const expense = await getExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto no encontrado");
    const { member, group } = await requireActiveMember(request, expense.group_id);
    if (group.type === "closed") {
      throw badRequest("El grupo está cerrado. No se pueden eliminar gastos.");
    }
    if (!isEditable(expense.created_at)) {
      throw conflict(
        "El gasto tiene más de 24 horas. Solicita la eliminación y un administrador deberá aprobarla."
      );
    }
    if (expense.payer_id !== user.id && member.role !== "admin") {
      throw forbidden("Solo puedes eliminar gastos que hayas creado (o siendo administrador)");
    }
    if (expense.paid_from_pot) {
      await deletePotExpenseWithdrawal(request.db, expenseId);
    }
    await deleteExpense(request.db, expenseId);
    invalidateBalanceCache(expense.group_id);
    await logAudit(request.db, {
      groupId: expense.group_id,
      entityType: "expense",
      entityId: expenseId,
      action: "deleted",
      actorId: user.id,
      actorName: user.name,
      before: { description: expense.description, amount: expense.amount, currency: expense.currency },
    });
    return { ok: true };
  });

  app.patch("/api/expenses/:expenseId/receipt", async (request) => {
    const { expenseId } = request.params as { expenseId: string };
    const user = requireAuth(request);
    const expense = await getExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto no encontrado");
    const { member } = await requireActiveMember(request, expense.group_id);
    if (expense.payer_id !== user.id && member.role !== "admin") {
      throw forbidden("Solo el pagador (o un administrador) puede adjuntar el tique");
    }
    const { receiptUrl } = (request.body ?? {}) as { receiptUrl?: unknown };
    if (receiptUrl === undefined) throw badRequest("Falta el tique");
    const parsed = parseReceiptUrl(receiptUrl);
    const updated = await updateExpense(request.db, expenseId, { receiptUrl: parsed });
    return { expense: await toExpenseDto(request, updated) };
  });

  app.post("/api/groups/:groupId/expenses/:expenseId/comments", async (request) => {
    const { groupId, expenseId } = request.params as { groupId: string; expenseId: string };
    const user = requireAuth(request);
    await requireActiveMember(request, groupId);
    const expense = await getExpense(request.db, expenseId);
    if (!expense || expense.group_id !== groupId) throw notFound("Gasto no encontrado");
    const { body } = request.body as { body?: string };
    if (!body?.trim()) throw badRequest("El comentario no puede estar vacío");
    const comment = await createExpenseComment(request.db, {
      expenseId,
      authorId: user.id,
      body: body.trim().slice(0, 500),
    });
    return { comment: toCommentDto(comment) };
  });

  app.delete("/api/expenses/:expenseId/comments/:commentId", async (request) => {
    const { expenseId, commentId } = request.params as { expenseId: string; commentId: string };
    const user = requireAuth(request);
    const expense = await getExpense(request.db, expenseId);
    if (!expense) throw notFound("Gasto no encontrado");
    const { member } = await requireActiveMember(request, expense.group_id);
    const comment = await getExpenseComment(request.db, commentId);
    if (!comment || comment.expense_id !== expenseId) throw notFound("Comentario no encontrado");
    if (comment.author_id !== user.id && member.role !== "admin") {
      throw forbidden("Solo puedes eliminar tus propios comentarios (o siendo administrador)");
    }
    await deleteExpenseComment(request.db, commentId);
    return { ok: true };
  });
};

function isEditable(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
}

interface ExpenseDetailRow {
  id: string;
  group_id: string;
  payer_id: string | null;
  description: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_group: number;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  deleted: number;
  paid_from_pot: number;
  receipt_url: string | null;
  category: string;
  icon_name: string;
  is_custom_icon: number;
  payer_name?: string | null;
  participants_json: string;
  comment_count: number;
}

/** Convierte fila optimizada (con participants_json y comment_count) a DTO sin queries extra. */
function expenseRowToDto(e: ExpenseDetailRow) {
  const participantsData = JSON.parse(e.participants_json || "[]") as Array<{ userId: string; share: number | null }>;
  const participants = participantsData.map((p) => p.userId);
  const shares: Record<string, number> = {};
  for (const p of participantsData) {
    if (p.share != null) shares[p.userId] = p.share;
  }
  const custom = Object.keys(shares).length > 0;
  const share = participants.length ? round2(e.amount_group / participants.length) : 0;
  return {
    id: e.id,
    groupId: e.group_id,
    payerId: e.payer_id,
    payerName: e.payer_name ?? (e.paid_from_pot ? "Bote común" : "Usuario"),
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    exchangeRate: e.exchange_rate,
    amountGroup: e.amount_group,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    deleted: Boolean(e.deleted),
    paidFromPot: Boolean(e.paid_from_pot),
    receiptUrl: e.receipt_url,
    category: e.category,
    iconName: e.icon_name,
    isCustomIcon: Boolean(e.is_custom_icon),
    participants,
    shares: custom ? shares : null,
    share,
    participantsCount: participants.length,
    comments: [], // comentarios se cargan bajo demanda al expandir
  };
}

async function toExpenseDto(
  request: import("fastify").FastifyRequest,
  e: {
    id: string;
    group_id: string;
    payer_id: string | null;
    description: string;
    amount: number;
    currency: string;
    exchange_rate: number;
    amount_group: number;
    created_by_id: string;
    created_at: string;
    updated_at: string;
    deleted: number;
    paid_from_pot: number;
    receipt_url: string | null;
    category: string;
    icon_name: string;
    is_custom_icon: number;
    payer_name?: string | null;
  }
) {
  const participants = await expenseParticipantIds(request.db, e.id);
  const shares = await expenseParticipantShares(request.db, e.id);
  const comments = await listExpenseComments(request.db, e.id);
  const custom = Object.keys(shares).length > 0;
  const share = participants.length
    ? round2(e.amount_group / participants.length)
    : 0;
  return {
    id: e.id,
    groupId: e.group_id,
    payerId: e.payer_id,
    payerName: e.payer_name ?? (e.paid_from_pot ? "Bote común" : "Usuario"),
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    exchangeRate: e.exchange_rate,
    amountGroup: e.amount_group,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    deleted: Boolean(e.deleted),
    paidFromPot: Boolean(e.paid_from_pot),
    receiptUrl: e.receipt_url,
    category: e.category,
    iconName: e.icon_name,
    isCustomIcon: Boolean(e.is_custom_icon),
    participants,
    shares: custom ? shares : null,
    share,
    participantsCount: participants.length,
    comments: comments.map(toCommentDto),
  };
}

function toCommentDto(c: {
  id: string;
  expense_id: string;
  author_id: string;
  author_name: string;
  author_verified: number;
  body: string;
  created_at: string;
}) {
  return {
    id: c.id,
    expenseId: c.expense_id,
    authorId: c.author_id,
    authorName: c.author_name,
    authorVerified: Boolean(c.author_verified),
    body: c.body,
    createdAt: c.created_at,
  };
}

function parseReceiptUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") throw badRequest("Tique inválido");
  if (!DATA_IMAGE_RE.test(raw)) throw badRequest("El tique debe ser una imagen");
  const comma = raw.indexOf(",");
  const bytes = Math.ceil(((raw.length - comma - 1) * 3) / 4);
  if (bytes > MAX_RECEIPT_BYTES) throw badRequest("El tique supera los 5 MB");
  return raw;
}

function parseCategory(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "general";
  if (typeof raw !== "string") throw badRequest("Categoría inválida");
  const s = raw.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(s)) throw badRequest("Categoría inválida");
  return s;
}

function parseIconName(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "wallet";
  if (typeof raw !== "string") throw badRequest("Icono inválido");
  const s = raw.trim();
  if (!/^[a-z0-9-]{1,40}$/i.test(s)) throw badRequest("Icono inválido");
  return s;
}

function parseShares(
  raw: Record<string, number> | null | undefined,
  participants: string[],
  amountGroup: number
): Record<string, number> | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw badRequest("Reparto personalizado inválido");
  const shares: Record<string, number> = {};
  let sum = 0;
  for (const p of participants) {
    const v = Number(raw[p]);
    if (!Number.isFinite(v) || v < 0) throw badRequest("Reparto personalizado inválido");
    shares[p] = round2(v);
    sum += v;
  }
  if (Math.abs(sum - amountGroup) > Math.max(0.02, participants.length * 0.01)) {
    throw badRequest("Los importes del reparto no suman el total del gasto");
  }
  return shares;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
