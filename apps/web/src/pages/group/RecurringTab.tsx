import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { Button, EmptyState, Input, Modal, Money, Select } from "../../components/ui";
import type { MemberInfo, RecurringExpenseDto, RecurringFrequency } from "../../lib/types";
const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
};

export function RecurringTab({
  expenses,
  myUserId,
  isAdmin,
  currency,
  onChanged,
  onNew,
  onGenerate,
}: {
  expenses: RecurringExpenseDto[];
  myUserId: string;
  isAdmin: boolean;
  currency: string;
  onChanged: () => void;
  onNew: () => void;
  onGenerate: (expense: RecurringExpenseDto) => void;
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleActive(expense: RecurringExpenseDto) {
    setTogglingId(expense.id);
    try {
      await api.patch(`/recurring/${expense.id}/toggle`, { active: !expense.active });
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    } finally {
      setTogglingId(null);
    }
  }

  async function removeExpense(expense: RecurringExpenseDto) {
    if (!confirm(`¿Eliminar la cuota fija "${expense.title}"?`)) return;
    try {
      await api.delete(`/recurring/${expense.id}`);
      onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Error");
    }
  }

  const canManage = (expense: RecurringExpenseDto) => isAdmin || expense.responsibleId === myUserId;
  const sorted = [...expenses].sort((a, b) => Number(b.active) - Number(a.active));

  return (
    <div className="space-y-4">
      {sorted.length > 0 ? (
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-500/50 bg-indigo-500/5 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/10"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Añadir cuota fija
        </button>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          title="Sin cuotas ni suscripciones periódicas configuradas"
          subtitle="Programa aquí suscripciones o cuotas que se repiten cada mes o cada semana"
          icon={
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
          }
          action={
            <Button onClick={onNew}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Programar gasto fijo
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((expense) => (
            <div
              key={expense.id}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                expense.active ? "border-slate-800 bg-slate-900" : "border-slate-800/50 bg-slate-900/40 opacity-60"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">{expense.title}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {FREQUENCY_LABELS[expense.frequency]}{" · "}Responsable: {expense.responsibleName}
                  {expense.active ? "" : " · Pausada"}
                </p>
                <span
                  className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    expense.autoCreate
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                  title={
                    expense.autoCreate
                      ? "Se genera el gasto automáticamente cuando vence"
                      : "Solo recuerda: el gasto se registra manualmente"
                  }
                >
                  {expense.autoCreate ? "Autoregistro" : "Recordatorio"}
                </span>
              </div>
              <span className="shrink-0 text-sm font-bold text-slate-100">
                <Money amount={expense.amount} currency={currency} />
              </span>
              <button
                onClick={() => onGenerate(expense)}
                disabled={!expense.active}
                className="shrink-0 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                title="Abre el formulario de gasto con los datos de esta cuota ya rellenados"
              >
                Generar gasto ahora
              </button>
              {canManage(expense) ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => void toggleActive(expense)}
                    disabled={togglingId === expense.id}
                    title={expense.active ? "Pausar cuota" : "Reactivar cuota"}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                      expense.active ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        expense.active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => void removeExpense(expense)}
                    className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
                    title="Eliminar cuota"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-600">
        Las cuotas fijas sirven para recordar suscripciones o pagos recurrentes. El responsable las marca como pagadas
        pausando o reactivando la cuota.
      </p>
    </div>
  );
}

export function NewRecurringModal({
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
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [responsibleId, setResponsibleId] = useState("");
  const [autoCreate, setAutoCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setAmount("");
      setFrequency("monthly");
      setResponsibleId("");
      setAutoCreate(false);
      setError("");
    }
  }, [open]);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      await api.post(`/groups/${groupId}/recurring`, {
        title,
        amount: parseFloat(amount),
        frequency,
        responsibleId,
        autoCreate,
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
  const canSubmit = title.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0 && Boolean(responsibleId) && !loading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Añadir cuota fija"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit} loading={loading}>
            Añadir cuota
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Define una suscripción o pago que se repite cada mes o cada semana. El miembro responsable podrá marcarla como
          pagada pausándola.
        </p>
        <Input label="Título" placeholder="Ej. Netflix, gimnasio, alquiler..." value={title} onChange={(e) => setTitle(e.target.value)} />
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
        <div className="grid grid-cols-2 gap-3">
          <Select label="Periodicidad" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
          </Select>
          <Select label="Responsable" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            <option value="">Elegir...</option>
            {active.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div
          className={`flex items-center justify-between rounded-xl border px-3 py-2.5 transition ${
            autoCreate ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800"
          }`}
        >
          <div>
            <p className="text-sm font-medium text-slate-200">Autoregistrar gasto</p>
            <p className="text-[11px] text-slate-500">
              {autoCreate
                ? "Al vencer se crea el gasto automáticamente"
                : "Solo recuerda: el gasto se registra manualmente"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoCreate}
            onClick={() => setAutoCreate((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              autoCreate ? "bg-emerald-600" : "bg-slate-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                autoCreate ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ---------- Añadir participante sin cuenta ----------

