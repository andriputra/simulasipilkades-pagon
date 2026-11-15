import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/http";
import { adminCookieName } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";

export const POST = publicRoute(async (ev, req) => {
  await audit(ev.id, "LOGOUT", "Admin keluar dari CMS", "admin", clientIp(req.headers));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(ev.slug), "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
});
