import type { FastifyPluginAsync } from "fastify";
import {
  createNotification,
  createPayment,
  deletePayment,
  getPayment,
  getMemberRow,
  listPayments,
} from "../store.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { requireActiveMember, requireAuth } from "../plugins.js";
import { EDIT_WINDOW_MS } from "../config.js";

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/groups/:groupId/payments", async (request) => {
    const { groupId } = request.params as { groupId: string };
    await requireActiveMember(request, groupId);
    const payments = await listPayments(request.db, groupId);
    return { payments };
  });

  app.post("/api/groups/:groupId/payments", async (request) => {
    const { groupId } = request.params as { groupId: string };
    const user = requireAuth(request);
    const { group } = await requireActiveMember(request, groupId);
    const { toUserId, amount, note } = request.body as {
      toUserId?: string;
      amount?: number;
      note?: string;
    };
    if (!toUserId) throw badRequest("Indica a quién pagaste");
    if (toUserId === user.id) throw badRequest("No puedes pagarte a ti mismo");
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) throw badRequest("Importe inválido");
    const target = await getMemberRow(request.db, groupId, toUserId);
    if (!target || target.status !== "active") throw badRequest("El destinatario debe ser miembro activo");
    const rounded = round2(num);
    const payment = await createPayment(request.db, {
      groupId,
      fromUserId: user.id,
      toUserId,
      amount: rounded,
      note: note?.trim() || undefined,
      createdById: user.id,
    });
    if (!target.is_ghost) {
      await createNotification(request.db, {
        userId: toUserId,
        type: "PAYMENT_SETTLED",
        title: `Pago recibido en ${group.name}`,
        body: `${user.name} te pagó ${rounded.toFixed(2)} ${group.currency}.`,
        linkUrl: `/groups/${groupId}`,
      });
    }
    return { payment };
  });

  app.delete("/api/payments/:paymentId", async (request) => {
    const { paymentId } = request.params as { paymentId: string };
    const user = requireAuth(request);
    const payment = await getPayment(request.db, paymentId);
    if (!payment) throw notFound("Pago no encontrado");
    const { member } = await requireActiveMember(request, payment.group_id);
    const editable =
      payment.from_user_id === user.id || member.role === "admin";
    const withinWindow = Date.now() - new Date(payment.created_at).getTime() < EDIT_WINDOW_MS;
    if (!editable) throw forbidden("Solo puedes eliminar pagos que hayas marcado");
    if (!withinWindow && member.role !== "admin") {
      throw forbidden("Solo puedes eliminar un pago dentro de las primeras 24 horas");
    }
    await deletePayment(request.db, paymentId);
    return { ok: true };
  });
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
