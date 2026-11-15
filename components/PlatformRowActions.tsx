"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";

/**
 * Tindakan cepat di daftar simulasi. Aksi berat (kredensial panitia, arsip,
 * hapus permanen, halaman depan) hanya ada di halaman detail supaya tidak bisa
 * tak sengaja diklik dari tabel.
 */
export default function PlatformRowActions({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const openPanel = async () => {
    setBusy(true);
    const res = await fetch(`/api/platform/e/${slug}/impersonate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast(data.error || "Gagal membuka panel.", "error");
      return;
    }
    toast(`Membuka panel panitia ${name}…`, "success");
    router.push(data.redirect || `/e/${slug}/admin`);
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/platform/e/${slug}`}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        Kelola
      </Link>
      <button
        onClick={openPanel}
        disabled={busy}
        title="Masuk ke CMS panitia tanpa password panitia"
        className="rounded-md bg-blue-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {busy ? "…" : "Panel"}
      </button>
    </div>
  );
}
