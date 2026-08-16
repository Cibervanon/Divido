import type { FastifyPluginAsync } from "fastify";
import {
  countUnreadNotifications,
  deletePushSubscription,
  deletePushSubscriptionsForUser,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  upsertPushSubscription,
  type NotificationRow,
  type PushSubscriptionKeys,
} from "../store.js";
import { badRequest } from "../errors.js";
import { requireAuth } from "../plugins.js";
import { getVapidKeys } from "../push.js";

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

function isPushKeys(v: unknown): v is PushSubscriptionKeys {
  if (!v || typeof v !== "object") return false;
  const k = v as Record<string, unknown>;
  return typeof k.p256dh === "string" && typeof k.auth === "string";
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

  app.get("/api/notifications/vapid-public-key", async () => {
    return { publicKey: getVapidKeys().publicKey };
  });

  app.post("/api/notifications/subscribe", async (request) => {
    const user = requireAuth(request);
    const body = request.body as {
      endpoint?: unknown;
      keys?: unknown;
      subscription?: { endpoint?: unknown; keys?: unknown };
    };
    const sub = body.subscription ?? body;
    const endpoint = typeof sub.endpoint === "string" && sub.endpoint.startsWith("https://") ? sub.endpoint : "";
    if (!endpoint) throw badRequest("Suscripción push inválida");
    if (!isPushKeys(sub.keys)) throw badRequest("Faltan las claves de la suscripción push");
    await upsertPushSubscription(request.db, user.id, endpoint, sub.keys);
    return { ok: true };
  });

  app.delete("/api/notifications/unsubscribe", async (request) => {
    const user = requireAuth(request);
    const body = request.body as { endpoint?: unknown };
    if (typeof body.endpoint === "string" && body.endpoint) {
      await deletePushSubscription(request.db, body.endpoint);
    } else {
      await deletePushSubscriptionsForUser(request.db, user.id);
    }
    return { ok: true };
  });
};
