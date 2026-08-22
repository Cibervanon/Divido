import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api, ApiError } from "../../lib/api";
import { Button, EmptyState, GhostBadge, Input, Modal, Money } from "../../components/ui";
import type { InformalDebtDto, MemberInfo } from "../../lib/types";
import type { InformalDebtStatus, PiqueKind } from "@divido/shared";

// ---------- Piques y apuestas ----------

const DEBT_STATUS_LABELS: Record<InformalDebtStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptado",
  settled: "Pagado",
  rejected: "Rechazado",
};

function debtStatusLabel(status: InformalDebtStatus, isMoney: boolean): string {
  if (status === "settled") return isMoney ? "Cobrado" : "Cumplido";
  return DEBT_STATUS_LABELS[status];
}

const DEBT_STATUS_BADGE: Record<InformalDebtStatus, string> = {
  pending: "bg-amber-500/10 text-amber-300",
  accepted: "bg-indigo-500/10 text-indigo-300",
  settled: "bg-emerald-500/10 text-emerald-300",
  rejected: "bg-rose-500/10 text-rose-300",
};

const DEBT_STATUS_BORDER: Record<InformalDebtStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/5",
  accepted: "border-indigo-500/30 bg-indigo-500/5",
  settled: "border-emerald-500/30 bg-emerald-500/5",
  rejected: "border-rose-500/20 bg-slate-900/40",
};

const DEBT_STATUS_ORDER: Record<InformalDebtStatus, number> = {
  pending: 0,
  accepted: 1,
  settled: 2,
  rejected: 3,
};

