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

export default function AdminVotersPage() {
  const toast = useToast();
  const [list, setList] = useState<Voter[] | null>(null);
  const [name, setName] = useState("");
  const [nik, setNik] = useState("");
  const [count, setCount] = useState(10);
  const [filter, setFilter] = useState<"all" | "belum" | "sudah">("all");
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Voter | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/voters");
    if (res.ok) setList(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const shown = useMemo(() => {
    if (!list) return [];
    if (filter === "belum") return list.filter((v) => !v.has_voted);
    if (filter === "sudah") return list.filter((v) => v.has_voted);
    return list;
  }, [list, filter]);

  const votedCount = list?.filter((v) => v.has_voted).length ?? 0;

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
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              placeholder="NIK / No. KTP (opsional)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
              className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
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
              {shown.map((v, i) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-400">{i + 1}</td>
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
                      <a
                        href={`/admin/print?voter=${v.id}&auto=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cetak
                      </a>
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
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-400">
                    Tidak ada data pemilih pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
