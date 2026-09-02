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

  const pending = extractPendingPayments(events, myUserId, members);
  if (pending.length === 0) return null;

  async function confirm(paymentId: string, accepted: boolean) {
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
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm font-bold text-amber-300">
          {title} · {pending.length}
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {pending.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border px-3 py-2.5 ${
              p.inbound ? "border-amber-500/20 bg-amber-500/[0.05]" : "border-sky-500/20 bg-sky-500/[0.05]"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  p.inbound ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300"
                }`}
              >
                {p.inbound ? "Recibiendo" : "Enviando"}
              </span>
              <p className="min-w-0 truncate text-xs text-slate-300">
                {p.inbound ? (
                  <>
                    <strong>{p.fromName}</strong> te envió <strong><Money amount={p.amount} currency={currency} /></strong>
                  </>
                ) : (
                  <>
                    Enviaste <strong><Money amount={p.amount} currency={currency} /></strong> a <strong>{p.toName}</strong>
                  </>
                )}
                {p.note ? <span className="text-slate-500"> · {p.note}</span> : null}
              </p>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {p.inbound
                ? "Confirma para aplicar el pago a tu saldo."
                : "A la espera de que lo confirme."}
            </p>
            {p.inbound ? (
              <div className="mt-2 flex items-center gap-2">
                <ConfirmPaymentButton
                  onConfirm={() => void confirm(p.id, true)}
                  loading={deciding === p.id}
                  disabled={deciding !== null}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-400"
                  disabled={deciding !== null}
                  onClick={() => void confirm(p.id, false)}
                >
                  Rechazar
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}