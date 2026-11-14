import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { makeToken, verifyPassword } from "@/lib/auth";
import { ensureSchema, getSettings } from "@/lib/db";

export async function POST(req: Request) {
  await ensureSchema();
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const settings = await getSettings();
  const ip = clientIp(req.headers);
  const ok =
    (body.username || "").trim() === (settings.admin_username || "admin") &&
    verifyPassword(body.password || "", settings.admin_password_hash || "");

  if (!ok) {
    await audit("LOGIN_FAILED", `Percobaan login gagal untuk "${(body.username || "").trim()}"`, "anon", ip);
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }

  await audit("LOGIN_SUCCESS", "Admin masuk ke CMS", settings.admin_username || "admin", ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeToken("admin", 8 * 3600), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
