import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin";
import { ensureSchema, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PrintQrPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await ensureSchema();
  if (!(await isAdminAuthed())) redirect("/admin/login");
  const params = await searchParams;
  const onlyUnvoted = params.status === "belum";
  const voters = onlyUnvoted
    ? await sql`select id, name, token from voters where has_voted = false order by id`
    : await sql`select id, name, token from voters order by id`;
  const [t1] = await sql`select value from settings where key = 'title_line1'`;

  const items = await Promise.all(
    voters.map(async (v: { id: number; name: string; token: string }) => ({
      ...v,
      qr: await QRCode.toDataURL(v.token, { margin: 1, width: 240, errorCorrectionLevel: "M" }),
    }))
  );

  return (
    <div className="min-h-dvh bg-slate-100 p-4 md:p-6">
      <div className="no-print mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-sm font-bold text-slate-800">Lembar Cetak Kode QR Pemilih</h1>
          <p className="text-[11px] text-slate-500">{items.length} kode QR siap cetak — gunting per kartu.</p>
        </div>
        <div className="flex gap-2">
          <a
            href={onlyUnvoted ? "/admin/print" : "/admin/print?status=belum"}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {onlyUnvoted ? "Tampilkan semua" : "Hanya belum mencoblos"}
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
          >
            Cetak
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-slate-700">
          {t1?.value || ""} — Kartu Peserta Pencoblosan
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((v) => (
            <div key={v.id} className="break-inside-avoid rounded-md border border-slate-300 bg-white p-2 text-center">
              <img src={v.qr} alt={v.token} className="mx-auto h-24 w-24" />
              <p className="mt-1 truncate text-[11px] font-bold text-slate-800">{v.name}</p>
              <p className="font-mono text-[9px] text-slate-500">{v.token}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
