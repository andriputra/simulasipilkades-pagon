import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ensureSchema, getSettings, setSetting } from "@/lib/db";

const PUBLIC_KEYS = ["title_line1", "title_line2", "election_status", "admin_username"] as const;

export async function GET() {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await getSettings();
  const out: Record<string, string> = {};
  for (const k of PUBLIC_KEYS) out[k] = s[k] || "";
  return NextResponse.json(out);
}

export async function PUT(req: Request) {
  await ensureSchema();
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const ip = clientIp(req.headers);
  const changed: string[] = [];

  if (body.title_line1 !== undefined) {
    await setSetting("title_line1", body.title_line1.trim());
    changed.push("judul baris 1");
  }
  if (body.title_line2 !== undefined) {
    await setSetting("title_line2", body.title_line2.trim());
    changed.push("judul baris 2");
  }
  if (body.election_status !== undefined) {
    const status = body.election_status === "closed" ? "closed" : "open";
    await setSetting("election_status", status);
    changed.push(`status pemungutan: ${status}`);
  }
  if (changed.length) await audit("SETTINGS_UPDATED", changed.join(", "), "admin", ip);

  if (body.current_password !== undefined || body.new_password !== undefined) {
    const s = await getSettings();
    if (!verifyPassword(body.current_password || "", s.admin_password_hash || "")) {
      return NextResponse.json({ error: "Password lama salah." }, { status: 400 });
    }
    const np = body.new_password || "";
    if (np.length < 6) return NextResponse.json({ error: "Password baru minimal 6 karakter." }, { status: 400 });
    await setSetting("admin_password_hash", hashPassword(np));
    await audit("PASSWORD_CHANGED", "Password admin diganti", "admin", ip);
  }

  return NextResponse.json({ ok: true });
}
