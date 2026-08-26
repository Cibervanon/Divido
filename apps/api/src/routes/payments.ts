import type { FastifyPluginAsync } from "fastify";
import type { PaymentStatus } from "@divido/shared";
import {
  autoAcceptPendingPayments,
  createPayment,
  deletePayment,
  findUserById,
  getMemberRow,
  getPayment,
  listPayments,
  updatePayment,
  updatePaymentStatus,
} from "../store.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { requireActiveMember, requireAuth } from "../plugins.js";
import { createAndPushNotification } from "../push.js";
import { EDIT_WINDOW_MS } from "../config.js";
import { invalidateBalanceCache } from "../balanceCache.js";
import { logAudit } from "../audit.js";
import { publishGroupEvent, resolveReceiptUrl } from "../lib/supabase.js";

const HTTP_URL_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\/[a-z+]+;base64,/i;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const AUTO_ACCEPT_DAYS = 3;

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

function computeAutoAcceptAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + AUTO_ACCEPT_DAYS);
  return d.toISOString();
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
    if (group.type === "closed") {
      throw badRequest("El grupo está cerrado. No se pueden registrar nuevos pagos.");
    }
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

    const recipient = await findUserById(request.db, toUserId);
    const autoConfirm = recipient?.auto_confirm_payments === 1;

    let status: PaymentStatus = "pending";
    let autoAcceptAt: string | null = null;

    if (proof) {
      status = "accepted";
    } else if (autoConfirm) {
      status = "accepted";
    } else {
      status = "pending";
      autoAcceptAt = computeAutoAcceptAt();
    }

    const payment = await createPayment(request.db, {
      groupId,
      fromUserId: user.id,
      toUserId,
      amount: rounded,
      note: note?.trim() || undefined,
      proofUrl: proof,
      status,
      createdById: user.id,
      autoAcceptAt,
    });

    if (!target.is_ghost) {
      await createAndPushNotification(request.db, {
        userId: toUserId,
        type: "PAYMENT_SETTLED",
        title: `Pago recibido en ${group.name}`,
        body:
          status === "accepted"
            ? `${user.name} te pagó ${rounded.toFixed(2)} ${group.currency}.`
            : `${user.name} te ha enviado un pago de ${rounded.toFixed(2)} ${group.currency} pendiente de confirmar.`,
        linkUrl: `/groups/${groupId}`,
      });
    }

    if (status === "pending") {
      await createAndPushNotification(request.db, {
        userId: user.id,
        type: "PAYMENT_SETTLED",
        title: `Pago enviado en ${group.name}`,
        body: `Enviaste un pago de ${rounded.toFixed(2)} ${group.currency} a ${target.name} pendiente de confirmar.`,
        linkUrl: `/groups/${groupId}`,
      });
    }

    invalidateBalanceCache(groupId);
    publishGroupEvent(groupId, "payment.changed");
    await logAudit(request.db, {
      groupId,
      entityType: "payment",
      entityId: payment.id,
      action: "created",
      actorId: user.id,
      actorName: user.name,
      after: { fromUserId: user.id, toUserId, amount: rounded, note: note?.trim(), status },
    });
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
    if (payment.status !== "pending") throw conflict("El pago ya fue confirmado o rechazado");
    const next: PaymentStatus = accepted ? "accepted" : "rejected";
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
    invalidateBalanceCache(group.id);
    publishGroupEvent(group.id, "payment.changed");
    await logAudit(request.db, {
      groupId: group.id,
      entityType: "payment",
      entityId: paymentId,
      action: accepted ? "approved" : "rejected",
      actorId: user.id,
      actorName: user.name,
      before: { status: payment.status },
      after: { status: next },
    });
    return { payment: updated };
  });

  app.patch("/api/payments/:paymentId", async (request) => {
    const { paymentId } = request.params as { paymentId: string };
    const user = requireAuth(request);
    const { amount, note, proofUrl } = request.body as {
      amount?: number;
      note?: string;
      proofUrl?: unknown;
    };
    const payment = await getPayment(request.db, paymentId);
    if (!payment) throw notFound("Pago no encontrado");
    const { group } = await requireActiveMember(request, payment.group_id);
    if (payment.from_user_id !== user.id) throw forbidden("Solo el emisor del pago puede editarlo");
    if (payment.status !== "pending") throw conflict("Solo se pueden editar pagos en estado pendiente");
    const parsedProof = proofUrl === undefined ? undefined : parseProof(proofUrl);
    const updated = await updatePayment(request.db, paymentId, {
      amount: amount !== undefined ? round2(amount) : undefined,
      note: note?.trim() || null,
      proofUrl: parsedProof,
    });
    if (parsedProof && updated.status === "pending") {
      const newStatus: PaymentStatus = "accepted";
      await updatePaymentStatus(request.db, paymentId, newStatus);
      invalidateBalanceCache(group.id);
      publishGroupEvent(group.id, "payment.changed");
    }
    await logAudit(request.db, {
      groupId: group.id,
      entityType: "payment",
      entityId: paymentId,
      action: "edited",
      actorId: user.id,
      actorName: user.name,
      before: { amount: payment.amount, note: payment.note, proof_url: payment.proof_url },
      after: { amount: updated.amount, note: updated.note, proof_url: updated.proof_url },
    });
    return { payment: updated };
  });

  app.delete("/api/payments/:paymentId", async (request) => {
    const { paymentId } = request.params as { paymentId: string };
    const user = requireAuth(request);
    const payment = await getPayment(request.db, paymentId);
    if (!payment) throw notFound("Pago no encontrado");
    const { member } = await requireActiveMember(request, payment.group_id);
    const editable = payment.from_user_id === user.id || member.role === "admin";
    if (!editable) throw forbidden("Solo puedes eliminar pagos que hayas marcado");
    if (payment.status !== "pending" && member.role !== "admin") {
      throw forbidden("Solo se pueden cancelar pagos pendientes");
    }
    await deletePayment(request.db, paymentId);
    invalidateBalanceCache(payment.group_id);
    publishGroupEvent(payment.group_id, "payment.changed");
    await logAudit(request.db, {
      groupId: payment.group_id,
      entityType: "payment",
      entityId: paymentId,
      action: "cancelled",
      actorId: user.id,
      actorName: user.name,
      before: { fromUserId: payment.from_user_id, toUserId: payment.to_user_id, amount: payment.amount, status: payment.status },
    });
    return { ok: true };
  });

  app.get("/api/payments/:paymentId/receipt-url", async (request) => {
    const { paymentId } = request.params as { paymentId: string };
    const user = requireAuth(request);
    const payment = await getPayment(request.db, paymentId);
    if (!payment) throw notFound("Pago no encontrado");
    await requireActiveMember(request, payment.group_id);
    const isSender = payment.from_user_id === user.id;
    const isReceiver = payment.to_user_id === user.id;
    if (!isSender && !isReceiver) throw forbidden("Solo el emisor y el destinatario pueden ver el comprobante");
    if (!payment.proof_url) throw notFound("El pago no tiene comprobante");
    const resolved = await resolveReceiptUrl(payment.proof_url);
    if (!resolved) throw notFound("No se pudo generar el enlace del comprobante en este momento");
    return { url: resolved };
  });
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}