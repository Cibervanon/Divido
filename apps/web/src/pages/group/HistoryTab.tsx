import { useMemo, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { Button, ConfirmPaymentButton, EmptyState, Money } from "../../components/ui";
import type { HistoryEvent, MemberInfo } from "../../lib/types";
import { downloadText, fmtDate } from "./utils";
// ---------- Historial ----------

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  expense: "gasto",
  payment: "pago",
  informal_debt: "pique",
  modification_request: "solicitud",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: "creó",
  updated: "editó",
  deleted: "eliminó",
  approved: "aprobó",
  rejected: "rechazó",
};

const AUDIT_FIELD_LABELS: Record<string, string> = {
  description: "concepto",
  amount: "importe",
  amountGroup: "importe",
  currency: "moneda",
  exchangeRate: "tipo de cambio",
  participants: "participantes",
  payerId: "pagador",
  status: "estado",
  note: "nota",
  title: "título",
  category: "categoría",
  kind: "tipo",
  prize: "premio",
  winnerIds: "ganadores",
  loserIds: "perdedores",
  action: "acción",
  payload: "datos",
};

function fmtAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length === 1 ? "1 persona" : `${value.length} personas`;
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (typeof value === "number" && /amount|prize/i.test(key)) return value.toFixed(2);
  const s = String(value);
  return s.length > 28 ? `${s.slice(0, 28)}…` : s;
}

/** Convierte { before, after } del audit log en un resumen legible en español. */
function describeAuditDiff(diff: { before?: any; after?: any } | null): string {
  if (!diff) return "";
  if (!diff.before && diff.after) {
    // Alta: mostramos el concepto si lo tenemos.
    const desc = diff.after.description ?? diff.after.title;
    return desc ? ` "${fmtAuditValue("description", desc)}"` : "";
  }
  if (diff.before && diff.after) {
    const keys = Object.keys(diff.after)
      .filter((k) => JSON.stringify(diff.before?.[k]) !== JSON.stringify(diff.after?.[k]))
      .slice(0, 3);
    if (keys.length === 0) return "";
    const parts = keys.map(
      (k) => `${AUDIT_FIELD_LABELS[k] ?? k}: ${fmtAuditValue(k, diff.before?.[k])} → ${fmtAuditValue(k, diff.after?.[k])}`
    );
    return ` (${parts.join(", ")})`;
  }
  return "";
}

