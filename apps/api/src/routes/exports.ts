import type { FastifyPluginAsync } from "fastify";
import { listExpenses, listMembers, listPayments } from "../store.js";
import { requireActiveMember } from "../plugins.js";

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/groups/:groupId/export.csv", async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    await requireActiveMember(request, groupId);
    const expenses = await listExpenses(request.db, groupId, false);
    const members = await listMembers(request.db, groupId);
    const nameOf = (id: string | null) => members.find((m) => m.user_id === id)?.name ?? "—";

    // Participantes por gasto (nombres)
    const partRows = (await request.db
      .prepare(
        `SELECT ep.expense_id AS eid, u.name AS name
         FROM expense_participants ep
         JOIN users u ON u.id = ep.user_id
         JOIN expenses e ON e.id = ep.expense_id
         WHERE e.group_id = ?`
      )
      .all(groupId)) as Array<{ eid: string; name: string }>;
    const participantsByExpense = new Map<string, string[]>();
    for (const r of partRows) {
      const list = participantsByExpense.get(r.eid) ?? [];
      list.push(r.name);
      participantsByExpense.set(r.eid, list);
    }

    const rows = [
      ["Fecha", "Descripción", "Categoría", "Pagador", "Importe", "Moneda", "Participantes"],
      ...expenses.map((e) => [
        e.created_at.slice(0, 10),
        csvEscape(e.description),
        e.category,
        csvEscape(nameOf(e.payer_id)),
        e.amount_group.toFixed(2),
        e.currency,
        csvEscape((participantsByExpense.get(e.id) ?? []).join("; ")),
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="divido-${groupId}.csv"`);
    return csv;
  });
};

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}