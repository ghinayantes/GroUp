import { fitWithin, WEBP_QUALITY } from "@/lib/batch-image";

export async function resizeToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas tidak tersedia.");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
    if (blob.type !== "image/webp") throw new Error("Browser tidak mendukung WebP.");
    return blob;
  } finally {
    bitmap.close();
  }
}
