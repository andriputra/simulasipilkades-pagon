import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin";
import { audit, clientIp } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ensureSchema, getSettings, setSetting } from "@/lib/db";

const PUBLIC_KEYS = [
  "title_line1",
  "title_line2",
  "election_status",
  "vote_mode",
  "admin_username",
  "invite_date",
  "invite_time",
  "invite_tps",
  "invite_address",
  "invite_watermark",
  "logo_url",
] as const;

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
  if (body.vote_mode !== undefined) {
    const mode = body.vote_mode === "live" ? "live" : "simulasi";
    const prev = (await getSettings()).vote_mode === "live" ? "live" : "simulasi";
    await setSetting("vote_mode", mode);
    changed.push(`mode pemungutan: ${mode}`);
    if (mode !== prev) {
      await audit(
        "VOTE_MODE_CHANGED",
        mode === "live"
          ? "Mode diubah ke LIVE — 1 undangan hanya berlaku 1 suara, suara terkunci"
          : "Mode diubah ke SIMULASI — kode boleh dipakai ulang, suara terakhir menimpa",
        "admin",
        ip
      );
    }
  }
  const TEXT_KEYS = ["title_line1", "title_line2", "invite_date", "invite_time", "invite_tps", "invite_address", "invite_watermark"] as const;
  for (const key of TEXT_KEYS) {
    if (body[key] !== undefined) {
      await setSetting(key, String(body[key]).trim());
      changed.push(key);
    }
  }
  if (body.logo_url !== undefined) {
    const logo = String(body.logo_url).trim();
    const okLogo = logo === "" || logo.startsWith("/seed/") || logo.startsWith("data:image/");
    if (!okLogo) return NextResponse.json({ error: "Format logo tidak didukung." }, { status: 400 });
    if (logo.length > 1_500_000) return NextResponse.json({ error: "Ukuran logo terlalu besar." }, { status: 413 });
    await setSetting("logo_url", logo || "/seed/logo-desa.svg");
    changed.push("logo");
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
