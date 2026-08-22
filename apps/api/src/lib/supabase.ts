import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** true cuando el servidor tiene credenciales de Supabase configuradas. */
export const supabaseEnabled = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    if (!url || !serviceKey) throw new Error("Supabase no está configurado");
    client = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  return client;
}

export const RECEIPTS_BUCKET = "comprobantes";

/** Prefijo con el que se guarda en BD la ruta de un tique alojado en Storage. */
export const RECEIPT_SCHEME = "supabase:";

const RECEIPT_TTL_SECONDS = 3600;

/**
 * Crea una URL de subida firmada y de un solo uso (válida 10 min).
 * El navegador hace PUT directo contra Storage sin pasar por esta API.
 */
export async function issueReceiptUploadUrl(
  groupId: string,
  userId: string,
  ext = "jpg"
): Promise<{ path: string; signedUrl: string }> {
  const path = `${groupId}/${userId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await getClient()
    .storage.from(RECEIPTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error) throw error;
  return { path, signedUrl: data.signedUrl };
}

/**
 * Resuelve el valor almacenado en receipt_url a una URL consumible:
 * - null → null
 * - "supabase:<ruta>" → URL firmada con TTL de 1 h (si Supabase está configurado)
 * - cualquier otro valor (p. ej. data-URL legacy) → se devuelve tal cual
 */
export async function resolveReceiptUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith(RECEIPT_SCHEME)) return value;
  if (!supabaseEnabled) return value;
  const path = value.slice(RECEIPT_SCHEME.length);
  const { data, error } = await getClient()
    .storage.from(RECEIPTS_BUCKET)
    .createSignedUrl(path, RECEIPT_TTL_SECONDS);
  if (error) return value;
  return data.signedUrl;
}

// ---- Realtime: publicación broadcast hacia los clientes ----

const channels = new Map<string, ReturnType<SupabaseClient["channel"]>>();

/**
 * Publica un evento en el canal del grupo. Es fire-and-forget: nunca lanza ni
 * bloquea la respuesta HTTP; un fallo de Realtime solo se registra por consola.
 */
export function publishGroupEvent(groupId: string, event: string): void {
  if (!supabaseEnabled) return;
  void (async () => {
    try {
      const topic = `grp:${groupId}`;
      let ch = channels.get(topic);
      if (!ch) {
        ch = getClient().channel(topic, { config: { broadcast: { self: false } } });
        channels.set(topic, ch);
        await new Promise<void>((resolve, reject) => {
          ch!.subscribe((status) =>
            status === "SUBSCRIBED" ? resolve() : reject(new Error(`Realtime ${status}`))
          );
        });
      }
      await ch.send({ type: "broadcast", event, payload: { at: Date.now() } });
    } catch (err) {
      channels.delete(`grp:${groupId}`);
      console.warn({ err }, "No se pudo publicar el evento de grupo");
    }
  })();
}
