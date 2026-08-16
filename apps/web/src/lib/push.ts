import { api } from "./api";

const SW_PATH = "/sw.js";
const ASK_KEY = "divido.push.ask";
const STEP_TIMEOUT_MS = 12_000;

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

/** Evita que una promesa se quede colgada para siempre y bloquee la UI. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const array = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

/**
 * Devuelve la registration con un worker activo.
 * No espera `navigator.serviceWorker.ready` a ciegas: si el worker quedó en
 * installing/waiting o la instalación falló, el timeout del llamador lo corta.
 */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_PATH);
  if (reg.active) return reg;
  return navigator.serviceWorker.ready;
}

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; error: string; permanent?: boolean };

/**
 * Pide permiso (diálogo nativo), suscribe al usuario al push web y lo registra
 * en la API. Cada paso tiene timeout para no bloquear la interfaz.
 */
export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (!isPushSupported() || typeof Notification === "undefined") {
    return { ok: false, error: "Tu navegador no soporta notificaciones push.", permanent: true };
  }

  // 1) Permiso de notificaciones: el diálogo nativo debe abrirse dentro del
  //    gesto del usuario (primer paso, sin awaits previos que lo consuman).
  if (Notification.permission === "denied") {
    markPushAsked();
    return {
      ok: false,
      error: "Permiso denegado. Actívalo en los ajustes del navegador.",
      permanent: true,
    };
  }
  if (Notification.permission === "default") {
    let permission: NotificationPermission;
    try {
      permission = await withTimeout(Notification.requestPermission(), STEP_TIMEOUT_MS);
    } catch {
      return { ok: false, error: "No se pudo pedir el permiso de notificaciones.", permanent: true };
    }
    if (permission !== "granted") {
      markPushAsked();
      return { ok: false, error: "Sin permiso no podemos enviarte avisos.", permanent: true };
    }
  }

  try {
    // 2) Clave VAPID del servidor.
    const res = await withTimeout(
      api.get<{ publicKey: string }>("/notifications/vapid-public-key"),
      STEP_TIMEOUT_MS
    );

    // 3) Service Worker con worker activo (con timeout para no colgarse).
    const reg = await withTimeout(getRegistration(), STEP_TIMEOUT_MS);

    // 4) Suscripción push del dispositivo.
    const subscription = await withTimeout(
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(res.publicKey),
      }),
      STEP_TIMEOUT_MS
    );

    // 5) Guardar la suscripción en el backend.
    await withTimeout(
      api.post("/notifications/subscribe", { subscription: subscription.toJSON() }),
      STEP_TIMEOUT_MS
    );

    markPushAsked();
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "No se pudo activar. Comprueba tu conexión e inténtalo de nuevo.",
    };
  }
}

/** Desuscribe al usuario del push web en este dispositivo. */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await withTimeout(getRegistration(), STEP_TIMEOUT_MS);
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await api.delete("/notifications/unsubscribe");
      await subscription.unsubscribe();
    }
  } catch {
    // silencioso
  }
}