export function DebtsTab({
  debts,
  members,
  myUserId,
  currency,
  onChanged,
  onNew,
}: {
  debts: InformalDebtDto[];
  members: MemberInfo[];
  myUserId: string;
  currency: string;
  onChanged: () => void;
  onNew: () => void;
  onOpenExpense?: (expenseId: string) => void;
}) {
  async function setStatus(debt: InformalDebtDto, status: InformalDebtStatus) {
    try {
      await api.patch(`/groups/${debt.groupId}/informal-debts/${debt.id}/status`, { status });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    }
  }

  const sorted = [...debts].sort(
    (a, b) => DEBT_STATUS_ORDER[a.status] - DEBT_STATUS_ORDER[b.status] || a.createdAt.localeCompare(b.createdAt)
  );

  return (
    <div className="space-y-4">
      {sorted.length > 0 ? (
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-500/50 bg-indigo-500/5 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Lanzar un pique o apuesta
        </button>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          title="No hay piques o apuestas activas en este grupo"
          subtitle="Registra aquí apuestas o deudas informales entre miembros; solo los piques de dinero aceptados cuentan en el balance"
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
          }
          action={
            <Button onClick={onNew}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Lanzar un pique
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((d) => {
            const iAmWinner = d.winnerIds.includes(myUserId);
            const iAmLoser = d.loserIds.includes(myUserId);
            const isMoney = d.kind === "money";
            const solePair = d.winnerIds.length === 1 && d.loserIds.length === 1;
            return (
              <div key={d.id} className={`rounded-2xl border p-4 ${DEBT_STATUS_BORDER[d.status]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{d.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      <span className="font-medium text-slate-300">{isMoney ? "Dinero" : "Premio"}</span>
                      <span className="text-slate-600">{" · "}</span>
                      <PiqueNames names={d.loserNames} ghosts={d.loserIsGhost} />
                      <span className="text-slate-500"> {solePair ? "debe" : "deben"} </span>
                      <PiqueNames names={d.winnerNames} ghosts={d.winnerIsGhost} />
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${DEBT_STATUS_BADGE[d.status]}`}
                  >
                    {debtStatusLabel(d.status, isMoney)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {isMoney ? (
                    <span className="text-lg font-extrabold text-slate-100">
                      <Money amount={d.amount} currency={currency} />
                    </span>
                  ) : (
                    <span className="min-w-0 text-sm font-semibold text-indigo-300">
                      <span className="font-medium text-slate-400">Premio: </span>
                      <span className="truncate">{d.prize}</span>
                    </span>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {d.status === "pending" && iAmLoser ? (
                      <>
                        <Button
                          variant="secondary"
                          className="!px-3 !py-1.5 text-xs"
                          onClick={() => setStatus(d, "accepted")}
                        >
                          Aceptar
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-3 !py-1.5 text-xs text-rose-400"
                          onClick={() => setStatus(d, "rejected")}
                        >
                          Rechazar
                        </Button>
                      </>
                    ) : null}
                    {d.status === "accepted" && iAmWinner ? (
                      <Button
                        variant="secondary"
                        className="!px-3 !py-1.5 text-xs text-emerald-400"
                        onClick={() => setStatus(d, "settled")}
                      >
                        {isMoney ? "Marcar como cobrado" : "Marcar como cumplido"}
                      </Button>
                    ) : null}
                    {d.status === "pending" && !iAmLoser ? (
                      <span className="text-[11px] text-slate-500">
                        A la espera de que {d.loserNames.join(", ")} acepten
                      </span>
                    ) : null}
                    {d.status === "accepted" && !iAmWinner ? (
                      <span className="text-[11px] text-slate-500">
                        {isMoney
                          ? `A la espera de que ${d.winnerNames.join(", ")} cobren`
                          : `A la espera de que ${d.winnerNames.join(", ")} lo den por cumplido`}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-600">
        Los piques de dinero generan su deuda en el balance al ser aceptados y se saldan al marcarlos como cobrados; los
        de premio no afectan al balance.
      </p>
    </div>
  );
}

function PiqueNames({ names, ghosts }: { names: string[]; ghosts: boolean[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {names.map((n, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1">
          <span className="truncate font-medium text-slate-300">{n}</span>
          {ghosts[i] ? <GhostBadge showLabel={false} /> : null}
          {i < names.length - 1 ? <span className="text-slate-600">,</span> : null}
        </span>
      ))}
    </span>
  );
}

export function NewDebtModal({
  open,
  onClose,
  groupId,
  currency,
  members,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  currency: string;
  members: MemberInfo[];
  onCreated: () => void;
}) {
  const active = members.filter((m) => m.status === "active");
  const [kind, setKind] = useState<PiqueKind>("money");
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [loserIds, setLoserIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [prize, setPrize] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setKind("money");
      setWinnerIds([]);
      setLoserIds([]);
      setAmount("");
      setPrize("");
      setTitle("");
      setError("");
    }
  }, [open]);

  function toggle(setter: Dispatch<SetStateAction<string[]>>, id: string) {
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await api.post(`/groups/${groupId}/informal-debts`, {
        kind,
        winnerIds,
        loserIds,
        amount: kind === "money" ? parseFloat(amount) : undefined,
        prize: kind === "prize" ? prize : undefined,
        title,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const overlap = winnerIds.some((id) => loserIds.includes(id));
  const amountNum = parseFloat(amount);
  const canSubmit =
    winnerIds.length > 0 &&
    loserIds.length > 0 &&
    !overlap &&
    title.trim().length > 0 &&
    (kind === "money" ? Number.isFinite(amountNum) && amountNum > 0 : prize.trim().length > 0) &&
    !loading;

  const chipBase =
    "rounded-full border px-3 py-1.5 text-xs font-semibold transition";
  const chipSelected = "border-indigo-500/60 bg-indigo-500/20 text-indigo-200";
  const chipIdle = "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lanzar un pique o apuesta"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} loading={loading}>
            Crear pique
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Un pique es una apuesta o deuda informal entre miembros. Los piques de dinero generan su deuda en el balance al
          ser aceptados y se saldan al cobrarlos; los de premio no afectan a los saldos.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind("money")}
            className={`${chipBase} ${kind === "money" ? chipSelected : chipIdle}`}
          >
            Dinero
          </button>
          <button
            type="button"
            onClick={() => setKind("prize")}
            className={`${chipBase} ${kind === "prize" ? chipSelected : chipIdle}`}
          >
            Premio
          </button>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Quiénes ganan
          </label>
          <div className="flex flex-wrap gap-1.5">
            {active.map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => toggle(setWinnerIds, m.userId)}
                className={`${chipBase} ${winnerIds.includes(m.userId) ? chipSelected : chipIdle}`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Quiénes deben
          </label>
          <div className="flex flex-wrap gap-1.5">
            {active.map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => toggle(setLoserIds, m.userId)}
                className={`${chipBase} ${loserIds.includes(m.userId) ? chipSelected : chipIdle}`}
              >
                {m.name}
              </button>
            ))}
          </div>
          {overlap ? (
            <p className="mt-1 text-[11px] font-medium text-rose-400">
              Una persona no puede ser ganadora y perdedora a la vez
            </p>
          ) : null}
        </div>
        {kind === "money" ? (
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
        ) : (
          <Input
            label="Premio"
            placeholder="Ej. Una comida, Un café..."
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
          />
        )}
        <Input label="Concepto" placeholder="Ej. Apuesta Clásico" value={title} onChange={(e) => setTitle(e.target.value)} />
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
