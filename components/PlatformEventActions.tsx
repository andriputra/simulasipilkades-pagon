"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";
import { labelsFor, lower } from "@/lib/event-meta";

export type PlatformEventActionsProps = {
  slug: string;
  name: string;
  kind: string;
  status: string;
  is_default: boolean;
  voters: number;
  votes: number;
};

const btnPrimary =
  "block w-full rounded-md bg-blue-700 px-3 py-2 text-center text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-60";
const btnGhost =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const btnDanger =
  "block w-full rounded-md border border-red-300 bg-white px-3 py-2 text-center text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40";

/** Panel aksi di sisi kanan halaman detail simulasi (tetap terlihat saat digulir). */
export default function PlatformEventActions({ slug, name, kind, status, is_default, voters, votes }: PlatformEventActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const L = labelsFor(kind);
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<"archive" | "delete" | null>(null);

  const call = async (key: string, path: string, init: RequestInit, onOk?: (data: any) => void) => {
    setBusy(key);
    const res = await fetch(path, init);
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast(data.error || "Aksi ditolak.", "error");
      return;
    }
    onOk?.(data);
    router.refresh();
  };

  const openPanel = () =>
    call("panel", `/api/platform/e/${slug}/impersonate`, { method: "POST" }, (d) => {
      toast("Membuka panel panitia…", "success");
      router.push(d.redirect || `/e/${slug}/admin`);
    });

  const setDefault = () =>
    call("default", `/api/platform/e/${slug}/default`, { method: "POST" }, () => toast("Halaman depan diarahkan ke simulasi ini.", "success"));

  const archive = () =>
    call(
      "archive",
      `/api/platform/e/${slug}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) },
      () => {
        toast("Simulasi diarsipkan. Kiosk menolak suara baru.", "success");
        setAsk(null);
      },
    );

  const restore = () =>
    call(
      "restore",
      `/api/platform/e/${slug}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "draft" }) },
      () => toast("Simulasi dikembalikan ke status Draf.", "success"),
    );

  const remove = () =>
    call("delete", `/api/platform/e/${slug}`, { method: "DELETE" }, () => {
      toast("Simulasi dan seluruh datanya dihapus.", "success");
      setAsk(null);
      router.push("/platform");
    });

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Akses cepat</p>
        <div className="mt-3 space-y-2">
          <button onClick={openPanel} disabled={busy === "panel"} className={btnPrimary}>
            {busy === "panel" ? "Membuka…" : "Masuk sebagai Panitia"}
          </button>
          <Link href={`/e/${slug}`} target="_blank" className={btnGhost}>
            Buka Kiosk ↗
          </Link>
          <Link href={`/e/${slug}/undangan`} target="_blank" className={btnGhost}>
            Halaman Undangan ↗
          </Link>
          {!is_default && (
            <button onClick={setDefault} disabled={busy === "default"} className={btnGhost}>
              {busy === "default" ? "Menyimpan…" : "Jadikan Halaman Depan"}
            </button>
          )}
        </div>
        {is_default && (
          <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
            Simulasi ini adalah halaman depan: membuka <span className="font-mono">/</span> langsung menuju{" "}
            <span className="font-mono">/e/{slug}</span>.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ringkas data</p>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-slate-500">{L.pemilih} terdaftar</dt>
            <dd className="font-semibold text-slate-700">{voters}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Suara tercatat</dt>
            <dd className="font-semibold text-slate-700">{votes}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-semibold uppercase text-slate-700">{status}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Reset suara, impor {lower(L.pemilih)}, dan ubah mode pemungutan dilakukan panitia di dalam panel — konsol ini tidak
          menyalin fungsi-fungsi itu.
        </p>
      </div>

      <div className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">Zona berbahaya</p>
        <div className="mt-3 space-y-2">
          {status === "archived" ? (
            <button onClick={restore} disabled={busy === "restore"} className={btnGhost}>
              {busy === "restore" ? "Memulihkan…" : "Pulihkan ke Status Draf"}
            </button>
          ) : (
            <button onClick={() => setAsk("archive")} disabled={busy === "archive"} className={btnGhost}>
              {busy === "archive" ? "Mengarsipkan…" : "Arsipkan Simulasi"}
            </button>
          )}
          <button onClick={() => setAsk("delete")} disabled={status !== "archived" || busy === "delete"} className={btnDanger}>
            {busy === "delete" ? "Menghapus…" : "Hapus Permanen"}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Hapus permanen hanya terbuka untuk simulasi berstatus arsip, dan ditolak server bila masih ada {lower(L.pemilih)}
          terdaftar ({voters} saat ini). Tidak dapat dibatalkan.
        </p>
      </div>

      <ConfirmModal
        open={ask === "archive"}
        title="Arsipkan simulasi ini?"
        message={`Kiosk ${name} akan menolak suara baru dan datanya tetap tersimpan untuk dilihat. Pulihkan ke Draf kapan saja bila perlu dibuka lagi.`}
        confirmLabel="Ya, arsipkan"
        onConfirm={archive}
        onCancel={() => setAsk(null)}
      />
      <ConfirmModal
        open={ask === "delete"}
        title="Hapus permanen?"
        message={`${name}: ${voters} ${lower(L.pemilih)}, ${votes} suara, ${lower(L.calonPendek)}, pengaturan, dan audit log simulasi ini akan dihapus dari basis data. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Ya, hapus permanen"
        onConfirm={remove}
        onCancel={() => setAsk(null)}
      />
    </div>
  );
}
