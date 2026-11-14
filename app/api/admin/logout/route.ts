import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminAuthed } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { ensureSchema } from "@/lib/db";

export async function POST(req: Request) {
  await ensureSchema();
  const authed = await isAdminAuthed();
  if (authed) await audit("LOGOUT", "Admin keluar dari CMS", "admin", clientIp(req.headers));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
