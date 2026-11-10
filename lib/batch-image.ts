import { isUuid } from "@/lib/orders";

export const BATCH_IMAGE_BUCKET = "batch-images";
export const MAX_IMAGE_SIDE = 1600;
export const WEBP_QUALITY = 0.85;
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const batchImagePath = (userId: string, id: string) => `${userId}/${id}.webp`;

export function isOwnedImagePath(path: string, userId: string) {
  const parts = path.split("/");
  if (parts.length !== 2 || parts[0] !== userId || !parts[1].endsWith(".webp")) return false;
  return isUuid(parts[1].slice(0, -".webp".length));
}

export function imageInputError(file: { type: string; size: number }) {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Gunakan foto JPG, PNG, atau WebP.";
  if (file.size > MAX_INPUT_BYTES) return "Ukuran foto maksimal 20 MB.";
  return null;
}

export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
