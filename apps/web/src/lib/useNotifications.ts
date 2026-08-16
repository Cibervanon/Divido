import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { AppNotification } from "./types";

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ notifications: AppNotification[]; unreadCount: number }>("/notifications");
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // silencioso: se reintenta en el siguiente ciclo
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(c - 1, 0));
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  return { notifications, unreadCount, refresh, markRead, markAllRead };
}
