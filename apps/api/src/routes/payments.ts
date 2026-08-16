import type { FastifyPluginAsync } from "fastify";
import type { PaymentStatus } from "@divido/shared";
import {
  createPayment,
  deletePayment,
  findUserById,
  getMemberRow,
  getPayment,
  listPayments,
  updatePaymentStatus,
} from "../store.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { requireActiveMember, requireAuth } from "../plugins.js";
import { createAndPushNotification } from "../push.js";
import { EDIT_WINDOW_MS } from "../config.js";

const HTTP_URL_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\/[a-z+]+;base64,/i;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

function parseProof(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const url = String(raw).trim();
  if (url === "") return null;
  if (HTTP_URL_RE.test(url)) return url.slice(0, 2048);
  if (DATA_IMAGE_RE.test(url)) {
    const size = Math.ceil((url.length - url.indexOf(",") - 1) * 0.75);
    if (size > MAX_PROOF_BYTES) throw badRequest("La imagen es demasiado grande (máximo 5 MB)");
    return url;
  }
  throw badRequest("Comprobante inválido");
}

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
    const { toUserId, amount, note, proofUrl } = request.body as {
      toUserId?: string;
      amount?: number;
      note?: string;
      proofUrl?: unknown;
    };
    if (!toUserId) throw badRequest("Indica a quién pagaste");
    if (toUserId === user.id) throw badRequest("No puedes pagarte a ti mismo");
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) throw badRequest("Importe inválido");
    const target = await getMemberRow(request.db, groupId, toUserId);
    if (!target || target.status !== "active") throw badRequest("El destinatario debe ser miembro activo");
    const proof = parseProof(proofUrl);
    const rounded = round2(num);

    // Flujo de estados:
    //  - Con comprobante adjunto -> confirmado directamente.
    //  - Sin comprobante -> si el receptor tiene "autoconfirmar" activado se
    //    aprueba solo; si no, queda "pendiente_confirmation" y el destinatario
    //    podrá aceptarlo o rechazarlo desde la app.
    const recipient = await findUserById(request.db, toUserId);
    const autoConfirm = recipient?.auto_confirm_payments === 1;
    const status: PaymentStatus = proof ? "confirmed" : autoConfirm ? "confirmed" : "pending_confirmation";

    const payment = await createPayment(request.db, {
      groupId,
      fromUserId: user.id,
      toUserId,
      amount: rounded,
      note: note?.trim() || undefined,
      proofUrl: proof,
      status,
      createdById: user.id,
    });
    if (!target.is_ghost) {
      await createAndPushNotification(request.db, {
        userId: toUserId,
        type: "PAYMENT_SETTLED",
        title: `Pago recibido en ${group.name}`,
        body:
          status === "confirmed"
            ? `${user.name} te pagó ${rounded.toFixed(2)} ${group.currency}.`
            : `${user.name} te ha enviado un pago de ${rounded.toFixed(2)} ${group.currency} pendiente de confirmar.`,
        linkUrl: `/groups/${groupId}`,
      });
    }
    return { payment };
  });

  app.patch("/api/payments/:paymentId/confirm", async (request) => {
    const { paymentId } = request.params as { paymentId: string };
    const user = requireAuth(request);
    const { accepted } = request.body as { accepted?: unknown };
    if (typeof accepted !== "boolean") throw badRequest("Falta la decisión (accepted)");
    const payment = await getPayment(request.db, paymentId);
    if (!payment) throw notFound("Pago no encontrado");
    const { group } = await requireActiveMember(request, payment.group_id);
    if (payment.to_user_id !== user.id) throw forbidden("Solo el destinatario del pago puede aceptarlo o rechazarlo");
    if (payment.status !== "pending_confirmation") throw conflict("El pago ya fue confirmado o rechazado");
    const next: PaymentStatus = accepted ? "confirmed" : "rejected";
    const updated = await updatePaymentStatus(request.db, paymentId, next);
    const payer = await findUserById(request.db, payment.from_user_id);
    if (payer && !payer.is_ghost) {
      await createAndPushNotification(request.db, {
        userId: payment.from_user_id,
        type: "PAYMENT_SETTLED",
        title: `Pago ${accepted ? "confirmado" : "rechazado"} en ${group.name}`,
        body:
          accepted
            ? `${user.name} confirmó tu pago de ${payment.amount.toFixed(2)} ${group.currency}.`
            : `${user.name} rechazó tu pago de ${payment.amount.toFixed(2)} ${group.currency}.`,
        linkUrl: `/groups/${group.id}`,
      });
    }
    return { payment: updated };
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
