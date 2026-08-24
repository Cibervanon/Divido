import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type ButtonHTMLAttributes, type SelectHTMLAttributes } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { isHeavyDataUrl } from "../lib/compressImage";

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
  size = "md",
  loading = false,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "icon" | "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const sizeClasses = {
    icon: "h-11 w-11 p-0",      // 44x44px minimum touch target
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };
  const base =
    "inline-flex touch-manipulation select-none items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/30",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
    ghost: "text-slate-300 hover:bg-slate-800",
    danger: "bg-rose-600/90 text-white hover:bg-rose-500",
  };
  return (
    <button type={type} className={`${base} ${variants[variant]} ${sizeClasses[size]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

/** Botón "Copiar enlace" con estado de éxito transitorio */
export function CopyLinkButton({
  url,
  onCopy,
}: {
  url: string;
  onCopy?: () => void;
}) {
  const [state, setState] = useState<"idle" | "copied">("idle");
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setState("copied");
        onCopy?.();
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "copied" ? (
        <span className="flex items-center gap-1.5 text-success-500">
          <Check className="h-4 w-4" /> Copiado
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <LinkIcon className="h-4 w-4" /> Copiar enlace
        </span>
      )}
    </Button>
  );
}

/** Botón confirmar/cobrar pago con estado de carga explícito */
export function ConfirmPaymentButton({
  onConfirm,
  loading = false,
  disabled = false,
}: {
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      disabled={disabled}
      onClick={onConfirm}
    >
      {loading ? <Spinner /> : "Confirmar"}
    </Button>
  );
}

export function Input({
  label,
  hint,
  className = "",
  rightElement,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  rightElement?: ReactNode;
}) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span> : null}
      <div className="relative">
        <input
          {...props}
          className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 ${
            rightElement ? "pr-11" : ""
          } ${className}`}
        />
        {rightElement ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">{rightElement}</div>
        ) : null}
      </div>
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

export function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  required,
  minLength,
  autoComplete = "current-password",
}: {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Input
      label={label}
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      minLength={minLength}
      autoComplete={autoComplete}
      rightElement={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="touch-manipulation rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {show ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
            </svg>
          )}
        </button>
      }
    />
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
  title: ReactNode;
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
  // Las data-URL gigantes (avatares legacy sin comprimir) no se renderizan:
  // decodificarlas en listas provocaba picos de RAM y crashes en móvil.
  if (url && !isHeavyDataUrl(url)) {
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

/**
 * Imagen segura para contextos no-Avatar: muestra `fallback` mientras falta la
 * URL, durante la carga inicial o si la imagen falla (p. ej. enlace firmado caducado).
 */
export function SmartImage({
  src,
  alt,
  className,
  fallback = null,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  // Si cambia la fuente (nueva firma, logo migrado...) reintentamos.
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (!src || failed) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

export function VerifiedBadge({
  className = "",
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "xs";
}) {
  return (
    <span
      title="Email verificado"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white ${
        size === "xs" ? "h-3 w-3" : "h-4 w-4"
      } ${className}`}
    >
      <svg
        className={size === "xs" ? "h-2 w-2" : "h-2.5 w-2.5"}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </span>
  );
}

export function GhostBadge({ className = "", showLabel = true }: { className?: string; showLabel?: boolean }) {
  return (
    <span
      title="Participante sin cuenta"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-700/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-300 ${className}`}
    >
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      {showLabel ? "Sin cuenta" : null}
    </span>
  );
}

export function Money({ amount, currency, className = "" }: { amount: number; currency: string; className?: string }) {
  const sym = currencySymbol(currency);
  const abs = Math.abs(amount).toFixed(2);
  const semanticColor = amount > 0.004 ? "text-success-500" : amount < -0.004 ? "text-danger-500" : "";
  return (
    <span className={`${semanticColor} ${className}`}>
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

export function currencySymbol(code: string): string {
  return SYMBOLS[code.toUpperCase()] ?? code.toUpperCase();
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 px-6 py-12 text-center">
      <div className="mb-3 text-slate-600">{icon}</div>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ key: string; label: string; tourId?: string }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="scrollbar-none flex snap-x snap-proximity gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`snap-start flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
            active === t.key
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
          data-tour={t.tourId}
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

export function DropdownMenu({
  button,
  children,
  align = "right",
  className = "",
}: {
  button: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {button}
      </div>
      {open ? (
        <div
          className={`absolute top-full z-30 mt-1.5 min-w-[11rem] origin-top rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-2xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
