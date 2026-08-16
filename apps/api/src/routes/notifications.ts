import type { FastifyPluginAsync } from "fastify";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "../store.js";
import { badRequest } from "../errors.js";
import { requireAuth } from "../plugins.js";

function toNotificationDto(n: NotificationRow) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: Boolean(n.read),
    linkUrl: n.link_url,
    createdAt: n.created_at,
  };
}

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/notifications", async (request) => {
    const user = requireAuth(request);
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(request.db, user.id),
      countUnreadNotifications(request.db, user.id),
    ]);
    return { notifications: notifications.map(toNotificationDto), unreadCount };
  });

  app.patch("/api/notifications/:id/read", async (request) => {
    const user = requireAuth(request);
    const { id } = request.params as { id: string };
    if (!id) throw badRequest("Falta la notificación");
    await markNotificationRead(request.db, id, user.id);
    return { ok: true };
  });

  app.patch("/api/notifications/read-all", async (request) => {
    const user = requireAuth(request);
    await markAllNotificationsRead(request.db, user.id);
    return { ok: true };
  });
};
