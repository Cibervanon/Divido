import { api } from "./api";

const SW_PATH = "/sw.js";
const ASK_KEY = "divido.push.ask";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** ¿Debemos mostrar el aviso para activar notificaciones push? */
export function shouldAskPush(): boolean {
  if (!isPushSupported() || typeof Notification === "undefined") return false;
  if (Notification.permission !== "default") return false;
  return localStorage.getItem(ASK_KEY) !== "no";
}

export function markPushAsked(): void {
  localStorage.setItem(ASK_KEY, "no");
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const array = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(SW_PATH);
  return navigator.serviceWorker.ready;
}

/** Pide permiso, suscribe al usuario al push web y lo registra en la API. */
export async function subscribeToPush(): Promise<boolean> {
  try {
    const reg = await getReadyRegistration();
    const res = await api.get<{ publicKey: string }>("/notifications/vapid-public-key");
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(res.publicKey),
    });
    await api.post("/notifications/subscribe", { subscription: subscription.toJSON() });
    markPushAsked();
    return true;
  } catch {
    return false;
  }
}

/** Desuscribe al usuario del push web en este dispositivo. */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await getReadyRegistration();
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await api.delete("/notifications/unsubscribe");
      await subscription.unsubscribe();
    }
  } catch {
    // silencioso
  }
}
