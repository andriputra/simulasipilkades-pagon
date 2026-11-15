import { getEventSettings, sql } from "./db";
import { isValidSlug, tokenPrefixFor } from "./event-meta";

/** Enum, label, dan validator slug diimpor ulang dari berkas yang aman untuk klien. */
export * from "./event-meta";

export type EventRow = {
  id: number;
  slug: string;
  name: string;
  kind: string;
  status: "draft" | "open" | "closed" | "archived";
  vote_mode: "simulasi" | "live";
  opens_at: Date | null;
  closes_at: Date | null;
  is_default: boolean;
  archived_at: Date | null;
};

/** Kunci pengaturan yang hidup per-event (warisan dari tabel settings tunggal). */
export const EVENT_SETTING_KEYS = [
  "title_line1",
  "title_line2",
  "admin_username",
  "admin_password_hash",
  "invite_date",
  "invite_time",
  "invite_tps",
  "invite_address",
  "invite_watermark",
  "logo_url",
  "token_prefix",
] as const;

/** Jadwal disimpan sebagai UTC; input dibaca sebagai waktu Jakarta. */
const WIB_INPUT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "YYYY-MM-DDTHH:MM" (WIB) → Date; string kosong → null; format salah → "invalid". */
export function parseWibInput(value: string): Date | null | "invalid" {
  const v = (value || "").trim();
  if (!v) return null;
  if (!WIB_INPUT_RE.test(v)) return "invalid";
  const d = new Date(`${v}:00+07:00`);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/** Kebalikan parseWibInput: Date → nilai siap pakai untuk input datetime-local. */
export function toWibInput(value: Date | string | null): string {
  if (!value) return "";
  const local = new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" });
  return `${local.slice(0, 10)}T${local.slice(11, 16)}`;
}

export async function findEventBySlug(slug: string): Promise<EventRow | null> {
  if (!isValidSlug(slug)) return null;
  const [row] = await sql`select id, slug, name, kind, status, vote_mode, opens_at, closes_at,
                                 is_default, archived_at
                          from events where slug = ${slug}`;
  return (row as EventRow) ?? null;
}

export async function getDefaultEvent(): Promise<EventRow | null> {
  const [row] = await sql`select id, slug, name, kind, status, vote_mode, opens_at, closes_at,
                                 is_default, archived_at
                          from events
                          order by is_default desc, created_at desc
                          limit 1`;
  return (row as EventRow) ?? null;
}

/** Waktu tampil untuk jadwal, selalu dinyatakan dalam WIB. */
export function wibLabel(value: Date): string {
  return `${new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

export type VotingState = { open: boolean; label: string; reason: string };

/** Kolom yang dibutuhkan untuk menentukan status efektif — baris ringkasan boleh sebagian. */
type VotingFields = Pick<EventRow, "status" | "opens_at" | "closes_at">;

/**
 * Status efektif untuk hari-H: status manual dikalahkan oleh jendela waktu
 * bila event punya jadwal mulai/selesai.
 */
export function votingStatus(ev: VotingFields, now = Date.now()): VotingState {
  if (ev.status === "archived") return { open: false, label: "Diarsipkan", reason: "simulasi diarsipkan" };
  if (ev.status === "draft") return { open: false, label: "Draf", reason: "status simulasi masih draf" };

  const opensAt = ev.opens_at ? new Date(ev.opens_at) : null;
  const closesAt = ev.closes_at ? new Date(ev.closes_at) : null;
  if (opensAt && now < opensAt.getTime())
    return { open: false, label: "Belum dibuka", reason: `sesuai jadwal, mulai ${wibLabel(opensAt)}` };
  if (closesAt && now > closesAt.getTime())
    return { open: false, label: "Jadwal berakhir", reason: `sesuai jadwal, berakhir ${wibLabel(closesAt)}` };

  if (ev.status === "closed") return { open: false, label: "Ditutup", reason: "ditutup panitia" };
  if (closesAt) return { open: true, label: "Dibuka", reason: `sampai ${wibLabel(closesAt)}` };
  if (opensAt) return { open: true, label: "Dibuka", reason: `sejak ${wibLabel(opensAt)}` };
  return { open: true, label: "Dibuka", reason: "status manual tanpa jadwal" };
}

export function isVotingOpen(ev: VotingFields, now = Date.now()): boolean {
  return votingStatus(ev, now).open;
}

export async function getEventConfig(ev: EventRow) {
  const settings = await getEventSettings(ev.id);
  return {
    event: ev,
    settings,
    open: isVotingOpen(ev),
    liveMode: ev.vote_mode === "live",
    tokenPrefix: tokenPrefixFor(ev.kind, settings.token_prefix),
  };
}
