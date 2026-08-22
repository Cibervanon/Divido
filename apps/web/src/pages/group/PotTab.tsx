import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { Avatar, Button, EmptyState, Input, Modal, Money } from "../../components/ui";
import type { PotContributionDto } from "../../lib/types";
import { fmtDate } from "./utils";
export function PotTab({
  balance,
  contributions,
  ledger,
  myUserId,
  isAdmin,
  currency,
  onChanged,
  onNew,
  onOpenExpense,
}: {
  balance: number;
  contributions: PotContributionDto[];
  ledger: Array<{
    id: string;
    type: "contribution" | "withdrawal";
    amount: number;
    note: string | null;
    userId: string | null;
    userName: string | null;
    expenseId: string | null;
    expenseDescription: string | null;
    createdAt: string;
    runningBalance: number;
  }>;
  myUserId: string;
  isAdmin: boolean;
  currency: string;
  onChanged: () => void;
  onNew: () => void;
  onOpenExpense?: (expenseId: string) => void;
}) {
  async function removeContribution(contribution: PotContributionDto) {
    if (!confirm(`Â¿Eliminar la aportaciÃ³n de ${contribution.userName}?`)) return;
    try {
      await api.delete(`/groups/${contribution.groupId}/common-pot/contributions/${contribution.id}`);
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-slate-900/50 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Saldo del bote comÃºn</p>
        <p className="mt-1 text-3xl font-extrabold text-emerald-300">
          <Money amount={Math.max(0, balance)} currency={currency} />
        </p>
        <p className="mt-1 text-xs text-slate-500">Dinero aportado por los miembros para gastos compartidos del grupo</p>
        {contributions.length > 0 ? (
          <Button variant="secondary" className="mt-4" onClick={onNew}>
            Aportar al bote
          </Button>
        ) : null}
      </div>

      {balance < 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-[11px] text-slate-400">
          <div className="flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p>El bote comÃºn no tiene saldo disponible. Las aportaciones y gastos pagados se mantienen en el historial inferior.</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Extracto del bote</p>
        {contributions.length === 0 ? (
          <EmptyState
            title="El bote estÃ¡ vacÃ­o"
            subtitle="Cada miembro puede aportar dinero para gastos compartidos del grupo"
            icon={
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
                />
              </svg>
            }
            action={
              <Button onClick={onNew}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                AÃ±adir dinero al bote
              </Button>
            }
          />
        ) : (
          contributions.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <Avatar name={c.userName} url={c.userAvatar} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">{c.userName}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {c.note ? `${c.note} Â· ` : ""}
                  {fmtDate(c.createdAt)}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${
                  c.amount < 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                <Money amount={c.amount} currency={currency} />
              </span>
              {c.expenseId ? (
                <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Saldado con Bote
                </span>
              ) : null}
              {!c.expenseId && (isAdmin || c.userId === myUserId) ? (
                <button
                  onClick={() => void removeContribution(c)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
                  title="Eliminar aportaciÃ³n"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      <p className="text-center text-[11px] text-slate-600">
        Las aportaciones al bote no afectan al balance de gastos compartidos.
      </p>
    </div>
  );
}

export function NewContributionModal({
  open,
  onClose,
  groupId,
  currency,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  currency: string;
  onCreated: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      setError("");
    }
  }, [open]);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await api.post(`/groups/${groupId}/common-pot/contributions`, {
        amount: parseFloat(amount),
        note: note.trim(),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const amountNum = parseFloat(amount);
  const canSubmit = Number.isFinite(amountNum) && amountNum > 0 && !loading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Aportar al bote comÃºn"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} loading={loading}>
            Aportar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          El importe se suma al saldo del bote del grupo. Apunta un concepto para que los demÃ¡s sepan a quÃ© se destina.
        </p>
        <Input
          label="Importe"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          rightElement={<span className="text-xs font-semibold text-slate-400">{currency}</span>}
        />
        <Input label="Concepto (opcional)" placeholder="Ej. Caja para la barbacoa" value={note} onChange={(e) => setNote(e.target.value)} />
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ---------- Gastos fijos ----------

