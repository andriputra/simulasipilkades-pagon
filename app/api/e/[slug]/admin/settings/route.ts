import { adminRoute, json, readJsonBody, HttpError } from "@/lib/http";
import { getEventSettings, setEventSetting, sql } from "@/lib/db";
import { parseWibInput, toWibInput, tokenPrefixFor, votingStatus } from "@/lib/event";
import { audit, clientIp } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { normalizeImageData, DEFAULT_LOGO } from "@/lib/uploads";
import { normalizePrefix } from "@/lib/tokens";

const TEXT_KEYS = [
  "title_line1",
  "title_line2",
  "invite_date",
  "invite_time",
  "invite_tps",
  "invite_address",
  "invite_watermark",
] as const;

const JADWAL_SALAH = "harus berbentuk 2026-11-20T08:00 (waktu Jakarta).";

/** Input datetime-local panitia → Date UTC; string kosong berarti "tanpa batas". */
function readJadwal(value: unknown, label: string): Date | null {
  const d = parseWibInput(typeof value === "string" ? value : "");
  if (d === "invalid") throw new HttpError(400, `${label} ${JADWAL_SALAH}`);
  return d;
}

export const GET = adminRoute(async (ev) => {
  const settings = await getEventSettings(ev.id);
  const state = votingStatus(ev);
  return json({
    slug: ev.slug,
    name: ev.name,
    title_line1: settings.title_line1 || "",
    title_line2: settings.title_line2 || "",
    election_status: ev.status === "open" ? "open" : "closed",
    vote_mode: ev.vote_mode,
    opens_at: toWibInput(ev.opens_at),
    closes_at: toWibInput(ev.closes_at),
    effective_open: state.open,
    effective_label: state.label,
    effective_reason: state.reason,
    admin_username: settings.admin_username || "",
    token_prefix: tokenPrefixFor(ev.kind, settings.token_prefix),
    invite_date: settings.invite_date || "",
    invite_time: settings.invite_time || "",
    invite_tps: settings.invite_tps || "",
    invite_address: settings.invite_address || "",
    invite_watermark: settings.invite_watermark || "",
    logo_url: settings.logo_url || DEFAULT_LOGO,
  });
});

export const PUT = adminRoute(async (ev, req) => {
  const body = await readJsonBody<Record<string, string>>(req);
  const ip = clientIp(req.headers);
  const changed: string[] = [];

  for (const key of TEXT_KEYS) {
    if (body[key] !== undefined) {
      await setEventSetting(ev.id, key, String(body[key]).trim());
      changed.push(key);
    }
  }

  if (body.token_prefix !== undefined) {
    const prefix = normalizePrefix(body.token_prefix);
    await setEventSetting(ev.id, "token_prefix", prefix);
    changed.push(`prefix kode: ${prefix}`);
  }

  if (body.logo_url !== undefined) {
    const logo = normalizeImageData(body.logo_url, DEFAULT_LOGO, 1_500_000, "logo");
    await setEventSetting(ev.id, "logo_url", logo);
    changed.push("logo");
  }

  if (body.election_status !== undefined) {
    const status = body.election_status === "closed" ? "closed" : "open";
    await sql`update events set status = ${status} where id = ${ev.id}`;
    changed.push(`status pemungutan: ${status}`);
    await audit(ev.id, "ELECTION_STATUS_CHANGED", `Status pemungutan diubah ke ${status}`, "admin", ip);
  }

  if (body.opens_at !== undefined || body.closes_at !== undefined) {
    const opens = body.opens_at === undefined ? ev.opens_at : readJadwal(body.opens_at, "Jam buka");
    const closes = body.closes_at === undefined ? ev.closes_at : readJadwal(body.closes_at, "Jam tutup");
    if (opens && closes && closes.getTime() <= opens.getTime()) {
      throw new HttpError(400, "Jam tutup harus setelah jam buka.");
    }
    const sameTime = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
    if (!sameTime(opens, ev.opens_at) || !sameTime(closes, ev.closes_at)) {
      await sql`update events set opens_at = ${opens}, closes_at = ${closes} where id = ${ev.id}`;
      const tampil = (d: Date | null) => (d ? `${toWibInput(d)} WIB` : "tanpa batas");
      changed.push(`jadwal pemungutan: buka ${tampil(opens)}, tutup ${tampil(closes)}`);
      await audit(
        ev.id,
        "ELECTION_SCHEDULE_CHANGED",
        `Jadwal pemungutan diubah — buka ${tampil(opens)}, tutup ${tampil(closes)}`,
        "admin",
        ip,
      );
    }
  }

  if (body.vote_mode !== undefined) {
    const mode = body.vote_mode === "live" ? "live" : "simulasi";
    if (mode !== ev.vote_mode) {
      await sql`update events set vote_mode = ${mode} where id = ${ev.id}`;
      changed.push(`mode pemungutan: ${mode}`);
      await audit(
        ev.id,
        "VOTE_MODE_CHANGED",
        mode === "live"
          ? "Mode diubah ke LIVE — 1 undangan hanya berlaku 1 suara, suara terkunci"
          : "Mode diubah ke SIMULASI — kode boleh dipakai ulang, suara terakhir menimpa",
        "admin",
        ip,
      );
    }
  }

  if (body.admin_username !== undefined) {
    const username = String(body.admin_username).trim();
    if (!username) throw new HttpError(400, "Username admin wajib diisi.");
    await setEventSetting(ev.id, "admin_username", username);
    changed.push("username admin");
  }

  if (changed.length) await audit(ev.id, "SETTINGS_UPDATED", changed.join(", "), "admin", ip);

  if (body.current_password !== undefined || body.new_password !== undefined) {
    const s = await getEventSettings(ev.id);
    if (!verifyPassword(body.current_password || "", s.admin_password_hash || "")) {
      throw new HttpError(400, "Password lama salah.");
    }
    const np = body.new_password || "";
    if (np.length < 6) throw new HttpError(400, "Password baru minimal 6 karakter.");
    await setEventSetting(ev.id, "admin_password_hash", hashPassword(np));
    await audit(ev.id, "PASSWORD_CHANGED", "Password admin diganti", "admin", ip);
  }

  return json({ ok: true });
});