export function HistoryTab({
  events,
  audit,
  currency,
  groupName,
  memberName,
  myUserId,
  onChanged,
  onViewProof,
  onOpenExpense,
  onAdd,
  hasMore,
  loadingMore,
  onLoadMore,
  members,
}: {
  events: HistoryEvent[];
  audit: any[];
  currency: string;
  groupName: string;
  memberName: (id: string) => string;
  myUserId: string;
  onChanged: () => void;
  onViewProof: (url: string) => void;
  onOpenExpense: (expenseId: string) => void;
  onAdd?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  members?: MemberInfo[];
}) {
  const [deciding, setDeciding] = useState(false);

  async function confirmPayment(id: string, accepted: boolean) {
    setDeciding(true);
    try {
      await api.patch(`/payments/${id}/confirm`, { accepted });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    } finally {
      setDeciding(false);
    }
  }

  function exportHistory() {
    const lines = [
      `Divido · Historial de actividad de ${groupName}`,
      `Exportado el ${new Date().toLocaleString("es-ES")}`,
      `Moneda del grupo: ${currency}`,
      "",
    ];
    for (const e of combined) {
      const entry = e as any;
      const when = new Date(entry.date ?? entry.created_at).toLocaleString("es-ES");
      if (e.type === "audit") {
        const entityLabel = AUDIT_ENTITY_LABELS[e.entityType] ?? e.entityType;
        const actionLabel = AUDIT_ACTION_LABELS[e.action] ?? e.action;
        lines.push(`[${when}] ${e.actorName} ${actionLabel} ${entityLabel}${describeAuditDiff(e.diff)}`);
      } else if (e.type === "member_joined") {
        lines.push(`[${when}] ${e.userName} se unió al grupo`);
      } else if (e.type === "member_left") {
        lines.push(`[${when}] ${e.userName} abandonó el grupo`);
      } else if (e.type === "member_removed") {
        lines.push(`[${when}] ${e.userName} fue expulsado del grupo`);
      } else if (e.type === "payment") {
        lines.push(
          `[${when}] ${e.fromName} pagó a ${e.toName} ${e.amount?.toFixed(2)} ${currency}${e.note ? ` (${e.note})` : ""}`
        );
      } else if (e.type === "expense") {
        const parts = [`[${when}] ${e.payerName} pagó ${e.description}`];
        parts.push(`${(e.amountGroup ?? 0).toFixed(2)} ${e.currency ?? currency}`);
        if (e.deleted) parts.push("(eliminado)");
        if (e.edited) parts.push("(modificado)");
        lines.push(parts.join(" "));
      }
    }
    lines.push("", `Total de eventos: ${combined.length}`);
    downloadText(lines.join("\n"), `historial-${groupName.replace(/[^a-z0-9]+/gi, "-")}.txt`);
  }

  // Combina eventos del historial y auditoría en una sola línea temporal
  const combined = useMemo(() => {
    const auditEvents = audit.map((a) => ({
      type: "audit" as const,
      id: a.id,
      date: a.created_at,
      created_at: a.created_at,
      entityType: a.entity_type,
      entityId: a.entity_id,
      action: a.action,
      actorName: a.actor_name,
      diff: a.diff ? JSON.parse(a.diff) : null,
    }));
    return [...events, ...auditEvents].sort((a, b) => b.date.localeCompare(a.date));
  }, [events, audit]);

  const totalItems = combined.length;

  // Type guards para TypeScript
  const isHistoryEvent = (e: any): e is HistoryEvent => e.type !== "audit";
  const isAuditEvent = (e: any): e is { type: "audit"; id: string; date: string; created_at: string; entityType: string; entityId: string; action: string; actorName: string; diff: any } => e.type === "audit";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        {totalItems > 0 ? (
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={exportHistory}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar historial
          </Button>
        ) : null}
      </div>
      <div className="space-y-1">
        {totalItems === 0 ? (
          <EmptyState
            title="No hay actividad registrada en este grupo"
            subtitle="Aquí aparecerán los gastos, pagos y cambios en orden cronológico"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            }
            action={
              onAdd ? (
                <Button onClick={onAdd}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Añadir primer gasto
                </Button>
              ) : null
            }
          />
        ) : (
        (combined as any[]).map((e, i) => {
          const isAudit = e.type === "audit";
          const isHistory = e.type !== "audit";
          const isMemberEvent = !isAudit && (e.type === "member_joined" || e.type === "member_left" || e.type === "member_removed");
          const isExpense = !isAudit && e.type === "expense";
          const isPayment = !isAudit && e.type === "payment";
          const iconColor = isAudit
            ? "bg-info-500/15 text-info-400"
            : isMemberEvent
            ? e.type === "member_joined"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-rose-500/15 text-rose-400"
            : isPayment
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-indigo-500/15 text-indigo-400";
          return (
            <div
              key={`${e.type}-${e.id}-${i}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
                isMemberEvent ? "bg-slate-900/30 opacity-80" : "hover:bg-slate-900 cursor-pointer"
              }`}
              onClick={() => {
                if (isExpense && !isAudit && e.id) onOpenExpense(e.id);
                if (isPayment && !isAudit && e.id && e.proofUrl) onViewProof(e.proofUrl!);
              }}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
                {isMemberEvent ? (
                  e.type === "member_joined" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                  ) : e.type === "member_left" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766zM17 9l-5 5m0 0l5 5m-5-5h6" />
                    </svg>
                  )
                ) : isPayment ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">
                  {isAudit ? (
                    <>
                      <strong>{e.actorName}</strong> {AUDIT_ACTION_LABELS[e.action] ?? e.action}{" "}
                      {AUDIT_ENTITY_LABELS[e.entityType] ?? e.entityType}
                      {describeAuditDiff(e.diff)}
                    </>
                  ) : isMemberEvent ? (
                    <>
                      <strong>{e.userName}</strong>{" "}
                      {e.type === "member_joined"
                        ? "se unió al grupo"
                        : e.type === "member_left"
                          ? "abandonó el grupo"
                          : "fue expulsado del grupo"}
                    </>
                  ) : isPayment ? (
                    <>
                      <strong>{e.fromName}</strong> pagó a <strong>{e.toName}</strong>
                      {e.note ? ` · ${e.note}` : ""}
                      {e.proofUrl && e.toUserId === myUserId ? (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onViewProof(e.proofUrl!);
                          }}
                          title="Ver comprobante"
                          className="ml-1.5 inline-flex items-center gap-0.5 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 transition hover:bg-slate-700"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                          </svg>
                          comprobante
                        </button>
                      ) : null}
                      {e.paymentStatus === "pending_confirmation" ? (
                        <span className="ml-1.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                          Pendiente de confirmar
                        </span>
                      ) : null}
                      {e.paymentStatus === "rejected" ? (
                        <span className="ml-1.5 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-400">
                          Rechazado
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <strong>{e.payerName}</strong> pagó {e.description}
                      {e.deleted ? <span className="ml-1.5 text-[10px] text-rose-400">(eliminado)</span> : null}
                      {e.edited ? <span className="ml-1.5 text-[10px] text-amber-400">(modificado)</span> : null}
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">{fmtDate(e.date ?? e.created_at)}</p>
              </div>
              {(isPayment || isExpense) && !isAudit ? (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`shrink-0 text-sm font-bold ${isPayment ? "text-emerald-400" : "text-slate-100"}`}>
                    <Money amount={isPayment ? (e.amount ?? 0) : (e.amountGroup ?? 0)} currency={isPayment ? currency : (e.currency ?? currency)} />
                  </span>
                  {isPayment && e.paymentStatus === "pending_confirmation" && e.toUserId === myUserId ? (
                    <div className="flex items-center gap-1.5">
                      <ConfirmPaymentButton
                        onConfirm={() => void confirmPayment(e.id, true)}
                        loading={deciding}
                        disabled={deciding}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-400"
                        disabled={deciding}
                        onClick={() => void confirmPayment(e.id, false)}
                      >
                        Rechazar
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}
        {hasMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="mt-4 w-full rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 py-3 text-sm font-semibold text-indigo-300 transition hover:border-indigo-500 hover:text-indigo-200 disabled:opacity-60"
          >
            {loadingMore ? "Cargando…" : "Cargar más actividad"}
          </button>
        ) : null}
        </div>
      </div>
  );
}

// ---------- Ajustes ----------

