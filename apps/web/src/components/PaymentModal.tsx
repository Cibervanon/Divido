import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { Button, Input, Modal, Select } from "./ui";
import type { MemberInfo } from "../lib/types";

export function PaymentModal({
  open,
  onClose,
  groupId,
  members,
  me,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  members: MemberInfo[];
  me: string;
  onCreated: () => void;
}) {
  const others = members.filter((m) => m.status === "active" && m.userId !== me);
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setToUserId(others[0]?.userId ?? "");
      setAmount("");
      setNote("");
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupId]);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post(`/groups/${groupId}/payments`, {
        toUserId,
        amount: Number(amount),
        note: note || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Marcar pago como saldado"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={loading} disabled={!toUserId || !amount}>
            Guardar pago
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Registra un pago que hayas hecho por un canal externo (Bizum, efectivo, transferencia) para
          saldarlo en la app.
        </p>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">He pagado a</span>
          <Select value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
            {others.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Importe"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          label="Nota (opcional)"
          placeholder="Ej. Bizum, efectivo…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
