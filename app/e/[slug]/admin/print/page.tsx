import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";
import AutoPrint from "@/components/AutoPrint";
import PrintButton from "@/components/PrintButton";
import { isAdminForEvent } from "@/lib/admin";
import { getEventSettings, withEvent } from "@/lib/db";
import { findEventBySlug } from "@/lib/event";
import { labelsFor, lower } from "@/lib/event-meta";
import { DEFAULT_LOGO } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type InvitedVoter = { id: number; name: string; token: string };

export default async function PrintQrPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ status?: string; voter?: string; auto?: string }>;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ev = await findEventBySlug(slug);
  if (!ev) notFound();
  if (!(await isAdminForEvent(ev.id, ev.slug))) redirect(`/e/${slug}/admin/login`);

  const sp = await searchParams;
  const onlyUnvoted = sp.status === "belum";
  const singleId = Number(sp.voter);
  const isSingle = Number.isInteger(singleId) && singleId > 0;

  const voters = (await withEvent(ev.id, (tx) =>
    isSingle
      ? tx`select id, name, token from voters where id = ${singleId} order by id`
      : onlyUnvoted
        ? tx`select id, name, token from voters where has_voted = false order by id`
        : tx`select id, name, token from voters order by id`,
  )) as unknown as InvitedVoter[];

  const s = await getEventSettings(ev.id);
  const L = labelsFor(ev.kind);

  const invite = {
    date: s.invite_date || "",
    time: s.invite_time || "",
    tps: s.invite_tps || "",
    address: s.invite_address || "",
    watermark: s.invite_watermark || "",
    logo: s.logo_url || DEFAULT_LOGO,
  };

  const items = await Promise.all(
    voters.map(async (v) => ({
      ...v,
      qr: await QRCode.toDataURL(v.token, { margin: 1, width: 320, errorCorrectionLevel: "M" }),
    }))
  );

  const infoRows: [string, string][] = [
    ["HARI / Tanggal", invite.date],
    ["PUKUL", invite.time],
    [L.lokasi.toUpperCase(), invite.tps],
    ["ALAMAT", invite.address],
  ];

  return (
    <div className="min-h-dvh bg-slate-100 p-4 md:p-6">
      {sp.auto === "1" && <AutoPrint />}
      <div className="no-print mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-sm font-bold text-slate-800">
            {isSingle ? `${L.surat} — ${voters[0]?.name ?? `${lower(L.pemilih)} tidak ditemukan`}` : `${L.surat} Pemungutan Suara`}
          </h1>
          <p className="text-[11px] text-slate-500">
            {isSingle
              ? "Cetak 1 surat per halaman — isi surat diatur di Pengaturan."
              : `${items.length} surat siap cetak (2 per halaman A4) — isi surat diatur di Pengaturan.`}
          </p>
        </div>
        <div className="flex gap-2">
          {isSingle ? (
            <a
              href={`/e/${slug}/admin/print`}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cetak semua surat
            </a>
          ) : (
            <a
              href={onlyUnvoted ? `/e/${slug}/admin/print` : `/e/${slug}/admin/print?status=belum`}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {onlyUnvoted ? "Tampilkan semua" : `Hanya belum ${L.coblosKata}`}
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        {items.map((v) => (
          <div
            key={v.id}
            className="print-letter letter-card relative mx-auto w-full max-w-3xl overflow-hidden border border-slate-300 bg-white p-6 shadow-sm md:p-8"
          >
            {invite.watermark && (
              <span className="pointer-events-none absolute inset-0 flex select-none items-center justify-center -rotate-30 text-8xl font-extrabold uppercase tracking-widest text-slate-500/25">
                {invite.watermark}
              </span>
            )}

            <div className="border-t-2 border-slate-800 pt-3">
              <div className="flex items-center gap-4">
                <img src={invite.logo} alt="Logo penyelenggara" className="h-24 w-auto shrink-0" />
                <h2 className="flex-1 text-center text-xl font-extrabold leading-snug text-slate-900">
                  SURAT UNDANGAN
                  <br />
                  PEMUNGUTAN SUARA
                  <br />
                  KEPADA {L.pemilih.toUpperCase()}
                </h2>
                <span className="w-24 shrink-0" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-2 border-b-4 border-slate-800" />

            <div className="mt-6 flex items-start gap-6">
              <div className="shrink-0 text-center">
                <img src={v.qr} alt={v.token} className="h-32 w-32" />
                <p className="mt-1 max-w-32 truncate text-[10px] font-bold text-slate-700">{v.name}</p>
                <p className="font-mono text-[9px] text-slate-500">{v.token}</p>
              </div>
              <div className="flex-1 space-y-3 pt-1">
                <div className="border-2 border-red-500 px-3 py-1.5 text-center text-sm font-extrabold text-red-500">
                  SURAT UNDANGAN INI BERSIFAT RAHASIA
                </div>
                <div className="border-[3px] border-slate-900 px-3 py-1.5 text-center text-sm font-extrabold text-slate-900">
                  Tunjukan QRcode berikut saat {L.coblosKata}
                </div>
              </div>
            </div>

            <div className="mt-7 space-y-3 pl-4 text-[15px] font-bold text-slate-900">
              {infoRows.map(([label, value]) => (
                <div key={label} className="flex">
                  <span className="w-40 shrink-0">{label}</span>
                  <span className="w-4 shrink-0">:</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
            Tidak ada {lower(L.pemilih)} pada filter ini.
          </p>
        )}
      </div>
    </div>
  );
}
