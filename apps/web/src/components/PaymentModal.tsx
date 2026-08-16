import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofError, setProofError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setToUserId(others[0]?.userId ?? "");
      setAmount("");
      setNote("");
      setProofUrl(null);
      setProofError("");
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupId]);

  function readProofFile(file: File | undefined) {
    setProofError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProofError("El comprobante debe ser una imagen");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProofError("El comprobante supera los 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProofUrl(String(reader.result ?? null));
    reader.onerror = () => setProofError("No se pudo leer el archivo");
    reader.readAsDataURL(file);
  }

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await api.post(`/groups/${groupId}/payments`, {
        toUserId,
        amount: Number(amount),
        note: note || undefined,
        proofUrl: proofUrl || undefined,
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
          <Button onClick={submit} loading={loading} disabled={!toUserId || Number(amount) <= 0}>
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
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Comprobante (opcional)</span>
          {proofUrl ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.open(proofUrl, "_blank", "noopener")}
                className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-700"
              >
                <img src={proofUrl} alt="Comprobante" className="h-full w-full object-cover" />
              </button>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-slate-500">Con comprobante, el pago se confirma automáticamente.</span>
                <Button variant="ghost" className="!px-3 !py-1 text-xs" onClick={() => setProofUrl(null)}>
                  Quitar imagen
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
                Subir foto del comprobante
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => readProofFile(e.target.files?.[0])} />
            </>
          )}
          {proofError ? <p className="mt-1 text-[11px] font-medium text-rose-400">{proofError}</p> : null}
          {!proofUrl ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Sin comprobante, el destinatario deberá aceptar o rechazar el pago en la app.
            </p>
          ) : null}
        </div>
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
