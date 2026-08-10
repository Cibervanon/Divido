import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Button, Input, Modal } from "./ui";

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setAvatarUrl(user.avatarUrl ?? "");
      setError("");
      setVerificationUrl("");
      setSent(false);
    }
  }, [open, user]);

  if (!user) return null;

  const isDataUrl = avatarUrl.startsWith("data:image");

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!name.trim()) {
      setError("El nombre no puede estar vacío");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch("/users/me", { name: name.trim(), avatarUrl: avatarUrl.trim() || null });
      await refreshUser();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function sendVerification() {
    setVerifying(true);
    setError("");
    try {
      const res = await api.post<{
        verificationUrl?: string | null;
        sent?: boolean;
        alreadyVerified?: boolean;
      }>("/users/me/send-verification-email");
      if (res.alreadyVerified) {
        await refreshUser();
      } else {
        setSent(Boolean(res.sent));
        setVerificationUrl(res.verificationUrl ?? "");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al enviar verificación");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tu perfil"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={save} loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={name || user.name} url={avatarUrl || null} size="lg" />
          <div className="flex flex-col gap-2">
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
              Subir foto
            </Button>
            {avatarUrl ? (
              <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setAvatarUrl("")}>
                Quitar foto
              </Button>
            ) : null}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          </div>
        </div>

        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Foto (URL)"
          placeholder="https://... o déjalo vacío"
          value={isDataUrl ? "Imagen subida desde tu dispositivo" : avatarUrl}
          readOnly={isDataUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
        />

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-400">Email</p>
          <p className="mt-0.5 text-sm text-slate-200">{user.email}</p>
          {user.emailVerified ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
              Verificado
            </span>
          ) : (
            <div className="mt-2 space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
                Sin verificar
              </span>
              <div>
                <Button
                  variant="secondary"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={sendVerification}
                  loading={verifying}
                >
                  Enviar enlace de verificación
                </Button>
              </div>
              {sent ? (
                <p className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  Te hemos enviado un email con el enlace de verificación.
                </p>
              ) : verificationUrl ? (
                <div className="rounded-xl bg-slate-950 p-3 text-xs">
                  <p className="text-slate-400">
                    (Demo: no se pudo enviar el email. Haz clic para verificar):
                  </p>
                  <a
                    href={verificationUrl}
                    className="mt-1 block break-all font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    {verificationUrl}
                  </a>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
