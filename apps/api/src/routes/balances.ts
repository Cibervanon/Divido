import type { FastifyPluginAsync } from "fastify";
import {
  expenseParticipantsByGroup,
  listExpenses,
  listGroupEvents,
  listMembers,
  listPayments,
} from "../store.js";
import { notFound } from "../errors.js";
import { requireActiveMember } from "../plugins.js";
import { getGroupBalances, getPersonBreakdown } from "../services.js";
import { getCachedBalances, invalidateBalanceCache } from "../balanceCache.js";

export const balanceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/groups/:groupId/balances", async (request) => {
    const { groupId } = request.params as { groupId: string };
    await requireActiveMember(request, groupId);
    return getCachedBalances(request.db, groupId);
  });

  app.get("/api/groups/:groupId/members/:userId/breakdown", async (request) => {
    const { groupId, userId } = request.params as { groupId: string; userId: string };
    await requireActiveMember(request, groupId);
    const member = (await listMembers(request.db, groupId)).find((m) => m.user_id === userId);
    if (!member || member.status !== "active") throw notFound("Miembro no encontrado");
    return { breakdown: await getPersonBreakdown(request.db, groupId, userId) };
  });

  app.get("/api/groups/:groupId/history", async (request) => {
    const { groupId } = request.params as { groupId: string };
    await requireActiveMember(request, groupId);

    // Paginación sobre el feed combinado: limit ∈ [1,500] (defecto 100).
    const query = request.query as { limit?: string; offset?: string };
    const limit =
      query.limit != null && query.limit !== ""
        ? Math.min(Math.max(Number(query.limit) || 100, 1), 500)
        : undefined;
    const offset = Math.max(Number(query.offset ?? 0) || 0, 0);
    const expenses = await listExpenses(request.db, groupId, true);
    const [payments, participantsByExpense] = await Promise.all([
      listPayments(request.db, groupId),
      expenseParticipantsByGroup(request.db, groupId),
    ]);

    const events: Array<Record<string, unknown>> = [];

    for (const e of expenses) {
      events.push({
        type: "expense",
        id: e.id,
        date: e.created_at,
        description: e.description,
        amount: e.amount,
        currency: e.currency,
        exchangeRate: e.exchange_rate,
        amountGroup: e.amount_group,
        payerId: e.payer_id,
        payerName: e.payer_name,
        participantIds: participantsByExpense.get(e.id)?.ids ?? [],
        deleted: Boolean(e.deleted),
        edited: e.updated_at !== e.created_at,
      });
    }

    for (const p of payments) {
      events.push({
        type: "payment",
        id: p.id,
        date: p.created_at,
        fromUserId: p.from_user_id,
        fromName: p.from_name,
        toUserId: p.to_user_id,
        toName: p.to_name,
        amount: p.amount,
        note: p.note,
        proofUrl: p.proof_url,
        status: p.status,
      });
    }

    const memberEvents = await listGroupEvents(request.db, groupId);
    for (const g of memberEvents) {
      events.push({
        type: g.type,
        id: g.id,
        date: g.created_at,
        userId: g.user_id,
        userName: g.user_name,
      });
    }

    events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const total = events.length;
    const page = limit != null ? events.slice(offset, offset + limit) : events;
    return { events: page, total, hasMore: limit != null ? offset + page.length < total : false };
  });
};
