import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { compressImageToJpeg } from "../lib/compressImage";
import { useAuth } from "../lib/auth";
import { analyticsEnabled, acceptAnalyticsConsent, declineAnalyticsConsent, getAnalyticsConsent } from "../lib/analytics";
import { getStoredTheme, setStoredTheme, THEMES, type ThemeId } from "../lib/theme";
import { Avatar, Button, Input, Modal, Spinner, VerifiedBadge } from "./ui";
import type { NotificationPreferences } from "../lib/types";

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
      {icon}
      {title}
      {description ? (
        <span className="ml-auto hidden text-[10px] font-normal normal-case tracking-normal text-slate-500 sm:block">
          {description}
        </span>
      ) : null}
    </p>
  );
}

function IconUser() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 002.25 19.5z" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function IconScale() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
    </svg>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-[11px] leading-snug text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-indigo-500" : "bg-slate-700"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser, refreshUser, logout } = useAuth();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [revolut, setRevolut] = useState("");
  const [paypal, setPaypal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [sent, setSent] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState("");
  const [autoConfirm, setAutoConfirm] = useState(user?.autoConfirmPayments ?? false);
  const [autoConfirmSaving, setAutoConfirmSaving] = useState(false);
  const [autoConfirmError, setAutoConfirmError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState<"yes" | "no" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setAvatarUrl(user.avatarUrl ?? "");
      setPhone(user.phone ?? "");
      setRevolut(user.revolut ?? "");
      setPaypal(user.paypal ?? "");
      setAutoConfirm(user.autoConfirmPayments ?? false);
      setTheme(getStoredTheme());
      setError("");
      setVerificationUrl("");
      setSent(false);
      setAnalyticsChoice(getAnalyticsConsent());
      loadPreferences();
    }
  }, [open, user]);

  function toggleAnalytics() {
    const next = analyticsChoice === "yes" ? "no" : "yes";
    if (next === "yes") acceptAnalyticsConsent();
    else declineAnalyticsConsent();
    setAnalyticsChoice(next);
  }

  function selectTheme(id: ThemeId) {
    setTheme(id);
    setStoredTheme(id);
  }

  if (!user) return null;

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Soltamos ya la referencia del picker para ayudar al recolector de basura.
    e.target.value = "";
    if (!file) return;
    // Comprimir en memoria: evita el reinicio de la PWA al hacer
    // fotos grandes con la cámara del móvil.
    try {
      const blob = await compressImageToJpeg(file, 512, 0.85);
      const reader = new FileReader();
      reader.onload = () => setAvatarUrl(String(reader.result ?? ""));
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("No se pudo procesar la foto de perfil", err);
      setError("No se pudo procesar la foto. Prueba con un JPG o PNG.");
    }
  }

  async function save() {
    if (!name.trim()) {
      setError("El nombre no puede estar vacío");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch("/users/me", {
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || null,
        phone: phone.trim() || null,
        revolut: revolut.trim() || null,
        paypal: paypal.trim() || null,
      });
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

  async function loadPreferences() {
    setPrefsLoading(true);
    setPrefsError("");
    try {
      const res = await api.get<{ preferences: NotificationPreferences }>("/notifications/preferences");
      setPrefs(res.preferences);
    } catch {
      setPrefsError("No se pudieron cargar los ajustes de notificaciones.");
    } finally {
      setPrefsLoading(false);
    }
  }

  async function togglePref(key: keyof NotificationPreferences, value: boolean) {
    if (!prefs) return;
    const prev = prefs;
    setPrefs({ ...prefs, [key]: value });
    setPrefsError("");
    setPrefsSaving(true);
    try {
      const res = await api.put<{ preferences: NotificationPreferences }>("/notifications/preferences", {
        [key]: value,
      });
      setPrefs(res.preferences);
    } catch {
      setPrefs(prev);
      setPrefsError("No se pudo guardar el ajuste. Inténtalo de nuevo.");
    } finally {
      setPrefsSaving(false);
    }
  }

  async function toggleAutoConfirm() {
    const prev = autoConfirm;
    const next = !autoConfirm;
    setAutoConfirm(next);
    updateUser({ autoConfirmPayments: next });
    setAutoConfirmError("");
    setAutoConfirmSaving(true);
    try {
      const res = await api.patch<{ user: { autoConfirmPayments: boolean } }>("/users/me", { autoConfirmPayments: next });
      updateUser({ autoConfirmPayments: Boolean(res.user.autoConfirmPayments) });
    } catch {
      setAutoConfirm(prev);
      updateUser({ autoConfirmPayments: prev });
      setAutoConfirmError("No se pudo guardar el ajuste.");
    } finally {
      setAutoConfirmSaving(false);
    }
  }

  function closeAndLogout() {
    onClose();
    logout();
  }

  async function exportData() {
    setExporting(true);
    try {
      const data = await api.get<unknown>("/users/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `divido-datos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo exportar tus datos. Inténtalo de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (!confirm("¿Seguro que quieres eliminar tu cuenta? Se cerrará tu sesión en todos los dispositivos.")) return;
    if (!confirm("Última confirmación: tu perfil se anonimizará definitivamente y no podrás recuperarla. Tus saldos quedarán congelados como exmiembro.")) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete("/users/me");
      onClose();
      logout();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar la cuenta");
      setDeleting(false);
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
      <div className="space-y-4">
        <section>
          <SectionHeader icon={<IconUser />} title="Datos personales" description="Cómo te ven los demás en Divido" />
          <div className="mt-2.5 flex items-center gap-4">
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
          <div className="mt-3 space-y-2.5">
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-200">
                <span className="truncate">{user.email}</span>
                {user.emailVerified ? <VerifiedBadge /> : null}
              </p>
              {user.emailVerified ? (
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                  Verificado
                </span>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                    Sin verificar
                  </span>
                  <div>
                    <Button
                      variant="secondary"
                      className="!px-3 !py-1 text-xs"
                      onClick={sendVerification}
                      loading={verifying}
                    >
                      Enviar enlace de verificación
                    </Button>
                  </div>
                  {sent ? (
                    <p className="rounded-xl bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
                      Te hemos enviado un email con el enlace de verificación.
                    </p>
                  ) : verificationUrl ? (
                    <div className="rounded-xl bg-slate-950 p-2.5 text-xs">
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
          </div>
        </section>

        <div className="border-t border-slate-800 pt-4">
          <SectionHeader
            icon={<IconWhatsApp />}
            title="Métodos de pago"
            description="Para que te paguen al instante"
          />
          <div className="mt-2.5 space-y-2.5">
            <Input
              label="Teléfono (Bizum)"
              placeholder="600 000 000"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Revolut (revolut.me/usuario)"
              placeholder="tu-usuario"
              value={revolut}
              onChange={(e) => setRevolut(e.target.value)}
            />
            <Input
              label="PayPal (paypal.me/usuario)"
              placeholder="tu-usuario"
              value={paypal}
              onChange={(e) => setPaypal(e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <SectionHeader icon={<IconShield />} title="Pagos" description="Cómo confirmas lo que recibes" />
          <div className="mt-1 divide-y divide-slate-800">
            <SwitchRow
              label="Autoconfirmar pagos recibidos sin comprobante"
              description="Si alguien registra un pago hacia ti sin adjuntar foto, se aprobará automáticamente. Si lo desactivas, tendrás que aceptarlo o rechazarlo manualmente."
              checked={autoConfirm}
              disabled={autoConfirmSaving}
              onChange={() => void toggleAutoConfirm()}
            />
          </div>
          {autoConfirmError ? <p className="mt-1 text-xs text-rose-400">{autoConfirmError}</p> : null}
        </div>

        <div className="border-t border-slate-800 pt-4">
          <SectionHeader
            icon={
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 0c0 3.314-2.017 6-4.5 6S3 6.314 3 9a9 9 0 009 9c2.76 0 5-1.79 5-4 0-2.21-2.24-4-5-4s-5-1.79-5-4 2.24-4 5-4z"
                />
              </svg>
            }
            title="Tema visual"
            description="Se guarda en este dispositivo"
          />
          <div className="mt-2.5 grid grid-cols-3 gap-2">
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
        </div>

        <div className="border-t border-slate-800 pt-4">
          <SectionHeader
            icon={<IconBell />}
            title="Notificaciones"
            description="Campana y avisos del sistema"
          />
          {prefsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : prefs ? (
            <div className="divide-y divide-slate-800">
              <SwitchRow
                label="Gastos"
                description="Cuando se añade un gasto en un grupo."
                checked={prefs.expense}
                disabled={prefsSaving}
                onChange={(v) => void togglePref("expense", v)}
              />
              <SwitchRow
                label="Pagos"
                description="Cuando recibes o realizas un pago."
                checked={prefs.payment}
                disabled={prefsSaving}
                onChange={(v) => void togglePref("payment", v)}
              />
              <SwitchRow
                label="Piques"
                description="Cuando te lanzan o te cobran un pique."
                checked={prefs.pique}
                disabled={prefsSaving}
                onChange={(v) => void togglePref("pique", v)}
              />
              <SwitchRow
                label="Cuotas fijas"
                description="Cuando se genera un gasto fijo recurrente."
                checked={prefs.recurring}
                disabled={prefsSaving}
                onChange={(v) => void togglePref("recurring", v)}
              />
            </div>
          ) : (
            <p className="rounded-xl bg-slate-950 p-3 text-xs text-rose-400">
              {prefsError || "No se pudieron cargar los ajustes."}
            </p>
          )}
          {prefsError && prefs ? <p className="mt-2 text-xs text-rose-400">{prefsError}</p> : null}
        </div>

        <div className="border-t border-slate-800 pt-4">
            <SectionHeader icon={<IconScale />} title="Legal" />
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
              <Link to="/privacy" className="hover:text-indigo-400 underline">Política de privacidad</Link>
              <Link to="/terms" className="hover:text-indigo-400 underline">Términos de uso</Link>
              <Link to="/cookies" className="hover:text-indigo-400 underline">Política de cookies</Link>
            </div>
            {analyticsEnabled ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-200">Analítica anónima</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {analyticsChoice === "yes"
                      ? "Activada: nos ayudas a entender cómo se usa Divido. Puedes desactivarla cuando quieras."
                      : analyticsChoice === "no"
                        ? "Desactivada: no se envía ningún dato de uso."
                        : "Todavía no has decidido."}
                  </p>
                </div>
                <Button
                  variant={analyticsChoice === "yes" ? "secondary" : "primary"}
                  className="shrink-0 !px-3 !py-1.5 text-xs"
                  onClick={toggleAnalytics}
                >
                  {analyticsChoice === "yes" ? "Desactivar" : "Activar"}
                </Button>
              </div>
            ) : null}
          </div>

        <div className="border-t border-slate-800 pt-4">
          <SectionHeader icon={<IconShield />} title="Cuenta" />
          <div className="mt-2.5 space-y-2">
            <Button variant="secondary" className="w-full" onClick={() => void exportData()} loading={exporting}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Descargar mis datos (JSON)
            </Button>
            <Button variant="danger" className="w-full" onClick={closeAndLogout}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                />
              </svg>
              Cerrar sesión
            </Button>
          </div>
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3">
            <p className="text-xs font-semibold text-rose-300">Eliminar cuenta</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Tu perfil se anonimiza definitivamente y se cierra la sesión en todos los dispositivos. Tus saldos en cada
              grupo quedarán congelados como exmiembro y el histórico se conserva para el resto.
            </p>
            <Button variant="danger" className="mt-2 w-full !bg-rose-500/15 !text-rose-300 hover:!bg-rose-500/25" onClick={() => void deleteAccount()} loading={deleting}>
              Eliminar mi cuenta
            </Button>
</div>
         </div>

         {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
