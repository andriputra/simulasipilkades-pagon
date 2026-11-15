import { useParams } from "next/navigation";

/** Slug simulasi dari URL /e/[slug]/... — dipakai komponen klien untuk membangun
 *  alamat API dan tautan panel agar tidak perlu diteruskan lewat props. */
export function useEventSlug(): string {
  const params = useParams<{ slug: string }>();
  return params?.slug ?? "";
}

/**
 * Alamat-alamat yang dipakai halaman panel. Konsol platform tidak punya salinan
 * panel sendiri: impersonasi cukup menulis cookie panitia lalu membuka jalur
 * /e/[slug]/admin yang normal, jadi hanya ada satu pohon halaman.
 */
export function useEventPaths() {
  const slug = useEventSlug();
  return {
    slug,
    pageBase: `/e/${slug}`,
    /** API bersama — konsol hanya menambah lapisan izin di depannya */
    apiBase: `/api/e/${slug}`,
    /** kiosk publik */
    kiosk: `/e/${slug}`,
  };
}
