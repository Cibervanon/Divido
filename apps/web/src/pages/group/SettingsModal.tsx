import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, ApiError } from "../../lib/api";
import { Avatar, Button, Input, Modal, Select } from "../../components/ui";
import { GROUP_EXTRAS } from "../../constants/categories";
import type { GroupDetail } from "../../lib/types";

export function SettingsModal({
  open,
  onClose,
  detail,
  isAdmin,
  onLeave,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  detail: GroupDetail;
  isAdmin: boolean;
  onLeave: () => void;
  onChanged: () => void;
}) {
  const { group } = detail;
  const isGroupAdmin = isAdmin || detail.myRole === "admin";
  const groupStatus = group.type;

  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(group.currency);
  const [type, setType] = useState<"open" | "closed">(group.type);
  const [logoUrl, setLogoUrl] = useState(group.logoUrl ?? "");
  const [enabledExtras, setEnabledExtras] = useState<string[]>(group.enabledExtras ?? []);
  const [simplifyDebts, setSimplifyDebts] = useState(group.simplifyDebts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(group.name);
      setCurrency(group.currency);
      setType(group.type);
      setLogoUrl(group.logoUrl ?? "");
      setEnabledExtras(group.enabledExtras ?? []);
      setSimplifyDebts(group.simplifyDebts);
      setError("");
    }
  }, [open, group]);

  async function handleToggleCloseGroup() {
    const newStatus = group.type === "open" ? "closed" : "open";
    if (
      confirm(
        group.type === "open"
          ? "Seguro que quieres cerrar este grupo?\n\nNo se podran anadir nuevos gastos ni pagos\nNo se podran crear nuevos piques\nEl grupo se marcara como Cerrado\nLos miembros podran ver el historial pero no modificar nada\n\nEsta accion es reversible (puedes reabrirlo desde Ajustes)."
          : "Seguro que quieres reabrir este grupo?\n\nSe permitiran anadir nuevos gastos y pagos\nSe podran crear nuevos piques\nEl grupo se marcara como Abierto\n\nEsta accion es reversible (puedes cerrarlo desde Ajustes)."
      )
    ) {
      try {
        await api.patch(`/groups/${group.id}`, { type: group.type === "open" ? "closed" : "open" });
        onChanged();
        onClose();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error al cambiar el estado del grupo");
      }
    }
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/groups/${group.id}`, { name, currency, type, logoUrl: logoUrl.trim() || null, enabledExtras, simplifyDebts });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result));
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  let closeReopenButton = null;

  if (isGroupAdmin) {
    if (group.type === "open") {
      closeReopenButton = (
        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/20"
            onClick={() => {
              if (
                confirm(
                  "Seguro que quieres cerrar este grupo?\n\n" +
                    "No se podran anadir nuevos gastos ni pagos\n" +
                    "No se podran crear nuevos piques\n" +
                    "El grupo se marcara como Cerrado\n" +
                    "Los miembros podran ver el historial pero no modificar nada\n\n" +
                    "Esta accion es reversible (puedes reabrirlo desde Ajustes)."
                )
              ) {
                (async () => {
                  try {
                    await api.patch(`/groups/${group.id}`, { type: "closed" });
                    onChanged();
                    onClose();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Error al cerrar el grupo");
                  }
                })();
              }
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cerrar grupo
          </button>
        </div>
      );
    } else {
      closeReopenButton = (
        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
            onClick={() => {
              if (
                confirm(
                  "Seguro que quieres reabrir este grupo?\n\n" +
                    "Se permitiran anadir nuevos gastos y pagos\n" +
                    "Se podran crear nuevos piques\n" +
                    "El grupo se marcara como Abierto\n\n" +
                    "Esta accion es reversible (puedes cerrarlo desde Ajustes)."
                )
              ) {
                (async () => {
                  try {
                    await api.patch(`/groups/${group.id}`, { type: "open" });
                    onChanged();
                    onClose();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Error al reabrir el grupo");
                  }
                })();
              }
            }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Reabrir grupo
          </button>
        </div>
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustes del grupo"
      footer={
        isGroupAdmin ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar
            </Button>
          </>
        ) : null
      }
    >
      <div className="space-y-4">
        {isGroupAdmin ? (
          <>
            <div className="flex items-center gap-4">
              <Avatar name={name || group.name} url={logoUrl || null} size="lg" />
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => fileRef.current?.click()}
                >
                  Subir logo
                </Button>
                {logoUrl ? (
                  <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => setLogoUrl("")}>
                    Quitar logo
                  </Button>
                ) : null}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              </div>
            </div>
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["EUR", "USD", "GBP", "MXN", "ARS", "COP", "CLP", "PEN", "BRL", "CHF", "CAD"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as "open" | "closed")}>
                <option value="open">Abierto</option>
                <option value="closed">Cerrado</option>
              </Select>
            </div>
            <div className="border-t border-slate-800 pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Extras del grupo</p>
              <div className="space-y-2">
                {GROUP_EXTRAS.map((extra) => {
                  const enabled = enabledExtras.includes(extra.key);
                  return (
                    <button
                      key={extra.key}
                      type="button"
                      onClick={() =>
                        setEnabledExtras((prev) =>
                          enabled ? prev.filter((x) => x !== extra.key) : [...prev, extra.key]
                        )
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left transition hover:border-slate-600"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-200">{extra.label}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{extra.description}</span>
                      </span>
                      <span
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                          enabled ? "bg-indigo-600" : "bg-slate-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                            enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setSimplifyDebts((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left transition hover:border-slate-600"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-200">Simplificar deudas automaticamente</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    Consolida las deudas en cadena (si A debe a B y B a C, se propone A a C) para reducir los pagos
                    sugeridos en la pestaña Saldos.
                  </span>
                </span>
                <span
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                    simplifyDebts ? "bg-indigo-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                      simplifyDebts ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </span>
              </button>
            </div>
            {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          </>
        ) : (
          <p className="text-sm text-slate-400">Solo los administradores pueden modificar la configuracion del grupo.</p>
        )}
        <div className="border-t border-slate-800 pt-4">
          <Button variant="danger" onClick={onLeave} className="w-full">
            Abandonar grupo
          </Button>
        </div>
        {closeReopenButton}
      </div>
    </Modal>
  );
}