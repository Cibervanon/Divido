import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { Button, ConfirmPaymentButton, Money } from "./ui";
import type { HistoryEvent, MemberInfo } from "../lib/types";

export interface PendingPayment {
  id: string;
  amount: number;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  note: string | null;
  inbound: boolean;
}

export interface PendingPaymentsCardProps {
  events: HistoryEvent[];
  myUserId: string;
  currency: string;
  members: MemberInfo[];
  onChanged: () => void;
  onToast: (msg: string, type?: "success" | "error") => void;
  title?: string;
}

function nameOf(members: MemberInfo[], id: string): string {
  return members.find((m) => m.userId === id)?.name ?? "Usuario";
}

/** Extrae de los eventos de actividad los pagos pendientes en los que participo. */
export function extractPendingPayments(
  events: HistoryEvent[],
  myUserId: string,
  members: MemberInfo[]
): PendingPayment[] {
  const pending: PendingPayment[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.type !== "payment") continue;
    if (e.status !== "pending") continue;
    if (e.fromUserId !== myUserId && e.toUserId !== myUserId) continue;
    if (!e.id || seen.has(e.id)) continue;
    seen.add(e.id);
    pending.push({
      id: e.id,
      amount: e.amount ?? 0,
      fromUserId: e.fromUserId ?? "",
      fromName: e.fromName ?? nameOf(members, e.fromUserId ?? ""),
      toUserId: e.toUserId ?? "",
      toName: e.toName ?? nameOf(members, e.toUserId ?? ""),
      note: e.note ?? null,
      inbound: e.toUserId === myUserId,
    });
  }
  return pending;
}

/** Umbral a partir del cual se colapsa la lista para no empujar abajo las secciones. */
const COLLAPSE_THRESHOLD = 2;

export function PendingPaymentsCard({
  events,
  myUserId,
  currency,
  members,
  onChanged,
  onToast,
  title = "Pagas pendientes",
}: PendingPaymentsCardProps) {
  const [deciding, setDeciding] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const pending = extractPendingPayments(events, myUserId, members);
  const incoming = pending.filter((p) => p.inbound);
  const outgoing = pending.filter((p) => !p.inbound);
  if (pending.length === 0) return null;

  const hasMany = pending.length > COLLAPSE_THRESHOLD;
  const visible = hasMany && !expanded ? pending.slice(0, COLLAPSE_THRESHOLD) : pending;
  const hiddenCount = pending.length - visible.length;

  async function decide(paymentId: string, accepted: boolean) {
    setDeciding(paymentId);
    try {
      await api.patch(`/payments/${paymentId}/confirm`, { accepted });
      onChanged();
      onToast(accepted ? "Pago confirmado" : "Pago rechazado");
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Error al confirmar el pago", "error");
    } finally {
      setDeciding(null);
    }
  }

  return (
    // Contenedor integrado con el tema: sin borde amarillo brillante.
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5m2-7.5A9 9 0 1112 3a9 9 0 016.36 2.64z" />
          </svg>
          <p className="text-sm font-bold text-slate-200">
            {title}
            <span className="ml-1.5 text-xs font-medium text-slate-400">
              {incoming.length > 0 ? `${incoming.length} por confirmar` : ""}
              {incoming.length > 0 && outgoing.length > 0 ? " · " : ""}
              {outgoing.length > 0 ? `${outgoing.length} en espera` : ""}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {visible.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              p.inbound
                ? "border-emerald-500/25 bg-slate-950/40"
                : "border-slate-800 bg-slate-950/20"
            }`}
          >
            {/* Indicador lateral que distingue acción (recibido) de información (enviado) */}
            <span
              className={`w-1 shrink-0 self-stretch rounded-full ${
                p.inbound ? "bg-emerald-400" : "bg-slate-600"
              }`}
              aria-hidden
            />

            <div className="min-w-0 flex-1">
              {p.inbound ? (
                <p className="truncate text-sm text-slate-200">
                  <strong>{p.fromName}</strong>
                  <span className="text-slate-400"> te envió </span>
                  <strong className="text-emerald-300">
                    <Money amount={p.amount} currency={currency} />
                  </strong>
                  {p.note ? <span className="text-slate-500"> · {p.note}</span> : null}
                </p>
              ) : (
                <p className="truncate text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-300">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Esperando a {p.toName}
                  </span>
                  <span className="text-slate-500"> · <Money amount={p.amount} currency={currency} /></span>
                </p>
              )}
            </div>

            {p.inbound ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <ConfirmPaymentButton
                  onConfirm={() => void decide(p.id, true)}
                  loading={deciding === p.id}
                  disabled={deciding !== null}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-rose-400"
                  disabled={deciding !== null}
                  onClick={() => void decide(p.id, false)}
                >
                  Rechazar
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {hasMany ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-xs text-slate-400 hover:text-slate-200"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded
            ? "Ocultar detalles"
            : `Ver ${pending.length} pagos pendientes`}
        </Button>
      ) : null}
    </div>
  );
}