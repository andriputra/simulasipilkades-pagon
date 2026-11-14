"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";

type Voter = {
  id: number;
  name: string;
  nik: string;
  token: string;
  has_voted: boolean;
  voted_at: string | null;
};

const PAGE_SIZES = [10, 25, 50, 100];

function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("gap");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("gap");
  out.push(total);
  return out;
}

function EditVoterModal({ voter, onClose, onSaved }: { voter: Voter; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(voter.name);
  const [nik, setNik] = useState(voter.nik || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("Nama pemilih wajib diisi.", "error");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/voters/${voter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, nik }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast(data.error || "Gagal menyimpan data pemilih.", "error");
      return;
    }
    toast(`Data "${data.name}" diperbarui.`, "success");
    onSaved();
  };

  const inputCls =
    "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 px-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form onSubmit={save} className="pop-in w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900">Ubah Data Pemilih</h3>
        <p className="mt-1 text-xs text-slate-500">
          Kode token tidak diubah agar surat undangan &amp; status coblos tetap cocok.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-700">Nama lengkap</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-700">NIK / No. KTP</span>
            <input
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="Kosongkan bila tidak dicatat"
              maxLength={30}
              className={inputCls}
            />
          </label>
          <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kode token</p>
              <p className="truncate font-mono text-xs text-slate-700">{voter.token}</p>
            </div>
            {voter.has_voted ? (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Sudah</span>
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Belum</span>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Batal
          </button>
          <button type="submit" disabled={busy} className="rounded-md bg-blue-700 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
            {busy ? "Menyimpan…" : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminVotersPage() {
  const toast = useToast();
  const [list, setList] = useState<Voter[] | null>(null);
  const [name, setName] = useState("");
  const [nik, setNik] = useState("");
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState<"all" | "belum" | "sudah">("all");
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Voter | null>(null);
  const [toUnlock, setToUnlock] = useState<Voter | null>(null);
  const [editing, setEditing] = useState<Voter | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/voters");
    if (res.ok) setList(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    if (!list) return [];
    if (filter === "belum") return list.filter((v) => !v.has_voted);
    if (filter === "sudah") return list.filter((v) => v.has_voted);
    return list;
  }, [list, filter]);

  const totalPages = Math.max(1, Math.ceil(shown.length / perPage));
  useEffect(() => {
    setPage(1);
  }, [filter, perPage]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (page - 1) * perPage;
  const rows = shown.slice(start, start + perPage);

  const votedCount = list?.filter((v) => v.has_voted).length ?? 0;

  const add = async (bulk: boolean) => {
    setBusy(true);
    const res = await fetch("/api/admin/voters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bulk ? { count } : { name, nik }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast(data.error || "Gagal menambah pemilih.", "error");
      return;
    }
    toast(bulk ? `${data.length} pemilih & kode QR dibuat.` : `Pemilih "${data[0].name}" dibuat (${data[0].token}).`, "success");
    if (!bulk) {
      setName("");
      setNik("");
    }
    setPage(1);
    load();
  };

  const doDelete = async () => {
    if (!toDelete) return;
    const res = await fetch(`/api/admin/voters/${toDelete.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setToDelete(null);
    if (!res.ok) {
      toast(data.error || "Gagal menghapus.", "error");
      return;
    }
    toast("Pemilih dihapus.", "success");
    load();
  };

  const doUnlock = async () => {
    if (!toUnlock) return;
    const res = await fetch(`/api/admin/voters/${toUnlock.id}/unlock`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setToUnlock(null);
    if (!res.ok) {
      toast(data.error || "Gagal membuka kunci suara.", "error");
      return;
    }
    toast(`Suara "${toUnlock.name}" dihapus, kodenya bisa dicoblos lagi.`, "success");
    load();
  };

  const pageBtn =
    "min-w-7 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Pemilih &amp; Kode QR</h2>
          <p className="text-xs text-slate-500">
            {list ? `${list.length} terdaftar · ${votedCount} sudah mencoblos` : "Memuat…"} — kode QR dipakai sebagai syarat pencoblosan di kiosk.
          </p>
        </div>
        <Link
          href="/admin/print"
          target="_blank"
          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Cetak Surat Undangan
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(false);
          }}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 className="text-sm font-bold text-slate-800">Daftarkan Satu Pemilih</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama lengkap"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="NIK / No. KTP (opsional)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 w-full rounded-md bg-blue-700 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            Buat Pemilih + Kode QR
          </button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(true);
          }}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 className="text-sm font-bold text-slate-800">Generate Massal (Pendaftaran Cepat)</h3>
          <p className="mt-1 text-[11px] text-slate-500">Membuat pemilih bernama otomatis beserta kode QR unik.</p>
          <label className="mt-3 block text-[11px] font-semibold text-slate-600">
            Jumlah
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-blue-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 w-full rounded-md bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Generate {count || 0} Kode QR
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-800">Daftar Pemilih</h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="all">Semua status</option>
            <option value="belum">Belum mencoblos</option>
            <option value="sudah">Sudah mencoblos</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2">NIK</th>
                <th className="px-4 py-2">Kode Token</th>
                <th className="px-4 py-2">QR</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((v, i) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-400">{start + i + 1}</td>
                  <td className="px-4 py-2 font-semibold text-slate-800">{v.name}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{v.nik || "-"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">{v.token}</td>
                  <td className="px-4 py-2">
                    <img src={`/api/admin/voters/${v.id}/qr`} alt={`QR ${v.token}`} className="h-14 w-14 rounded border border-slate-200 bg-white" loading="lazy" />
                  </td>
                  <td className="px-4 py-2">
                    {v.has_voted ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Sudah</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Belum</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditing(v)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Ubah
                      </button>
                      <a
                        href={`/admin/print?voter=${v.id}&auto=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cetak
                      </a>
                      {v.has_voted && (
                        <button
                          onClick={() => setToUnlock(v)}
                          className="rounded-md border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50"
                        >
                          Buka Kunci
                        </button>
                      )}
                      <button
                        onClick={() => setToDelete(v)}
                        disabled={v.has_voted}
                        className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">
                    Tidak ada data pemilih pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {shown.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <p className="text-[11px] text-slate-500">
              Menampilkan <b className="text-slate-700">{start + 1}–{start + rows.length}</b> dari{" "}
              <b className="text-slate-700">{shown.length}</b> pemilih
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                Baris
                <select
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={pageBtn} aria-label="Halaman sebelumnya">
                    ‹
                  </button>
                  {pageWindow(page, totalPages).map((p, idx) =>
                    p === "gap" ? (
                      <span key={`gap-${idx}`} className="px-1 text-xs text-slate-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        aria-current={p === page ? "page" : undefined}
                        className={`min-w-7 rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                          p === page ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={pageBtn} aria-label="Halaman berikutnya">
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {editing && <EditVoterModal voter={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}

      <ConfirmModal
        open={!!toUnlock}
        title="Buka kunci suara pemilih?"
        message={`Suara "${toUnlock?.name || ""}" (${toUnlock?.token || ""}) akan dihapus dari rekap dan kodenya berlaku lagi untuk mencoblos. Pilihan lama tidak disimpan.`}
        confirmLabel="Buka Kunci"
        onConfirm={doUnlock}
        onCancel={() => setToUnlock(null)}
      />

      <ConfirmModal
        open={!!toDelete}
        title="Hapus pemilih?"
        message={`Pemilih "${toDelete?.name || ""}" (${toDelete?.token || ""}) akan dihapus permanen.`}
        confirmLabel="Hapus"
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
