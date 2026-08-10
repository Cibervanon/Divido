import { useEffect, type ReactNode, type InputHTMLAttributes, type ButtonHTMLAttributes, type SelectHTMLAttributes } from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 ${className}`}
    />
  );
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  const base =
    "inline-flex touch-manipulation select-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/30",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
    ghost: "text-slate-300 hover:bg-slate-800",
    danger: "bg-rose-600/90 text-white hover:bg-rose-500",
  };
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Input({
  label,
  hint,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span> : null}
      <input
        {...props}
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 ${className}`}
      />
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Select({
  label,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span> : null}
      <select
        {...props}
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 ${className}`}
      >
        {children}
      </select>
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 touch-manipulation bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg touch-manipulation overscroll-contain overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-manipulation rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Avatar({ name, url, size = "md" }: { name: string; url?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-base" };
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (url) {
    return <img src={url} alt={name} className={`${sizes[size]} rounded-full object-cover`} />;
  }
  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white`}
    >
      {initials}
    </div>
  );
}

export function Money({ amount, currency, className = "" }: { amount: number; currency: string; className?: string }) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(amount).toFixed(2);
  return (
    <span className={className}>
      {amount < 0 ? "-" : ""}
      {sym}
      {abs}
    </span>
  );
}

const SYMBOLS: Record<string, string> = {
  EUR: "€", USD: "$", GBP: "£", JPY: "¥", MXN: "$", ARS: "$", COP: "$", CLP: "$",
  PEN: "S/", BRL: "R$", CHF: "Fr", CAD: "C$", AUD: "A$", CNY: "¥", INR: "₹",
};

function currencySymbol(code: string): string {
  return SYMBOLS[code.toUpperCase()] ?? code.toUpperCase();
}

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 py-12 text-center">
      <div className="mb-3 text-slate-600">{icon}</div>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ key: string; label: string }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
            active === t.key
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 shadow-2xl">
      {children}
    </div>
  );
}
