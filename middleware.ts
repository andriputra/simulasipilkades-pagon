import { NextResponse, type NextRequest } from "next/server";

/**
 * Gerbang konsol platform.
 *
 * Middleware hanya melihat nama & keberadaan cookie, jadi nilainya sengaja
 * ditulis ulang di sini (lib/admin.ts tidak bisa di-import: ia menarik
 * next/headers dan koneksi basis data yang tidak tersedia di runtime edge).
 * Hanya cookie yang HILANG yang dijamin ditolak; cookie basi masih terlihat
 * "ada" di sini, jadi keputusan setelah verifikasi sesi dibuat di server
 * component (halaman masuk dan layout konsol).
 */
const PLATFORM_COOKIE = "pilkades_platform";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/platform/login") return NextResponse.next();
  if (req.cookies.get(PLATFORM_COOKIE)?.value) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/platform/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/platform/:path*"] };
