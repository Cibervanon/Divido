import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

/**
 * Credenciales leídas de forma perezosa (en cada uso): así los tests pueden
 * desactivar Supabase en tiempo de ejecución aunque exista un .env local.
 */
function getConfig(): { url?: string; serviceKey?: string } {
  return {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** true cuando el servidor tiene credenciales de Supabase configuradas. */
export function isSupabaseEnabled(): boolean {
  const { url, serviceKey } = getConfig();
  return Boolean(url && serviceKey);
}

let client: SupabaseClient | null = null;
let clientKey: string | null = null;

function getClient(): SupabaseClient {
  const { url, serviceKey } = getConfig();
  if (!url || !serviceKey) throw new Error("Supabase no está configurado");
  if (!client || clientKey !== serviceKey) {
    client = createClient(url, serviceKey, { auth: { persistSession: false } });
    clientKey = serviceKey;
  }
  return client;
}

export const RECEIPTS_BUCKET = "comprobantes";

/** Prefijo con el que se guarda en BD la ruta de un tique alojado en Storage. */
export const RECEIPT_SCHEME = "supabase:";

const RECEIPT_TTL_SECONDS = 3600;

// ---- Validación de configuración (falla rápido con un motivo claro) ----

let bucketCheck: { at: number; ok: boolean } | null = null;
const BUCKET_CHECK_TTL_MS = 5 * 60 * 1000;

/**
 * Comprueba (con caché de 5 min) que el bucket de tiques exista.
 * createSignedUploadUrl NO valida la existencia del bucket: si falta, el
 * fallo llegaría como un críptico 404 en el PUT del navegador. Aquí lo
 * detectamos en el servidor y devolvemos un mensaje accionable.
 */
async function ensureReceiptsBucket(): Promise<void> {
  if (bucketCheck?.ok && Date.now() - bucketCheck.at < BUCKET_CHECK_TTL_MS) return;
  const { data, error } = await getClient().storage.listBuckets();
  if (error) {
    bucketCheck = null;
    throw new Error(`Supabase Storage no accesible: ${error.message}`);
  }
  const ok = data.some((b) => b.name === RECEIPTS_BUCKET);
  bucketCheck = { at: Date.now(), ok };
  if (!ok) {
    throw new Error(
      `Falta el bucket «${RECEIPTS_BUCKET}» en Supabase Storage: créalo antes de subir tiques`
    );
  }
}

/** Construye "groupId/userId/uuid.ext" sin barras duplicadas ni segmentos vacíos. */
function buildReceiptPath(groupId: string, userId: string, ext: string): string {
  const segments = [groupId, userId].map((s) => String(s ?? "").trim().replace(/^\/+|\/+$/g, ""));
  if (segments.some((s) => !s)) throw new Error("Ruta de tique inválida");
  return `${segments.join("/")}/${crypto.randomUUID()}.${ext}`;
}

/**
 * Crea una URL de subida firmada y de un solo uso (válida 10 min).
 * El navegador hace PUT directo contra Storage sin pasar por esta API.
 * Devuelve también `verifyUrl`: una URL de lectura firmada para el mismo
 * objeto, pensada para que el cliente VERIFIQUE que la subida exista de
 * verdad antes de guardar la referencia en base de datos.
 */
export async function issueReceiptUploadUrl(
  groupId: string,
  userId: string,
  ext = "jpg"
): Promise<{ path: string; signedUrl: string; verifyUrl: string | null }> {
  await ensureReceiptsBucket();
  const path = buildReceiptPath(groupId, userId, ext);
  const client = getClient();
  const { data, error } = await client.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error) throw error;
  const { data: readData } = await client.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, RECEIPT_TTL_SECONDS);
  return { path, signedUrl: data.signedUrl, verifyUrl: readData?.signedUrl ?? null };
}

// Cache de URLs firmadas (TTL 50 min para renovar antes de expirar)
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function getCachedSignedUrl(path: string): string | null {
  const entry = signedUrlCache.get(path);
  if (entry && Date.now() < entry.expiresAt) return entry.url;
  signedUrlCache.delete(path);
  return null;
}

function setCachedSignedUrl(path: string, url: string): void {
  signedUrlCache.set(path, { url, expiresAt: Date.now() + 50 * 60 * 1000 });
}

/**
 * Resuelve el valor almacenado en receipt_url a una URL consumible:
 * - null → null
 * - "supabase:<ruta>" → URL firmada con TTL de 1 h (si Supabase está configurado);
 *   si la firma falla devuelve null para no entregar nunca un enlace roto
 * - cualquier otro valor (p. ej. data-URL legacy) → se devuelve tal cual
 * Cachea la URL firmada para evitar round-trips repetidos a Supabase.
 */
export async function resolveReceiptUrl(
  value: string | null | undefined
): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith(RECEIPT_SCHEME)) return value;
  if (!isSupabaseEnabled()) return value;
  const path = value.slice(RECEIPT_SCHEME.length);
  const cached = getCachedSignedUrl(path);
  if (cached) return cached;
  const { data, error } = await getClient()
    .storage.from(RECEIPTS_BUCKET)
    .createSignedUrl(path, RECEIPT_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.warn({ err: error, path }, "No se pudo firmar la URL del tique");
    return null;
  }
  setCachedSignedUrl(path, data.signedUrl);
  return data.signedUrl;
}

/**
 * Resuelve múltiples receipt_urls en paralelo con deduplicación y caché.
 * Útil para listas de gastos donde hay muchos tiques.
 */
export async function resolveReceiptUrls(
  values: (string | null | undefined)[]
): Promise<(string | null)[]> {
  const paths = values
    .map((v, i) => {
      if (!v || !v.startsWith(RECEIPT_SCHEME)) return { i, url: v ?? null };
      const cached = getCachedSignedUrl(v.slice(RECEIPT_SCHEME.length));
      if (cached) return { i, url: cached };
      return { i, path: v.slice(RECEIPT_SCHEME.length) };
    })
    .filter((x): x is { i: number; path: string } => x.path !== undefined);

  const uniquePaths = [...new Set(paths.map((p) => p.path))];
  const results = await Promise.all(
    uniquePaths.map(async (path) => {
      const cached = getCachedSignedUrl(path);
      if (cached) return { path, url: cached };
      if (!isSupabaseEnabled()) return { path, url: RECEIPT_SCHEME + path };
      const { data, error } = await getClient()
        .storage.from(RECEIPTS_BUCKET)
        .createSignedUrl(path, RECEIPT_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        console.warn({ err: error, path }, "No se pudo firmar la URL del tique");
        return { path, url: null };
      }
      setCachedSignedUrl(path, data.signedUrl);
      return { path, url: data.signedUrl };
    })
  );

  const pathToUrl = new Map(results.map((r) => [r.path, r.url]));
  return values.map((v) => {
    if (!v) return null;
    if (!v.startsWith(RECEIPT_SCHEME)) return v;
    return pathToUrl.get(v.slice(RECEIPT_SCHEME.length)) ?? null;
  });
}

// ---- Realtime: publicación broadcast hacia los clientes ----

const channels = new Map<string, ReturnType<SupabaseClient["channel"]>>();

/**
 * Publica un evento en el canal del grupo. Es fire-and-forget: nunca lanza ni
 * bloquea la respuesta HTTP; un fallo de Realtime solo se registra por consola.
 */
export function publishGroupEvent(groupId: string, event: string): void {
  if (!isSupabaseEnabled()) return;
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
