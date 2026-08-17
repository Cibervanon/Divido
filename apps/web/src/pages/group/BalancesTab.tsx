import { useMemo, useState } from "react";
import { Avatar, Button, EmptyState, GhostBadge, Money, VerifiedBadge, currencySymbol } from "../../components/ui";
import { simplifyDebts, type SimplifyResult } from "../../lib/debtSimplifier";
import type { GroupDetail, MemberInfo } from "../../lib/types";
import type { SettlementTransfer } from "@divido/shared";

function buildSummaryText(groupName: string, currency: string, transfers: SettlementTransfer[]): string {
  const sym = currencySymbol(currency);
  const lines =
    transfers.length > 0
      ? transfers.map((t) => `• ${t.fromName} debe ${sym}${t.amount.toFixed(2)} a ${t.toName}`)
      : ["• Sin deudas pendientes 🎉"];
  return `📊 Resumen de ${groupName}\n${lines.join("\n")}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copia este texto:", text);
    return false;
  }
}

interface BalancesTabProps {
  detail: GroupDetail;
  myUserId: string;
  onOpenMember: (m: MemberInfo) => void;
  onToast: (msg: string) => void;
}

function SimplifyBreakdownModal({
  open,
  onClose,
  result,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  result: SimplifyResult;
  currency: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakdown-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="breakdown-title" className="text-lg font-bold text-slate-100">
            Desglose de simplificación
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          La simplificación reduce el número de pagos consolidando deudas en cadena.
          Si A debe a B y B debe a C, se propone un pago directo A → C.
        </p>
        <div className="mt-4 space-y-2 max-h-64 overflow-auto">
          {result.debts.map((d, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-800/50 p-3">
              <p className="text-sm text-slate-300">
                {d.fromName} → {d.toName}: {d.reason || "Saldo"}
              </p>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="text-rose-400">Original: <Money amount={d.originalAmount} currency={currency} /></span>
                <span className="text-emerald-400">
                  Tras simplificar: <Money amount={d.newAmount} currency={currency} />
                </span>
                {d.newAmount < d.originalAmount - 0.004 && (
                  <span className="ml-auto text-xs text-emerald-400">
                    Ahorra <Money amount={d.originalAmount - d.newAmount} currency={currency} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

export function BalancesTab({ detail, myUserId, onOpenMember, onToast }: BalancesTabProps) {
  const { group, balances, rawTransfers } = detail;
  const memberById = new Map(detail.members.map((m) => [m.userId, m]));

  const [simplifyEnabled, setSimplifyEnabled] = useState(group.simplifyDebts);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const isAdmin = detail.myRole === "admin";

  const simplified = useMemo(
    () => simplifyDebts(rawTransfers, balances.map((b) => ({ userId: b.userId, name: b.name, net: b.net }))),
    [rawTransfers, balances]
  );
  const hasSavings = simplified.originalCount > 0 && simplified.transfers.length < simplified.originalCount;
  const effectiveTransfers = simplifyEnabled ? simplified.transfers : rawTransfers;

  const coveredDebtors = new Set(effectiveTransfers.map((t) => t.fromUserId));
  const topCreditor = [...balances].sort((a, b) => b.net - a.net).find((b) => b.net > 0.004);
  const fallbackTransfers: SettlementTransfer[] = topCreditor
    ? balances
        .filter((b) => b.net < -0.004 && !coveredDebtors.has(b.userId))
        .map((b) => ({
          fromUserId: b.userId,
          fromName: b.name,
          toUserId: topCreditor.userId,
          toName: topCreditor.name,
          amount: -b.net,
        }))
    : [];
  const displayTransfers = effectiveTransfers.length > 0 ? [...effectiveTransfers, ...fallbackTransfers] : fallbackTransfers;

  async function toggleSimplify() {
    const next = !simplifyEnabled;
    setSimplifyEnabled(next);
    if (isAdmin) {
      try {
        const { api } = await import("../../lib/api");
        await api.patch(`/groups/${group.id}`, { simplifyDebts: next });
        onToast(next ? "Simplificación de pagos activada" : "Simplificación de pagos desactivada");
      } catch (err) {
        setSimplifyEnabled(!next);
        onToast(err instanceof Error ? err.message : "Error al guardar");
      }
    } else {
      onToast("Vista local solo para ti: un administrador puede guardar esta preferencia para el grupo");
    }
  }

  async function shareSummary() {
    const text = buildSummaryText(group.name, group.currency, displayTransfers);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Usuario canceló: copiamos como alternativa.
      }
    }
    if (await copyText(text)) onToast("Resumen copiado. Pégalo en WhatsApp");
  }

  async function copyBizum(name: string, phone: string) {
    if (await copyText(phone)) onToast(`Número de Bizum de ${name} copiado`);
  }

  function openPayLink(kind: "revolut" | "paypal", username: string) {
    window.open(`https://${kind}.me/${encodeURIComponent(username)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => void shareSummary()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
        </svg>
        Compartir resumen
      </button>

      {hasSavings ? (
        <div
          className={`rounded-2xl border p-4 ${
            simplifyEnabled ? "border-emerald-500/40 bg-emerald-500/10" : "border-indigo-500/40 bg-indigo-500/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className={`h-5 w-5 shrink-0 ${simplifyEnabled ? "text-emerald-400" : "text-indigo-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-100">
                {simplifyEnabled
                  ? `Simplificación activada: ${simplified.transfers.length} pago${simplified.transfers.length !== 1 ? "s" : ""} en lugar de ${simplified.originalCount}`
                  : `Simplifica tus pagos: ${simplified.originalCount} → ${simplified.transfers.length}`}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                {simplifyEnabled
                  ? "Las deudas en cadena se consolidan (si A debe a B y B a C, se propone A → C)."
                  : "Consolida las deudas en cadena para reducir el número de pagos. Requiere un administrador."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
              {simplifyEnabled ? (
                <>
                  <button
                    onClick={() => setShowBreakdown(true)}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 transition hover:bg-emerald-400"
                  >
                    Ver desglose
                  </button>
                  <button
                    onClick={() => void toggleSimplify()}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    Desactivar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => void toggleSimplify()}
                  disabled={!isAdmin}
                  className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Activar
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <SimplifyBreakdownModal
        open={showBreakdown}
        onClose={() => setShowBreakdown(false)}
        result={simplified}
        currency={group.currency}
      />

      <div className="space-y-2">
        {balances.map((b) => {
          const member = memberById.get(b.userId);
          const methods: Array<{ kind: string; label: string; onClick: () => void }> = [];
          if (b.net > 0.004 && member && !b.isMe) {
            if (member.phone) {
              methods.push({ kind: "bizum", label: "Bizum", onClick: () => void copyBizum(member!.name, member!.phone!) });
            }
            if (member.revolut) {
              methods.push({
                kind: "revolut",
                label: "Revolut",
                onClick: () => openPayLink("revolut", member!.revolut!),
              });
            }
            if (member.paypal) {
              methods.push({
                kind: "paypal",
                label: "PayPal",
                onClick: () => openPayLink("paypal", member!.paypal!),
              });
            }
          }
          return (
            <div
              key={b.userId}
              className={`rounded-2xl border bg-slate-900 ${b.isMe ? "border-indigo-500/50" : "border-slate-800"}`}
            >
              <button
                onClick={() =>
                  onOpenMember({
                    userId: b.userId,
                    name: b.name,
                    email: member?.email ?? null,
                    avatarUrl: member?.avatarUrl ?? null,
                    emailVerified: b.emailVerified ?? false,
                    isGhost: b.isGhost ?? false,
                    phone: member?.phone ?? null,
                    revolut: member?.revolut ?? null,
                    paypal: member?.paypal ?? null,
                    role: "member",
                    status: "active",
                    joinedAt: "",
                    leftAt: null,
                    frozenBalance: null,
                  })
                }
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/50"
              >
                <Avatar name={b.name} size="sm" />
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-slate-200">
                  <span className="truncate">{b.name}</span>
                  {b.emailVerified ? <VerifiedBadge /> : null}
                  {b.isGhost ? <GhostBadge showLabel={false} /> : null}
                  {b.isMe ? <span className="shrink-0 text-[10px] text-indigo-400">tú</span> : null}
                </span>
                <span className={`text-sm font-bold ${b.net > 0.004 ? "text-emerald-400" : b.net < -0.004 ? "text-rose-400" : "text-slate-500"}`}>
                  <Money amount={b.net} currency={group.currency} />
                </span>
              </button>
              {methods.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800/70 px-4 py-2.5">
                  <span className="text-[11px] text-slate-500">Pagar a {b.name}:</span>
                  {methods.map((m) => (
                    <button
                      key={m.kind}
                      onClick={m.onClick}
                      className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {displayTransfers.length > 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-3 text-sm font-bold text-slate-100">
            {simplifyEnabled ? "Pagos sugeridos (liquidación optimizada)" : "Pagos sugeridos"}
          </p>
          <p className="mb-3 text-[11px] text-slate-500">
            {simplifyEnabled
              ? `${displayTransfers.length} transferencia${displayTransfers.length !== 1 ? "s" : ""} para liquidar todo el grupo. Las deudas en cadena se consolidan (si A debe a B y B a C, se propone A → C).`
              : `${displayTransfers.length} deuda${displayTransfers.length !== 1 ? "s" : ""} directa${displayTransfers.length !== 1 ? "s" : ""} entre miembros. Activa la simplificación para consolidarlas en menos pagos.`}
          </p>
          <div className="space-y-2">
            {displayTransfers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-800/60 px-3 py-2.5 text-sm">
                <span className="font-medium text-slate-200">{t.fromName}</span>
                <svg className="h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <span className="font-medium text-slate-200">{t.toName}</span>
                <span className="ml-auto font-bold text-emerald-400">
                  <Money amount={t.amount} currency={group.currency} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="¡Cuentas al día!"
          subtitle="Nadie debe dinero a nadie en este momento."
          icon={
            <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      )}

      {detail.exMembers.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
          <p className="mb-2 text-sm font-bold text-slate-400">Exmiembros</p>
          {detail.exMembers.map((m) => (
            <div key={m.userId} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-slate-300">{m.name}</span>
              <span className={`font-semibold ${(m.frozenBalance ?? 0) > 0.004 ? "text-emerald-400" : (m.frozenBalance ?? 0) < -0.004 ? "text-rose-400" : "text-slate-500"}`}>
                <Money amount={m.frozenBalance ?? 0} currency={group.currency} />
              </span>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-slate-600">Balance congelado al abandonar el grupo. Se recupera si vuelven a unirse.</p>
        </div>
      ) : null}
    </div>
  );
}