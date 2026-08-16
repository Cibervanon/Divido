import { useEffect } from "react";
import { Banknote, Receipt, Zap } from "lucide-react";
import { Spinner } from "./ui";
import type { AppNotification } from "../lib/types";

const TYPE_ICONS = {
  EXPENSE_ADDED: Receipt,
  PAYMENT_SETTLED: Banknote,
  PIQUE_CREATED: Zap,
};

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} sem`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function NotificationDrawer({
  open,
  onClose,
  notifications,
  unreadCount,
  loading,
  onMarkAllRead,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkAllRead: () => void;
  onOpen: (n: AppNotification) => void;
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
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg touch-manipulation flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-slate-900 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-100">Notificaciones</h2>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="touch-manipulation rounded-lg text-xs font-semibold text-indigo-400 transition hover:text-indigo-300"
            >
              Marcar todas como leídas
            </button>
          ) : null}
        </div>
        <div className="flex-1 overscroll-contain overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No tienes notificaciones todavía</div>
          ) : (
            <ul>
              {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Receipt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(n)}
                      className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-800/60 ${
                        n.read ? "" : "bg-indigo-500/[0.06]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          n.read ? "bg-slate-800 text-slate-400" : "bg-indigo-500/15 text-indigo-400"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm font-semibold ${n.read ? "text-slate-300" : "text-slate-100"}`}>
                            {n.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(n.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug text-slate-400">{n.body}</span>
                      </span>
                      {!n.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
