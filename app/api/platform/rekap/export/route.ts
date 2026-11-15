import { NextResponse } from "next/server";
import { clientIp } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { EVENT_KIND_LABELS, EVENT_STATUS_LABELS } from "@/lib/event";
import { HttpError } from "@/lib/http";
import { filterRecaps, listEventRecaps, platformAudit, platformRoute } from "@/lib/platform";

const KIND_RE = /^[a-z_]{3,20}$/;
const STATUS_RE = /^[a-z_]{3,20}$/;
const TEXT_RE = /^[\p{L}\p{N}\p{P}\p{Zs}]{1,80}$/u;

function read(sp: URLSearchParams, key: string, re: RegExp) {
  const value = (sp.get(key) || "").trim();
  return re.test(value) ? value : "";
}

const persen = (bagian: number, total: number) => (total ? `${((bagian / total) * 100).toFixed(1).replace(".", ",")}%` : "0,0%");

/** Unduh semua simulasi + perolehan suaranya dalam satu berkas CSV datar.
 *  Filter query sama dengan halaman /platform/rekap. */
export const GET = platformRoute(async (session, req) => {
  const sp = new URL(req.url).searchParams;
  const filter = { kind: read(sp, "kind", KIND_RE), status: read(sp, "status", STATUS_RE), cari: read(sp, "cari", TEXT_RE) };
  const events = filterRecaps(await listEventRecaps(), filter);
  if (!events.length) throw new HttpError(404, "Tidak ada simulasi yang cocok untuk diekspor.");

  const table: (string | number)[][] = [
    ["Simulasi", "URL", "Jenis", "Status", "Mode", "Pemilih Terdaftar", "Sudah Memilih", "Partisipasi", "Suara Masuk", "Nomor", "Opsi", "Suara", "Persentase"],
  ];
  for (const ev of events) {
    const dasar = [
      ev.name,
      `/e/${ev.slug}`,
      EVENT_KIND_LABELS[ev.kind] || ev.kind,
      EVENT_STATUS_LABELS[ev.status] || ev.status,
      ev.vote_mode === "live" ? "Live" : "Simulasi",
      ev.voters,
      ev.voted,
      persen(ev.voted, ev.voters),
      ev.votes,
    ];
    if (!ev.options.length) {
      table.push([...dasar, "-", "Belum ada opsi terdaftar", 0, "0,0%"]);
      continue;
    }
    for (const o of [...ev.options].sort((a, b) => b.votes - a.votes || a.number - b.number)) {
      table.push([...dasar, o.number, o.active ? o.name : `${o.name} (nonaktif)`, o.votes, persen(o.votes, ev.votes)]);
    }
  }

  const tanggal = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  await platformAudit(
    session.user.username,
    "RECAP_EXPORTED",
    `Ekspor CSV rekap lintas simulasi: ${events.length} simulasi${filter.kind || filter.status || filter.cari ? " (filter aktif)" : ""}`,
    null,
    clientIp(req.headers),
  );

  return new NextResponse(toCsv(table), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-lintas-simulasi-${tanggal}.csv"`,
    },
  });
});
