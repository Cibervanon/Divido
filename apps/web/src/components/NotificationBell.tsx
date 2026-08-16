import { Bell } from "lucide-react";

export function NotificationBell({
  unreadCount,
  onClick,
}: {
  unreadCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : "Notificaciones"}
      className="relative touch-manipulation rounded-full p-2 text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? "+9" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
