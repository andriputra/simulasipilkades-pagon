import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieValue, makeToken, sha256, verifyToken } from "./auth";
import { sql } from "./db";

const ADMIN_COOKIE_BASE = "pilkades_admin";

/** Cookie sesi superadmin platform. Namanya didefinisikan di sini agar
 *  pemeriksaan "apakah sedang impersonasi" cukup satu tempat. */
export const PLATFORM_COOKIE = "pilkades_platform";

/** Sesi konsol berlaku 12 jam dan bisa dicabut lebih awal lewat daftar sesi. */
export const PLATFORM_SESSION_TTL = 12 * 3600;

export function platformCookieOpts(maxAge = PLATFORM_SESSION_TTL) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Satu cookie per simulasi: panitia yang mengelola dua event tidak saling menggeser login. */
export function adminCookieName(slug: string): string {
  return `${ADMIN_COOKIE_BASE}_${slug}`;
}

/** Sidik jari sesi selalu memuat id event, jadi login ke satu simulasi
 *  tidak bisa dipakai membuka simulasi lain. */
export function adminTokenPayload(eventId: number): string {
  return `e${eventId}`;
}

/** Sesi panitia berlaku 8 jam — cukup untuk sehari pelaksanaan. */
export const ADMIN_TOKEN_TTL = 8 * 3600;

/** Option cookie sesi panitia: dipakai login biasa maupun surat masuk superadmin. */
export function adminSessionOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ADMIN_TOKEN_TTL,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Surat masuk sesi panitia untuk satu simulasi — nilai cookie sama persis
 *  dengan hasil login manual, jadi panel tidak punya jalur sesi kedua. */
export function platformCookieToken(eventId: number): string {
  return makeToken(adminTokenPayload(eventId), ADMIN_TOKEN_TTL);
}

/** Tulis cookie sesi panitia ke respons. Satu-satunya tempat option cookie
 *  ditentukan, sehingga login CMS dan surat masuk superadmin identik. */
export function setPanelCookie(res: NextResponse, slug: string, eventId: number): void {
  res.cookies.set(adminCookieName(slug), platformCookieToken(eventId), adminSessionOpts());
}

export async function isAdminForEvent(eventId: number, slug: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(adminCookieName(slug))?.value;
  if (token && verifyToken(token) === adminTokenPayload(eventId)) return true;
  return isPlatformSessionLive();
}

/**
 * Sesi superadmin memberi akses panel ke SEMUA simulasi (mode impersonasi).
 * Sengaja dicek lewat kecocokan nilai cookie dengan kolom token_hash di tabel
 * sesi, bukan lewat current_setting('app.platform_admin') di dalam transaksi
 * data event: kalau dua mekanisme itu dipakai bersamaan, sesi yang dicabut
 * masih bisa menyisipkan baris lewat WITH CHECK kebijakan event.
 */
export async function isPlatformSessionLive(): Promise<boolean> {
  const token = await cookieValue(PLATFORM_COOKIE);
  if (!token) return false;
  const rows = await sql`
    select 1
    from platform_sessions s
    join platform_users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.revoked_at is null and s.expires_at > now()
    limit 1`;
  return rows.length > 0;
}
