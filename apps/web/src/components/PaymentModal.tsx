import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError } from "../lib/api";
import {
  compressImageToJpeg,
  type ImageUploadPhase,
  RECEIPT_MAX_BYTES,
  RECEIPT_MAX_DIMENSION,
  RECEIPT_JPEG_QUALITY,
} from "../lib/compressImage";
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
  const [phase, setPhase] = useState<ImageUploadPhase>("idle");
  const phaseRef = useRef<ImageUploadPhase>("idle");
  const proofWorkRef = useRef<Promise<void> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function setPhaseBoth(next: ImageUploadPhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function requestClose() {
    if (phaseRef.current === "idle") onClose();
  }

  const busy = phase !== "idle";
  const phaseLabelText =
    phase === "compressing"
      ? "Comprimiendo foto…"
      : phase === "saving"
        ? "Guardando pago…"
        : "";

  useEffect(() => {
    if (open) {
      setToUserId(others[0]?.userId ?? "");
      setAmount("");
      setNote("");
      setProofUrl(null);
      setProofError("");
      setError("");
      proofWorkRef.current = null;
      setPhaseBoth("idle");
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
    // Trabajo registrado en proofWorkRef: submit() esperará a que termine
    // antes de guardar el pago, para no registrarlo sin el comprobante.
    const work = (async () => {
      try {
        // Compresión en memoria: evita agotar la RAM con fotos de cámara.
        setPhaseBoth("compressing");
        let blob: Blob;
        try {
          blob = await compressImageToJpeg(
            file,
            RECEIPT_MAX_DIMENSION,
            RECEIPT_JPEG_QUALITY,
            RECEIPT_MAX_BYTES,
          );
        } catch (err) {
          console.error("No se pudo procesar la imagen del comprobante", err);
          throw new Error(
            err instanceof Error && err.message
              ? err.message
              : "No se pudo procesar la imagen. Prueba con un JPG o PNG.",
          );
        }
        if (blob.size > 5 * 1024 * 1024) throw new Error("El comprobante supera los 5 MB");

        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            setProofUrl(String(reader.result ?? null));
            resolve();
          };
          reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        const motivo = err instanceof Error && err.message ? err.message : "error desconocido";
        setProofError(`No se pudo subir la foto: ${motivo}`);
      } finally {
        proofWorkRef.current = null;
        setPhaseBoth("idle");
      }
    })();
    proofWorkRef.current = work;
  }

  async function submit() {
    setError("");
    try {
      // Espera estricta: no se guarda nada hasta que el comprobante
      // esté 100% procesado y en el estado del formulario.
      if (proofWorkRef.current) await proofWorkRef.current;
      if (phaseRef.current !== "idle") return; // aún ocupado por otra foto
      setPhaseBoth("saving");
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
      setPhaseBoth("idle");
    }
  }

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title="Marcar pago como saldado"
      footer={
        <>
          <Button variant="ghost" onClick={requestClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            loading={phase === "saving"}
            disabled={!toUserId || Number(amount) <= 0 || busy}
          >
            {phase === "saving" ? "Guardando pago…" : "Guardar pago"}
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
                <Button
                  variant="ghost"
                  className="!px-3 !py-1 text-xs"
                  disabled={busy}
                  onClick={() => {
                    if (busy) return;
                    setProofUrl(null);
                  }}
                >
                  Quitar imagen
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="secondary" className="!px-3 !py-1.5 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
                Subir foto del comprobante
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => {
                readProofFile(e.target.files?.[0]);
                e.target.value = "";
              }} />
            </>
          )}
          {proofError ? <p className="mt-1 text-[11px] font-medium text-rose-400">{proofError}</p> : null}
          {!proofError && phaseLabelText && phase !== "saving" ? (
            <p className="mt-1 text-[11px] font-medium text-indigo-300">{phaseLabelText}</p>
          ) : null}
          {!proofUrl ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Sin comprobante se confirmará solo si el destinatario tiene activada la autoconfirmación; si no, deberá
              aceptarlo o rechazarlo en la app.
            </p>
          ) : null}
        </div>
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
