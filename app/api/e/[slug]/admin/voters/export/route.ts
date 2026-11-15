import { NextResponse } from "next/server";
import { adminRoute, HttpError } from "@/lib/http";
import { withEvent } from "@/lib/db";
import { labelsFor } from "@/lib/event";
import { toCsv } from "@/lib/csv";

type Row = { name: string; nik: string; token: string; has_voted: boolean };

/** Daftar pemilih siap edit: header-nya dikenali lagi oleh form impor CSV. */
export const GET = adminRoute(async (ev) => {
  const rows = (await withEvent(ev.id, (tx) =>
    tx`select name, nik, token, has_voted from voters order by id`,
  )) as unknown as Row[];
  if (!rows.length) throw new HttpError(404, `Belum ada ${labelsFor(ev.kind).pemilih.toLowerCase()} untuk diekspor.`);

  const L = labelsFor(ev.kind);
  const table = [
    ["Nama", "NIK", "Kode Token", `Status ${L.coblosKata}`],
    ...rows.map((r) => [r.name, r.nik, r.token, r.has_voted ? "Sudah" : "Belum"]),
  ];

  return new NextResponse(toCsv(table), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="daftar-${ev.slug}.csv"`,
    },
  });
});
