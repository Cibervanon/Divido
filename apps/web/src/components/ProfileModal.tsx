import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { getStoredTheme, setStoredTheme, THEMES, type ThemeId } from "../lib/theme";
import { Avatar, Button, Input, Modal, VerifiedBadge } from "./ui";

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [sent, setSent] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setAvatarUrl(user.avatarUrl ?? "");
      setTheme(getStoredTheme());
      setError("");
      setVerificationUrl("");
      setSent(false);
    }
  }, [open, user]);

  function selectTheme(id: ThemeId) {
    setTheme(id);
    setStoredTheme(id);
  }

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
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-200">
            <span className="truncate">{user.email}</span>
            {user.emailVerified ? <VerifiedBadge /> : null}
          </p>
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

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 0c0 3.314-2.017 6-4.5 6S3 6.314 3 9a9 9 0 009 9c2.76 0 5-1.79 5-4 0-2.21-2.24-4-5-4s-5-1.79-5-4 2.24-4 5-4z"
              />
            </svg>
            Tema de color
          </p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const active = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTheme(t.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition ${
                    active
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-800 bg-slate-900 hover:border-slate-700"
                  }`}
                >
                  <span className="relative flex h-8 w-8 items-center justify-center">
                    <span
                      className="h-8 w-8 rounded-full"
                      style={{ background: `linear-gradient(135deg, ${t.swatch}, ${t.accent})` }}
                    />
                    {active ? (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-indigo-400 ring-1 ring-slate-700">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </span>
                    ) : null}
                  </span>
                  <span className="text-center">
                    <span className={`block text-[11px] font-semibold ${active ? "text-slate-100" : "text-slate-300"}`}>
                      {t.name}
                    </span>
                    <span className="block text-[10px] text-slate-500">{t.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            El tema se guarda en este dispositivo y se aplica en toda la app.
          </p>
        </div>

        {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
