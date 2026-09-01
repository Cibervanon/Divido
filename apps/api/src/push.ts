import webpush from "web-push";
import { createNotification, deletePushSubscription, getNotificationPreferences, listPushSubscriptions, type NotificationType } from "./store.js";
import type { Db } from "./db.js";
import { config } from "./config.js";

const isProduction = process.env.NODE_ENV === "production";

let vapidKeysCache: { publicKey: string; privateKey: string; subject: string } | null = null;

export function getVapidKeys() {
  if (vapidKeysCache) return vapidKeysCache;
  
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@divido.app";
  const envPublic = process.env.VAPID_PUBLIC_KEY ?? "";
  const envPrivate = process.env.VAPID_PRIVATE_KEY ?? "";
  
  if (!isProduction) {
    // En desarrollo permitimos fallback a variables de entorno o generación
    if (envPublic && envPrivate) {
      vapidKeysCache = { publicKey: envPublic, privateKey: envPrivate, subject };
      return vapidKeysCache;
    }
    const pair = webpush.generateVAPIDKeys();
    vapidKeysCache = { publicKey: pair.publicKey, privateKey: pair.privateKey, subject };
    return vapidKeysCache;
  }
  
  // En producción son obligatorias
  if (!envPublic || !envPrivate) {
    throw new Error("VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY son obligatorios en producción");
  }
  vapidKeysCache = { publicKey: envPublic, privateKey: envPrivate, subject };
  return vapidKeysCache;
}

export async function sendPushToUser(
  db: Db,
  userId: string,
  payload: { title: string; body: string; url: string }
): Promise<void> {
  const keys = getVapidKeys();
  const subs = await listPushSubscriptions(db, userId);
  if (subs.length === 0) return;
  const options = {
    vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
    TTL: 60 * 60 * 24,
  };
  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: `${config.webOrigin}/logo.svg`,
    badge: `${config.webOrigin}/logo.svg`,
    url: payload.url,
  });
  for (const sub of subs) {
    const target = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    };
    try {
      await webpush.sendNotification(target, data, options);
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await deletePushSubscription(db, sub.endpoint).catch(() => {});
      }
    }
  }
}

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string;
}

/** Relaciona cada tipo de aviso con la categoría de preferencias del usuario. */
const CATEGORY_BY_TYPE: Record<NotificationType, keyof import("./store.js").NotificationPreferences> = {
  EXPENSE_ADDED: "expense",
  PAYMENT_SETTLED: "payment",
  PAYMENT_PENDING: "payment",
  PIQUE_CREATED: "pique",
  RECURRING_EXPENSE: "recurring",
};

/** Inserta la notificación en la tabla y dispara el push web en segundo plano. */
export async function createAndPushNotification(db: Db, input: NotifyInput): Promise<void> {
  // Respeta las preferencias del usuario: si desactivó la categoría,
  // no se genera ni la notificación in-app ni el push.
  const prefs = await getNotificationPreferences(db, input.userId);
  if (!prefs[CATEGORY_BY_TYPE[input.type]]) return;

  await createNotification(db, {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    linkUrl: input.linkUrl,
  });
  try {
    await sendPushToUser(db, input.userId, {
      title: input.title,
      body: input.body,
      url: `${config.webOrigin}${input.linkUrl}`,
    });
  } catch {
    // El push es best-effort; la notificación in-app ya está guardada.
  }
}
