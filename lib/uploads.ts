import { HttpError } from "./http";

export const PLACEHOLDER_PHOTO = "/seed/placeholder.svg";
export const DEFAULT_LOGO = "/seed/logo-desa.svg";

/** Data-URI gambar dari browser (hasil kompresi) — hanya gambar yang boleh masuk DB. */
export function normalizeImageData(raw: unknown, fallback: string, maxChars: number, label: string): string {
  const value = String(raw ?? "").trim() || fallback;
  if (value.startsWith("/")) return value;
  if (!value.startsWith("data:image/")) throw new HttpError(400, `Format ${label} tidak didukung.`);
  if (value.length > maxChars) throw new HttpError(413, `Ukuran ${label} terlalu besar.`);
  return value;
}
