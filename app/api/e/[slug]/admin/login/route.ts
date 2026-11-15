import { NextResponse } from "next/server";
import { publicRoute, readJsonBody } from "@/lib/http";
import { setPanelCookie } from "@/lib/admin";
import { verifyPassword } from "@/lib/auth";
import { getEventSettings } from "@/lib/db";
import { audit, clientIp } from "@/lib/audit";
import { isRateLimited } from "@/lib/rate-limit";

export const POST = publicRoute(async (ev, req) => {
  const body = await readJsonBody<{ username?: string; password?: string }>(req);
  const ip = clientIp(req.headers);

  if (isRateLimited(`login:${ev.slug}:${ip}`, 10)) {
    await audit(ev.id, "LOGIN_RATE_LIMITED", "Terlalu banyak percobaan login dari IP ini", "anon", ip);
    return NextResponse.json(
      { error: "Terlalu sering mencoba. Tunggu sekitar 15 menit lalu coba lagi." },
      { status: 429 },
    );
  }

  const settings = await getEventSettings(ev.id);
  const username = (body.username || "").trim();
  const ok =
    username === (settings.admin_username || "admin") &&
    verifyPassword(body.password || "", settings.admin_password_hash || "");

  if (!ok) {
    await audit(ev.id, "LOGIN_FAILED", `Percobaan login gagal untuk "${username}"`, "anon", ip);
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }

  await audit(ev.id, "LOGIN_SUCCESS", `Admin masuk ke CMS ${ev.name}`, username, ip);
  const res = NextResponse.json({ ok: true });
  setPanelCookie(res, ev.slug, ev.id);
  return res;
});
