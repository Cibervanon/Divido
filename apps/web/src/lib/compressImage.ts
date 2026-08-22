/**
 * Compresión de imágenes en memoria antes de subirlas.
 *
 * Las cámaras de los móviles producen fotos de varios MB a resolución completa;
 * mantenerlas en memoria (data-URL o blob sin tratar) puede hacer que el SO
 * mate la PWA. Redimensionamos a un lado máximo y recomprimimos a JPEG antes
 * de tocar la red, liberando el bitmap intermedio en cuanto terminamos.
 */

export const RECEIPT_MAX_DIMENSION = 1280;
export const RECEIPT_JPEG_QUALITY = 0.8;

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Algunos navegadores no decodifican ciertos formatos vía ImageBitmap:
      // caemos al camino clásico con <img>.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Formato de imagen no soportado"));
      img.src = url;
    });
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    return {
      source: img,
      width,
      height,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Devuelve un Blob JPEG redimensionado para que su lado mayor sea
 * `maxDimension` píxeles (manteniendo proporción) con la calidad indicada.
 */
export async function compressImageToJpeg(
  file: File | Blob,
  maxDimension = RECEIPT_MAX_DIMENSION,
  quality = RECEIPT_JPEG_QUALITY,
): Promise<Blob> {
  const decoded = await decodeImage(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no permite procesar imágenes");
    ctx.drawImage(decoded.source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", quality),
    );
    if (!blob) throw new Error("No se pudo comprimir la imagen");
    return blob;
  } finally {
    decoded.release();
  }
}
