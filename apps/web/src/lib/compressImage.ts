/**
 * Compresión de imágenes en memoria antes de subirlas.
 *
 * Estrategia anti-OOM en móviles:
 * - Decodificamos SIEMPRE vía <img> + objectURL (streaming gestionado por el
 *   navegador) y NUNCA vía createImageBitmap, que materializa la foto entera
 *   decodificada (una de 48 MP son ~200 MB de RGBA) y era la causa del crash.
 * - drawImage muestrea directamente al tamaño destino (≤ maxDimension): el
 *   navegador mantiene el bitmap original en memoria nativa/GPU y lo libera
 *   en cuanto soltamos la referencia del <img>, antes de serializar el JPEG.
 * - Todo el proceso tiene timeout para no quedarnos colgados con formatos
 *   problemáticos.
 *
 * Bonus: Safari decodifica HEIC en <img>, así que fotos de galería de iPhone
 * se convierten aquí a JPEG sin rechazo.
 */

export const RECEIPT_MAX_DIMENSION = 1200;
export const RECEIPT_JPEG_QUALITY = 0.75;
/** Objetivo duro por tique tras comprimir (~500 KB máximo). */
export const RECEIPT_MAX_BYTES = 500_000;
export const COMPRESSION_TIMEOUT_MS = 10_000;
/** Rechazamos fuentes patológicas antes de intentar decodificarlas. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/**
 * Una data-URL por encima de este tamaño (~150 KB de binarios) se considera
 * "pesada": renderizar muchas de estas en listas (avatares, logos legacy)
 * decodificaba megas en paralelo y agotaba la RAM del móvil.
 */
const HEAVY_DATA_URL_CHARS = 200_000;

export function isHeavyDataUrl(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith("data:") && src.length > HEAVY_DATA_URL_CHARS;
}

/** Fases visibles de una foto dentro de un formulario. */
export type ImageUploadPhase = "idle" | "compressing" | "uploading" | "saving";

function withTimeout<T>(task: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([task, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Pase único de decodificación + redimensionado + codificación JPEG. */
async function encodeImageToJpeg(
  file: File | Blob,
  maxDimension: number,
  quality: number,
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  const releaseImg = () => {
    img.onload = null;
    img.onerror = null;
    img.src = "";
    URL.revokeObjectURL(url);
  };
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("El formato de la imagen no es compatible. Prueba con un JPG o PNG."));
      img.src = url;
    });

    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no permite procesar imágenes");
    ctx.drawImage(img, 0, 0, width, height);

    // Soltamos la foto original ANTES de serializar el JPEG para aplanar
    // el pico de memoria: solo conviven el canvas pequeño y el resultado.
    releaseImg();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", quality),
    );
    if (!blob) throw new Error("No se pudo comprimir la imagen");
    return blob;
  } catch (err) {
    releaseImg();
    throw err;
  }
}

/**
 * Devuelve un Blob JPEG listo para subir: lado mayor ≤ `maxDimension`,
 * calidad inicial `quality` y, si se indica `maxBytes`, reintenta con menos
 * calidad/dimensión hasta quedar por debajo del objetivo.
 */
export async function compressImageToJpeg(
  file: File | Blob,
  maxDimension = RECEIPT_MAX_DIMENSION,
  quality = RECEIPT_JPEG_QUALITY,
  maxBytes?: number,
): Promise<Blob> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error("La imagen es demasiado grande");
  return withTimeout(
    (async () => {
      let blob = await encodeImageToJpeg(file, maxDimension, quality);
      let q = quality;
      let dim = maxDimension;
      for (let attempt = 0; maxBytes !== undefined && blob.size > maxBytes && attempt < 4; attempt++) {
        // Bajamos primero calidad y, si aún no basta, recortamos dimensión.
        if (q > 0.45) q = Math.max(0.35, q - 0.15);
        else dim = Math.max(320, Math.round(dim * 0.75));
        blob = await encodeImageToJpeg(file, dim, q);
      }
      return blob;
    })(),
    COMPRESSION_TIMEOUT_MS,
    "La imagen tardó demasiado en procesarse. Prueba con otra foto o con un JPG/PNG.",
  );
}
