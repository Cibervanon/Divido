import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import { Button, Input, Modal, Select } from "./ui";
import type { ExpenseDto, MemberInfo } from "../lib/types";

const FOREIGN_CURRENCIES = ["USD", "GBP", "MXN", "ARS", "COP", "CLP", "PEN", "BRL", "CHF", "CAD", "JPY"];

export function ExpenseModal({
  open,
  onClose,
  groupId,
  groupCurrency,
  members,
  defaultPayerId,
  onCreated,
  expense,
  locked = false,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupCurrency: string;
  members: MemberInfo[];
  defaultPayerId: string;
  onCreated: () => void;
  expense?: ExpenseDto;
  locked?: boolean;
}) {
  const activeMembers = members.filter((m) => m.status === "active");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(groupCurrency);
  const [exchangeRate, setExchangeRate] = useState("1");
  const [payerId, setPayerId] = useState(defaultPayerId);
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (expense) {
        setDescription(expense.description);
        setAmount(String(expense.amount));
        setCurrency(expense.currency);
        setExchangeRate(String(expense.exchangeRate));
        setPayerId(expense.payerId);
        setParticipants(expense.participants);
      } else {
        setDescription("");
        setAmount("");
        setCurrency(groupCurrency);
        setExchangeRate("1");
        setPayerId(defaultPayerId);
        setParticipants(activeMembers.map((m) => m.userId));
      }
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupId, expense]);

  const isForeign = currency !== groupCurrency;
  const share = useMemo(() => {
    const amt = Number(amount);
    const rate = Number(exchangeRate);
    if (!amt || amt <= 0 || participants.length === 0) return null;
    const total = isForeign && rate > 0 ? amt * rate : amt;
    return total / participants.length;
  }, [amount, exchangeRate, participants.length, isForeign]);

  function toggleParticipant(id: string) {
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        description,
        amount: Number(amount),
        currency,
        participants,
        payerId,
      };
      if (isForeign) body.exchangeRate = Number(exchangeRate);
      if (expense && !locked) {
        await api.patch(`/expenses/${expense.id}`, body);
      } else if (expense && locked) {
        await api.post(`/expenses/${expense.id}/modification-request`, {
          action: "edit",
          changes: body,
        });
      } else {
        await api.post(`/groups/${groupId}/expenses`, body);
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = locked ? "Solicitar modificación" : expense ? "Guardar cambios" : "Añadir gasto";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? (locked ? "Solicitar modificación" : "Editar gasto") : "Nuevo gasto"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            loading={loading}
            disabled={!description.trim() || !amount || participants.length === 0}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {locked ? (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400">
            Este gasto supera las 24 horas. El cambio se enviará a un administrador para su aprobación.
          </p>
        ) : null}
        <Input
          label="Concepto"
          placeholder="Ej. Cena en Roma"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Importe"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Select label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value={groupCurrency}>{groupCurrency}</option>
            {FOREIGN_CURRENCIES.filter((c) => c !== groupCurrency).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        {isForeign ? (
          <Input
            label={`Tipo de cambio (1 ${currency} = ? ${groupCurrency})`}
            type="number"
            min="0"
            step="0.0001"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            hint="El cambio se congela en el momento del gasto."
          />
        ) : null}
        {share !== null && participants.length > 0 ? (
          <p className="rounded-xl bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
            {participants.length} participante{participants.length > 1 ? "s" : ""} ·{" "}
            <strong>{share.toFixed(2)} {groupCurrency}</strong> cada uno
          </p>
        ) : null}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Pagado por</span>
          <Select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
            {activeMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">
            Participantes ({participants.length})
          </span>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {activeMembers.map((m) => {
              const checked = participants.includes(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => toggleParticipant(m.userId)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    checked
                      ? "border-indigo-500 bg-indigo-500/10 text-slate-100"
                      : "border-slate-800 text-slate-400 hover:bg-slate-800/50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${
                      checked ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-600"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
