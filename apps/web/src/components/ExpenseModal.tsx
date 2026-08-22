import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { supabaseEnabled } from "../lib/supabase";
import { Button, Input, Modal, Select } from "./ui";
import { CATEGORY_LIST, detectCategory, getCategoryColor, getIconComponent } from "../constants/categories";
import type { ExpenseDto, MemberInfo } from "../lib/types";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const FOREIGN_CURRENCIES = ["USD", "GBP", "MXN", "ARS", "COP", "CLP", "PEN", "BRL", "CHF", "CAD", "JPY"];
const EPS = 0.004;

type SplitMode = "equal" | "percent" | "amount";

function CategoryBadge({
  category,
  iconName,
  isCustomIcon,
  onClick,
  className = "",
}: {
  category: string;
  iconName: string;
  isCustomIcon: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  const currentColor = getCategoryColor(category);
  const CurrentIcon = getIconComponent(iconName);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className={`touch-manipulation flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition ${className}`}
      style={{ backgroundColor: `${currentColor}20` }}
      aria-label={isCustomIcon ? "Categoría seleccionada manualmente. Click para cambiar o restaurar auto." : "Categoría auto-detectada. Click para elegir manualmente."}
    >
      <CurrentIcon className="h-5 w-5 shrink-0" style={{ color: currentColor }} />
      {isCustomIcon && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] font-bold text-white">
          ✓
        </span>
      )}
    </button>
  );
}

