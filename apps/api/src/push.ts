import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import webpush from "web-push";
import {
  createNotification,
  deletePushSubscription,
  listPushSubscriptions,
  type NotificationType,
} from "./store.js";
import type { Db } from "./db.js";
import { config } from "./config.js";

const KEYS_FILE = join(process.cwd(), "data", "vapid-keys.json");

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function getVapidKeys(): VapidKeys {
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@divido.app";
  const envPublic = process.env.VAPID_PUBLIC_KEY ?? "";
  const envPrivate = process.env.VAPID_PRIVATE_KEY ?? "";
  if (envPublic && envPrivate) return { publicKey: envPublic, privateKey: envPrivate, subject };
  try {
    if (existsSync(KEYS_FILE)) {
      const stored = JSON.parse(readFileSync(KEYS_FILE, "utf8")) as { publicKey?: string; privateKey?: string };
      if (stored.publicKey && stored.privateKey) {
        return { publicKey: stored.publicKey, privateKey: stored.privateKey, subject };
      }
    }
  } catch {
    // se regeneran abajo
  }
  const pair = webpush.generateVAPIDKeys();
  try {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    writeFileSync(KEYS_FILE, JSON.stringify(pair), "utf8");
  } catch {
    // sin disco persistente: las claves viven en memoria durante el proceso
  }
  return { publicKey: pair.publicKey, privateKey: pair.privateKey, subject };
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

/** Inserta la notificación en la tabla y dispara el push web en segundo plano. */
export async function createAndPushNotification(db: Db, input: NotifyInput): Promise<void> {
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