function CategoryPopoverContent({
  category,
  iconName,
  isCustomIcon,
  onSelectCategory,
  onResetToAuto,
}: {
  category: string;
  iconName: string;
  isCustomIcon: boolean;
  onSelectCategory: (e: React.MouseEvent<HTMLButtonElement>, cat: { category: string; iconName: string }) => void;
  onResetToAuto: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="p-2 grid grid-cols-4 gap-1.5 max-w-[280px]">
      {CATEGORY_LIST.map((cat) => {
        const CatIcon = getIconComponent(cat.iconName);
        const isActive = category === cat.category && iconName === cat.iconName;
        return (
          <button
            key={cat.category}
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelectCategory(e, cat); }}
            className={`touch-manipulation flex flex-col items-center justify-center min-w-0 w-full p-2 gap-1 rounded-lg text-[10px] font-medium transition ${
              isActive
                ? `bg-[${cat.color}]/20 text-[${cat.color}] border border-[${cat.color}]/40`
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title={cat.label}
          >
            <CatIcon className="h-5 w-5 shrink-0" style={{ color: cat.color }} />
            <span className="text-center w-full break-words line-clamp-2 overflow-hidden text-[10px] leading-tight">{cat.label}</span>
          </button>
        );
      })}
      {!isCustomIcon && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onResetToAuto(e); }}
          className="touch-manipulation flex flex-col items-center justify-center min-w-0 w-full p-2 gap-1 rounded-lg text-[10px] font-medium text-slate-500 transition hover:text-slate-300"
          title="Detección automática"
        >
          <span className="h-5 w-5 shrink-0 rounded border border-slate-600 flex items-center justify-center">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </span>
          <span className="text-center w-full break-words line-clamp-2 overflow-hidden text-[10px] leading-tight">Auto</span>
        </button>
      )}
    </div>
  );
}

export function ExpenseModal({
  open,
  onClose,
  groupId,
  groupCurrency,
  members,
  defaultPayerId,
  defaultDescription = "",
  defaultAmount = "",
  onCreated,
  expense,
  locked = false,
  hasPot = false,
  potBalance = 0,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupCurrency: string;
  members: MemberInfo[];
  defaultPayerId: string;
  defaultDescription?: string;
  defaultAmount?: string;
  onCreated: () => void;
  expense?: ExpenseDto;
  locked?: boolean;
  hasPot?: boolean;
  potBalance?: number;
}) {
  const activeMembers = useMemo(() => members.filter((m) => m.status === "active"), [members]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(groupCurrency);
  const [exchangeRate, setExchangeRate] = useState("1");
  const [payerId, setPayerId] = useState(defaultPayerId);
  const [participants, setParticipants] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [percents, setPercents] = useState<Record<string, string>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [paidFromPot, setPaidFromPot] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [category, setCategory] = useState("general");
  const [iconName, setIconName] = useState("wallet");
  const [isCustomIcon, setIsCustomIcon] = useState(false);
  const detectedFor = useRef<string | null>(null);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setError("");
      setReceiptError("");
      setReceiptPreview(null);
      setUploadingReceipt(false);
      setCategoryPopoverOpen(false);
      if (expense) {
        setDescription(expense.description);
        setAmount(String(expense.amount));
        setCurrency(expense.currency);
        setExchangeRate(String(expense.exchangeRate));
        setPayerId(expense.payerId ?? defaultPayerId);
        setParticipants(expense.participants);
        setPaidFromPot(expense.paidFromPot);
        setReceiptUrl(expense.receiptUrl);
        setCategory(expense.category);
        setIconName(expense.iconName);
        setIsCustomIcon(expense.isCustomIcon);
        detectedFor.current = expense.description;
        initCustomFromShares(expense.participants, expense.shares);
      } else {
        const all = activeMembers.map((m) => m.userId);
        setDescription(defaultDescription);
        setAmount(defaultAmount);
        setCurrency(groupCurrency);
        setExchangeRate("1");
        setPayerId(defaultPayerId);
        setParticipants(all);
        setSplitMode("equal");
        setPercents({});
        setAmounts({});
        setPaidFromPot(false);
        setReceiptUrl(null);
        const detected = detectCategory(defaultDescription);
        setCategory(detected.category);
        setIconName(detected.iconName);
        setIsCustomIcon(false);
        detectedFor.current = null;
      }
    }
  }, [open, groupId, expense, defaultDescription, activeMembers]);

  const debouncedDescription = useDebouncedValue(description, 300);

  useEffect(() => {
    if (isCustomIcon) return;
    if (debouncedDescription === detectedFor.current) return;
    detectedFor.current = debouncedDescription;
    const detected = detectCategory(debouncedDescription);
    setCategory(detected.category);
    setIconName(detected.iconName);
  }, [debouncedDescription, isCustomIcon]);

  useEffect(() => {
    if (!categoryPopoverOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCategoryPopoverOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCategoryPopoverOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [categoryPopoverOpen]);

  function initCustomFromShares(ids: string[], shares: Record<string, number> | null) {
    setPercents({});
    setAmounts({});
    if (!shares || ids.length === 0) {
      setSplitMode("equal");
      return;
    }
    setSplitMode("amount");
    const next: Record<string, string> = {};
    for (const id of ids) next[id] = String(shares[id] ?? 0);
    setAmounts(next);
  }

  const isForeign = currency !== groupCurrency;
  const totalGroup = useMemo(() => {
    const amt = Number(amount);
    const rate = Number(exchangeRate);
    if (!amt || amt <= 0) return 0;
    return isForeign && rate > 0 ? amt * rate : amt;
  }, [amount, exchangeRate, isForeign]);

  const equalShare = useMemo(() => {
    if (participants.length === 0) return 0;
    return totalGroup / participants.length;
  }, [totalGroup, participants.length]);

  const percentSum = useMemo(
    () => participants.reduce((s, id) => s + (Number(percents[id]) || 0), 0),
    [percents, participants]
  );
  const amountSum = useMemo(
    () => participants.reduce((s, id) => s + (Number(amounts[id]) || 0), 0),
    [amounts, participants]
  );

  function toggleParticipant(id: string) {
    setParticipants((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      if (splitMode !== "equal") balanceCustom(next);
      return next;
    });
  }

  function balanceCustom(ids: string[]) {
    if (splitMode === "percent") {
      setPercents(equalPercentSplit(ids));
    } else if (splitMode === "amount" && totalGroup > 0) {
      const each = ids.length ? totalGroup / ids.length : 0;
      const next: Record<string, string> = {};
      for (const id of ids) next[id] = each.toFixed(2);
      setAmounts(next);
    }
  }

  function equalPercentSplit(ids: string[]): Record<string, string> {
    const next: Record<string, string> = {};
    if (ids.length === 0) return next;
    const base = Math.floor(100 / ids.length);
    let remainder = 100 - base * ids.length;
    for (const id of ids) {
      next[id] = String(remainder > 0 ? base + 1 : base);
      if (remainder > 0) remainder -= 1;
    }
    return next;
  }

  function fmtPct(v: number): string {
    const r = Math.round(v * 100) / 100;
    return Number.isInteger(r) ? String(r) : r.toFixed(2);
  }

  function buildShares(): Record<string, number> | null {
    if (splitMode === "equal") return null;
    if (participants.length === 0) return null;
    const shares: Record<string, number> = {};
    let sum = 0;
    for (const id of participants) {
      const v =
        splitMode === "percent"
          ? (Number(percents[id]) || 0) / 100 * totalGroup
          : Number(amounts[id]) || 0;
      shares[id] = Math.round((v + Number.EPSILON) * 100) / 100;
      sum += shares[id];
    }
    const tolerance = Math.max(0.02, participants.length * 0.01);
    if (Math.abs(sum - totalGroup) > tolerance) {
      const remainder = totalGroup - sum;
      const remainingLabel =
        splitMode === "percent"
          ? `${fmtPct((remainder / (totalGroup || 1)) * 100)}%`
          : `${remainder.toFixed(2)} ${groupCurrency}`;
      throw new Error(
        `El reparto no suma el total (quedan ${remainingLabel}). Reparte a partes iguales o ajusta las cantidades.`
      );
    }
    return shares;
  }

  function switchMode(mode: SplitMode) {
    setSplitMode(mode);
    if (mode === "percent" && Object.keys(percents).length === 0 && participants.length) {
      balanceCustom(participants);
    } else if (mode === "amount" && Object.keys(amounts).length === 0 && participants.length) {
      balanceCustom(participants);
    }
  }

  async function readReceiptFile(file: File | undefined) {
    setReceiptError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setReceiptError("El tique debe ser una imagen");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptError("El tique supera los 5 MB");
      return;
    }
    if (supabaseEnabled) {
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setReceiptError("Para subirlo a la nube usa JPG o PNG");
        return;
      }
      setUploadingReceipt(true);
      try {
        // 1. La API valida permisos y devuelve URL firmada de subida
        const { path, signedUrl } = await api.post<{ path: string; signedUrl: string }>(
          `/groups/${groupId}/receipt-upload-url`,
          { ext: file.type === "image/png" ? "png" : "jpg" }
        );
        // 2. PUT directo navegador → Storage (sin pasar por el backend)
        const put = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error(String(put.status));
        setReceiptUrl(`supabase:${path}`);
        setReceiptPreview(signedUrl); // vista previa inmediata
      } catch {
        setReceiptError("No se pudo subir el tique. Inténtalo de nuevo.");
      } finally {
        setUploadingReceipt(false);
      }
      return;
    }
    // Sin Supabase configurado: comportamiento clásico (data-URL embebida)
    const reader = new FileReader();
    reader.onload = () => setReceiptUrl(String(reader.result ?? null));
    reader.onerror = () => setReceiptError("No se pudo leer el archivo");
    reader.readAsDataURL(file);
  }

  function selectCategory(e: React.MouseEvent<HTMLButtonElement>, cat: { category: string; iconName: string }) {
    e.stopPropagation();
    setCategory(cat.category);
    setIconName(cat.iconName);
    setIsCustomIcon(true);
    detectedFor.current = null;
    setCategoryPopoverOpen(false);
  }

  function resetToAuto(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setIsCustomIcon(false);
    detectedFor.current = null;
    const detected = detectCategory(description);
    setCategory(detected.category);
    setIconName(detected.iconName);
  }

  async function submit() {
    setError("");
    let shares: Record<string, number> | null = null;
    try {
      shares = buildShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reparto inválido");
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        description,
        amount: Number(amount),
        currency,
        participants,
        paidFromPot,
        receiptUrl,
        category,
        iconName,
        isCustomIcon,
      };
      if (!paidFromPot) body.payerId = payerId;
      if (isForeign) body.exchangeRate = Number(exchangeRate);
      if (splitMode !== "equal") body.shares = shares;
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
            disabled={!description.trim() || Number(amount) <= 0 || participants.length === 0}
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

        <div className="relative">
          <Input
            label="Concepto"
            placeholder="Ej. Cena en Roma"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rightElement={
              <CategoryBadge
                category={category}
                iconName={iconName}
                isCustomIcon={isCustomIcon}
                onClick={() => setCategoryPopoverOpen((o) => !o)}
              />
            }
          />
          {categoryPopoverOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 top-full z-30 mt-1.5 min-w-[280px] origin-top rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-2xl"
            >
              <CategoryPopoverContent
                category={category}
                iconName={iconName}
                isCustomIcon={isCustomIcon}
                onSelectCategory={selectCategory}
                onResetToAuto={resetToAuto}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Importe"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              const raw = e.target.value.replace(",", ".");
              if (/^\d*\.?\d{0,2}$/.test(raw) || raw === "") setAmount(raw);
            }}
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
            inputMode="decimal"
            placeholder="1.0000"
            value={exchangeRate}
            onChange={(e) => {
              const raw = e.target.value.replace(",", ".");
              if (/^\d*\.?\d{0,4}$/.test(raw) || raw === "") setExchangeRate(raw);
            }}
            hint="El cambio se congela en el momento del gasto."
          />
        ) : null}
        {hasPot ? (
          <div
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 transition ${
              paidFromPot ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800"
            }`}
          >
            <div>
              <p className="text-sm font-medium text-slate-200">Pagar con el Bote Común</p>
              <p className="text-[11px] text-slate-500">
                {paidFromPot
                  ? `Saldo disponible: ${potBalance.toFixed(2)} ${groupCurrency}`
                  : "Descuenta directamente del saldo acumulado del bote"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={paidFromPot}
              onClick={() => setPaidFromPot((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                paidFromPot ? "bg-emerald-600" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  paidFromPot ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        ) : null}
        {paidFromPot ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6"
              />
            </svg>
            El gasto se carga al bote común: el importe no se suma al saldo de ninguna persona.
          </div>
        ) : (
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
        )}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Tique (opcional)</span>
          {receiptUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 p-2">
              <button
                type="button"
                onClick={() => window.open(receiptPreview ?? receiptUrl, "_blank", "noopener")}
                className="shrink-0"
                title="Ver tique"
              >
                <img
                  src={receiptPreview ?? receiptUrl}
                  alt="Tique"
                  className="h-14 w-14 rounded-lg border border-slate-700 object-cover"
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-slate-300">
                  {receiptUrl.startsWith("supabase:") ? "Tique en la nube" : "Tique adjuntado"}
                </p>
                <p className="text-[11px] text-slate-500">Se guarda con el gasto.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReceiptUrl(null);
                  setReceiptPreview(null);
                }}
                className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/10"
              >
                Quitar
              </button>
            </div>
          ) : (
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-3 text-xs font-medium transition ${
                uploadingReceipt
                  ? "border-slate-800 text-slate-500"
                  : "border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-300"
              }`}
            >
              {uploadingReceipt ? (
                <>
                  Subiendo tique…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  Subir foto del tique
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={uploadingReceipt}
                onChange={(e) => readReceiptFile(e.target.files?.[0])}
              />
            </label>
          )}
          {receiptError ? <p className="mt-1 text-[11px] font-medium text-rose-400">{receiptError}</p> : null}
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Participantes ({participants.length})
            </span>
            <div className="flex gap-1 rounded-lg bg-slate-800 p-0.5">
              {([
                ["equal", "Iguales"],
                ["percent", "%"],
                ["amount", groupCurrency],
              ] as Array<[SplitMode, string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => switchMode(mode)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                    splitMode === mode
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto">
            {activeMembers.map((m) => {
              const checked = participants.includes(m.userId);
              return (
                <div
                  key={m.userId}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    checked
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-800 bg-transparent"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleParticipant(m.userId)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                        checked ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-600"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span
                      className={`truncate ${checked ? "text-slate-100" : "text-slate-400"}`}
                    >
                      {m.name}
                    </span>
                  </button>
                  {checked && splitMode !== "equal" ? (
                    splitMode === "percent" ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          inputMode="decimal"
                          min="0"
                          max="100"
                          value={percents[m.userId] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value.replace(",", ".");
                            if (/^\d*\.?\d*$/.test(raw) || raw === "") {
                              setPercents((prev) => ({ ...prev, [m.userId]: raw }));
                            }
                          }}
                          className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          inputMode="decimal"
                          min="0"
                          value={amounts[m.userId] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value.replace(",", ".");
                            if (/^\d*\.?\d{0,2}$/.test(raw) || raw === "") {
                              setAmounts((prev) => ({ ...prev, [m.userId]: raw }));
                            }
                          }}
                          className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-slate-500">{groupCurrency}</span>
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>

          {splitMode === "equal" && totalGroup > 0 && participants.length > 0 ? (
            <p className="mt-2 rounded-xl bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
              {participants.length} participante{participants.length > 1 ? "s" : ""}{" · "}
              <strong>{equalShare.toFixed(2)} {groupCurrency}</strong> cada uno
            </p>
          ) : null}
          {splitMode === "percent" ? (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-800/60 px-3 py-2 text-xs">
              <span className={Math.abs(percentSum - 100) < 0.01 ? "text-emerald-400" : "text-amber-400"}>
                Suma: {fmtPct(percentSum)}%
              </span>
              <button
                type="button"
                onClick={() => balanceCustom(participants)}
                className="font-semibold text-indigo-400 hover:text-indigo-300"
              >
                A partes iguales
              </button>
            </div>
          ) : null}
          {splitMode === "amount" ? (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-800/60 px-3 py-2 text-xs">
              <span className={Math.abs(amountSum - totalGroup) < 0.01 ? "text-emerald-400" : "text-amber-400"}>
                Repartido: {amountSum.toFixed(2)} de {totalGroup.toFixed(2)} {groupCurrency}
              </span>
              <button
                type="button"
                onClick={() => balanceCustom(participants)}
                className="font-semibold text-indigo-400 hover:text-indigo-300"
              >
                A partes iguales
              </button>
            </div>
          ) : null}
        </div>
        {error ? <p className="text-xs font-medium text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}